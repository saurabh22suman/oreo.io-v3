from __future__ import annotations
import os
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass
import json
import logging
import tempfile
import uuid
import shutil

import duckdb
from deltalake import DeltaTable, write_deltalake

try:
    import pyarrow as pa
    import pyarrow.dataset as ds
    import pyarrow.compute as pc
except Exception as e:
    pa = None


@dataclass
class DeltaConfig:
    root: str

    @classmethod
    def from_env(cls) -> "DeltaConfig":
        root = os.getenv("DELTA_DATA_ROOT", "/data/delta")
        os.makedirs(root, exist_ok=True)
        return cls(root=root)


logger = logging.getLogger("delta")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format='%(message)s')


class DeltaStorageAdapter:
    """Delta Lake Storage Adapter following Oreo.io folder structure spec.
    
    Implements the canonical Delta Lake folder layout:
    /data/delta/projects/<project_id>/datasets/<dataset_id>/
        ├── main/               # canonical Delta table
        ├── staging/            # per-change-request staging tables
        ├── live_edit/          # per-session cell-edit tables
        ├── imports/            # raw files & intermediate ingest
        └── audit/              # validation runs, snapshots, history extracts
    
    - Writes use write_deltalake (append/overwrite/merge via upsert helpers)
    - Reads/queries use embedded DuckDB with the delta scan extension.
    """

    def __init__(self, config: Optional[DeltaConfig] = None):
        self.cfg = config or DeltaConfig.from_env()

    # ==================== Path Resolution ====================
    
    def _dataset_root(self, project_id: int, dataset_id: int) -> str:
        """Get the root path for a dataset."""
        return os.path.join(self.cfg.root, "projects", str(project_id), "datasets", str(dataset_id))
    
    def _main_path(self, project_id: int, dataset_id: int) -> str:
        """Get the path to the main Delta table."""
        return os.path.join(self._dataset_root(project_id, dataset_id), "main")
    
    def _staging_path(self, project_id: int, dataset_id: int, change_request_id: int) -> str:
        """Get the path to a staging Delta table for a change request."""
        return os.path.join(self._dataset_root(project_id, dataset_id), "staging", str(change_request_id))
    
    def _live_edit_path(self, project_id: int, dataset_id: int, session_id: str) -> str:
        """Get the path to a live edit session's Delta table."""
        return os.path.join(self._dataset_root(project_id, dataset_id), "live_edit", session_id, "edits.delta")
    
    def _imports_path(self, project_id: int, dataset_id: int, upload_id: str) -> str:
        """Get the path to an import folder."""
        return os.path.join(self._dataset_root(project_id, dataset_id), "imports", upload_id)
    
    def _audit_path(self, project_id: int, dataset_id: int) -> str:
        """Get the path to the audit folder."""
        return os.path.join(self._dataset_root(project_id, dataset_id), "audit")

    # ==================== Legacy Path Support ====================
    
    def _table_path(self, name: str) -> str:
        """Legacy path mapping for backward compatibility."""
        # Name -> path mapping; could namespace by project later
        safe = name.replace("/", "_")
        return os.path.join(self.cfg.root, safe)

    # ==================== Dataset Creation ====================
    
    def create_dataset_structure(self, project_id: int, dataset_id: int) -> str:
        """Create the complete folder structure for a new dataset.
        
        Creates:
        - projects/<project_id>/datasets/<dataset_id>/
          ├── main/
          ├── staging/
          ├── live_edit/
          ├── imports/
          └── audit/
            ├── validation_runs/
            ├── snapshots/
            └── history/
        """
        root = self._dataset_root(project_id, dataset_id)
        
        # Create main directories
        os.makedirs(os.path.join(root, "main"), exist_ok=True)
        os.makedirs(os.path.join(root, "staging"), exist_ok=True)
        os.makedirs(os.path.join(root, "live_edit"), exist_ok=True)
        os.makedirs(os.path.join(root, "imports"), exist_ok=True)
        
        # Create audit subdirectories
        os.makedirs(os.path.join(root, "audit", "validation_runs"), exist_ok=True)
        os.makedirs(os.path.join(root, "audit", "snapshots"), exist_ok=True)
        os.makedirs(os.path.join(root, "audit", "history"), exist_ok=True)
        
        logger.info(json.dumps({
            "event": "create_dataset_structure",
            "project_id": project_id,
            "dataset_id": dataset_id,
            "path": root
        }))
        
        return root

    # ==================== Main Table Operations ====================

    def ensure_main_table(self, project_id: int, dataset_id: int, schema: Dict[str, Any]) -> str:
        """Create an empty main Delta table with provided schema if it does not exist.
        
        The schema is a JSON Schema-like mapping; we convert its properties to Arrow fields.
        Only writes to main/ for approved, committed data.
        """
        path = self._main_path(project_id, dataset_id)
        
        if os.path.exists(path) and os.path.isdir(path) and os.path.exists(os.path.join(path, "_delta_log")):
            return path  # already exists
        
        if pa is None:
            raise RuntimeError("pyarrow required for delta operations")
        
        # Ensure dataset structure exists
        self.create_dataset_structure(project_id, dataset_id)
        
        props = {}
        if isinstance(schema, dict):
            # Allow direct {properties:{...}} or top-level mapping of columns
            if "properties" in schema and isinstance(schema["properties"], dict):
                props = schema["properties"]
            else:
                props = schema
        
        fields = []
        type_map = {
            "string": pa.string(),
            "integer": pa.int64(),
            "number": pa.float64(),
            "boolean": pa.bool_(),
        }
        
        for col, meta in (props or {}).items():
            atype = None
            if isinstance(meta, dict):
                tval = meta.get("type")
                # If type is array (e.g. ["null","string"]) pick first non-null
                if isinstance(tval, list):
                    tval = next((x for x in tval if x != "null"), tval[0] if tval else "string")
                if isinstance(tval, str):
                    atype = type_map.get(tval.lower())
            if atype is None:
                atype = pa.string()
            fields.append(pa.field(col, atype))
        
        # If no fields provided, create a minimal single-column string schema
        if not fields:
            fields = [pa.field("_auto", pa.string())]
        
        schema_obj = pa.schema(fields)
        empty_table = pa.Table.from_arrays(
            [pa.array([], type=f.type) for f in schema_obj],
            names=[f.name for f in schema_obj]
        )
        
        write_deltalake(path, empty_table, mode="overwrite")
        logger.info(json.dumps({
            "event": "ensure_main_table",
            "project_id": project_id,
            "dataset_id": dataset_id,
            "columns": [f.name for f in schema_obj]
        }))
        
        return path

    def append_to_main(self, project_id: int, dataset_id: int, rows: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Append rows to the main Delta table using MERGE semantics.
        
        Uses DuckDB-based MERGE to prevent duplicate rows.
        A row is considered duplicate if ALL column values already exist in the table.
        
        WARNING: Only use this for approved, validated data!
        For change requests, use staging tables instead.
        """
        if pa is None:
            raise RuntimeError("pyarrow required for delta operations")
        
        path = self._main_path(project_id, dataset_id)
        at = pa.Table.from_pylist(rows)
        
        # Schema alignment logic (same as before)
        try:
            if os.path.exists(os.path.join(path, "_delta_log")):
                at = self._align_to_existing_schema(path, at)
        except Exception:
            pass
        
        # Check if main table exists
        main_exists = os.path.exists(os.path.join(path, "_delta_log"))
        
        if not main_exists:
            # No existing table, just write as new
            try:
                write_deltalake(path, at, mode="overwrite")
            except ValueError as e:
                if "Schema of data does not match" in str(e):
                    at = self._handle_schema_mismatch(path, at)
                else:
                    raise
            
            logger.info(json.dumps({
                "event": "append_to_main",
                "project_id": project_id,
                "dataset_id": dataset_id,
                "rows": len(rows),
                "method": "new_table"
            }))
            return {"ok": True, "inserted": len(rows), "duplicates": 0}
        
        # Use DuckDB MERGE to prevent duplicates
        con = duckdb.connect()
        con.execute("INSTALL delta; LOAD delta;")
        
        # Register existing table as target
        con.execute(f"CREATE OR REPLACE VIEW tgt AS SELECT * FROM delta_scan('{path}')")
        
        # Register new rows as source
        con.register("src_table", at)
        con.execute("CREATE OR REPLACE VIEW src AS SELECT * FROM src_table")
        
        # Get all columns for comparison
        all_cols = [field.name for field in at.schema]
        
        # Build condition to check if ALL columns match (duplicate detection)
        # Handle NULL values properly with IS NOT DISTINCT FROM
        col_conditions = " AND ".join([
            f"(tgt.\"{c}\" IS NOT DISTINCT FROM src.\"{c}\")" for c in all_cols
        ])
        
        # Select columns for output
        select_src = ", ".join([f"src.\"{c}\" as \"{c}\"" for c in all_cols])
        select_tgt = ", ".join([f"tgt.\"{c}\" as \"{c}\"" for c in all_cols])
        
        # Count duplicates first
        dup_count_sql = f"""
            SELECT COUNT(*) as dup_count FROM src
            WHERE EXISTS (SELECT 1 FROM tgt WHERE {col_conditions})
        """
        dup_count = con.execute(dup_count_sql).fetchone()[0]
        
        # MERGE: Keep all existing rows + only new rows that don't already exist
        merge_sql = f"""
            SELECT {select_tgt} FROM tgt
            UNION ALL
            SELECT {select_src} FROM src
            WHERE NOT EXISTS (SELECT 1 FROM tgt WHERE {col_conditions})
        """
        
        merged_table = con.execute(merge_sql).fetch_arrow_table()
        inserted_count = len(rows) - dup_count
        
        # Write merged result back
        write_deltalake(path, merged_table, mode="overwrite")
        
        logger.info(json.dumps({
            "event": "append_to_main",
            "project_id": project_id,
            "dataset_id": dataset_id,
            "rows": len(rows),
            "inserted": inserted_count,
            "duplicates": dup_count,
            "method": "merge"
        }))
        
        return {"ok": True, "inserted": inserted_count, "duplicates": dup_count}

    # ==================== Staging Table Operations ====================

    def create_staging_table(self, project_id: int, dataset_id: int, change_request_id: int, 
                           rows: List[Dict[str, Any]]) -> str:
        """Create a staging Delta table for a change request.
        
        This table will hold data for review and validation before merging to main.
        """
        if pa is None:
            raise RuntimeError("pyarrow required for delta operations")
        
        path = self._staging_path(project_id, dataset_id, change_request_id)
        at = pa.Table.from_pylist(rows)
        
        os.makedirs(os.path.dirname(path), exist_ok=True)
        write_deltalake(path, at, mode="overwrite")
        
        logger.info(json.dumps({
            "event": "create_staging_table",
            "project_id": project_id,
            "dataset_id": dataset_id,
            "change_request_id": change_request_id,
            "rows": len(rows)
        }))
        
        return path

    def append_to_staging(self, project_id: int, dataset_id: int, change_request_id: int,
                         rows: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Append rows to an existing staging table."""
        if pa is None:
            raise RuntimeError("pyarrow required for delta operations")
        
        path = self._staging_path(project_id, dataset_id, change_request_id)
        at = pa.Table.from_pylist(rows)
        
        write_deltalake(path, at, mode="append")
        
        logger.info(json.dumps({
            "event": "append_to_staging",
            "project_id": project_id,
            "dataset_id": dataset_id,
            "change_request_id": change_request_id,
            "rows": len(rows)
        }))
        
        return {"ok": True, "inserted": len(rows)}

    def merge_staging_to_main(self, project_id: int, dataset_id: int, change_request_id: int,
                             keys: List[str]) -> Dict[str, Any]:
        """Merge a staging table into the main table.
        
        This is the approval action. After successful merge, the staging table is deleted.
        Uses upsert semantics based on provided keys.
        """
        if not keys:
            raise ValueError("keys are required for merge")
        
        main_path = self._main_path(project_id, dataset_id)
        staging_path = self._staging_path(project_id, dataset_id, change_request_id)
        
        if not os.path.exists(staging_path):
            raise ValueError(f"Staging table not found for change request {change_request_id}")
        
        # Use DuckDB-based merge (more reliable across versions)
        con = duckdb.connect()
        con.execute("INSTALL delta; LOAD delta;")
        con.execute(f"CREATE OR REPLACE VIEW tgt AS SELECT * FROM delta_scan('{main_path}')")
        con.execute(f"CREATE OR REPLACE VIEW src AS SELECT * FROM delta_scan('{staging_path}')")
        
        # Build upsert using DuckDB SQL
        key_cond = " AND ".join([f"tgt.\"{k}\" = src.\"{k}\"" for k in keys])
        all_cols = self._discover_columns(main_path, staging_path)
        select_src = ", ".join([f"src.\"{c}\" as \"{c}\"" for c in all_cols])
        select_tgt = ", ".join([f"tgt.\"{c}\" as \"{c}\"" for c in all_cols])
        
        upsert_sql = f"""
            SELECT {select_src} FROM src
            UNION ALL
            SELECT {select_tgt} FROM tgt
            WHERE NOT EXISTS (SELECT 1 FROM src WHERE {key_cond})
        """
        
        rel = con.execute(upsert_sql).fetch_arrow_table()
        write_deltalake(main_path, rel, mode="overwrite")
        method = "duckdb"
        
        # Delete staging table after successful merge
        shutil.rmtree(staging_path)
        
        logger.info(json.dumps({
            "event": "merge_staging_to_main",
            "project_id": project_id,
            "dataset_id": dataset_id,
            "change_request_id": change_request_id,
            "method": method,
            "keys": keys
        }))
        
        return {"ok": True, "method": method}

    def delete_staging_table(self, project_id: int, dataset_id: int, change_request_id: int):
        """Delete a staging table (e.g., after rejection or cleanup)."""
        path = self._staging_path(project_id, dataset_id, change_request_id)
        
        if os.path.exists(path):
            shutil.rmtree(path)
            logger.info(json.dumps({
                "event": "delete_staging_table",
                "project_id": project_id,
                "dataset_id": dataset_id,
                "change_request_id": change_request_id
            }))

    # ==================== Live Edit Operations ====================

    def create_live_edit_session(self, project_id: int, dataset_id: int, session_id: str) -> str:
        """Create a live edit session Delta table.
        
        Schema:
        - edit_id: STRING
        - session_id: STRING
        - row_id: STRING
        - column: STRING
        - old_value: STRING
        - new_value: STRING
        - user_id: STRING
        - ts: TIMESTAMP
        - validation: JSON (stored as STRING)
        """
        if pa is None:
            raise RuntimeError("pyarrow required for delta operations")
        
        path = self._live_edit_path(project_id, dataset_id, session_id)
        
        # Create schema for live edit table
        schema = pa.schema([
            pa.field("edit_id", pa.string()),
            pa.field("session_id", pa.string()),
            pa.field("row_id", pa.string()),
            pa.field("column", pa.string()),
            pa.field("old_value", pa.string()),
            pa.field("new_value", pa.string()),
            pa.field("user_id", pa.string()),
            pa.field("ts", pa.timestamp('us')),
            pa.field("validation", pa.string())  # JSON stored as string
        ])
        
        empty_table = pa.Table.from_arrays(
            [pa.array([], type=f.type) for f in schema],
            names=[f.name for f in schema]
        )
        
        os.makedirs(os.path.dirname(path), exist_ok=True)
        write_deltalake(path, empty_table, mode="overwrite")
        
        logger.info(json.dumps({
            "event": "create_live_edit_session",
            "project_id": project_id,
            "dataset_id": dataset_id,
            "session_id": session_id
        }))
        
        return path

    def append_live_edit(self, project_id: int, dataset_id: int, session_id: str,
                        edits: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Append cell edits to a live edit session."""
        if pa is None:
            raise RuntimeError("pyarrow required for delta operations")
        
        path = self._live_edit_path(project_id, dataset_id, session_id)
        at = pa.Table.from_pylist(edits)
        
        write_deltalake(path, at, mode="append")
        
        logger.info(json.dumps({
            "event": "append_live_edit",
            "project_id": project_id,
            "dataset_id": dataset_id,
            "session_id": session_id,
            "edits": len(edits)
        }))
        
        return {"ok": True, "edits_added": len(edits)}

    def delete_live_edit_session(self, project_id: int, dataset_id: int, session_id: str):
        """Delete a live edit session (after merge or TTL expiry)."""
        session_dir = os.path.dirname(self._live_edit_path(project_id, dataset_id, session_id))
        
        if os.path.exists(session_dir):
            shutil.rmtree(session_dir)
            logger.info(json.dumps({
                "event": "delete_live_edit_session",
                "project_id": project_id,
                "dataset_id": dataset_id,
                "session_id": session_id
            }))

    # ==================== Query Operations ====================

    def query_main(self, project_id: int, dataset_id: int, sql_where: Optional[str] = None,
                  limit: int = 100, offset: int = 0, filters: Optional[Dict[str, Any]] = None,
                  order_by: Optional[str] = None) -> Dict[str, Any]:
        """Query the main Delta table."""
        path = self._main_path(project_id, dataset_id)
        return self._query_table(path, sql_where, limit, offset, filters, order_by)

    def query_staging(self, project_id: int, dataset_id: int, change_request_id: int,
                     sql_where: Optional[str] = None, limit: int = 100, offset: int = 0,
                     filters: Optional[Dict[str, Any]] = None, order_by: Optional[str] = None) -> Dict[str, Any]:
        """Query a staging Delta table."""
        path = self._staging_path(project_id, dataset_id, change_request_id)
        return self._query_table(path, sql_where, limit, offset, filters, order_by)

    def query_live_edit(self, project_id: int, dataset_id: int, session_id: str,
                       sql_where: Optional[str] = None, limit: int = 100, offset: int = 0,
                       filters: Optional[Dict[str, Any]] = None, order_by: Optional[str] = None) -> Dict[str, Any]:
        """Query a live edit session table."""
        path = self._live_edit_path(project_id, dataset_id, session_id)
        return self._query_table(path, sql_where, limit, offset, filters, order_by)

    def _query_table(self, path: str, sql_where: Optional[str] = None, limit: int = 100,
                    offset: int = 0, filters: Optional[Dict[str, Any]] = None,
                    order_by: Optional[str] = None) -> Dict[str, Any]:
        """Internal query method for any Delta table."""
        con = duckdb.connect()
        con.execute("INSTALL delta;")
        con.execute("LOAD delta;")
        con.execute(f"CREATE OR REPLACE VIEW v AS SELECT * FROM delta_scan('{path}')")
        
        base_query = "SELECT * FROM v"
        clauses: List[str] = []
        
        if sql_where and sql_where.strip():
            clauses.append(sql_where)
        
        if filters:
            for k, v in filters.items():
                if v is None:
                    continue
                if isinstance(v, str):
                    esc = v.replace("'", "''")
                    clauses.append(f'"{k}" = \'' + esc + '\'')
                elif isinstance(v, bool):
                    clauses.append(f'"{k}" = {str(v).upper()}')
                else:
                    clauses.append(f'"{k}" = {v}')
        
        if clauses:
            base_query += " WHERE " + " AND ".join(clauses)
        
        if order_by and order_by.strip():
            base_query += f" ORDER BY {order_by}"
        
        base_query += f" LIMIT {limit} OFFSET {offset}"
        
        rel = con.execute(base_query).fetch_arrow_table()
        rows = [dict(zip(rel.column_names, r)) for r in zip(*[c.to_pylist() for c in rel.columns])]
        
        return {"columns": rel.column_names, "rows": rows, "count": len(rows)}

    def get_stats(self, project_id: int, dataset_id: int) -> Dict[str, Any]:
        """Get statistics about a Delta table.
        
        Returns:
            num_rows: Total number of rows in the table
            num_cols: Number of columns in the table
        """
        path = self._main_path(project_id, dataset_id)
        
        if not os.path.exists(os.path.join(path, "_delta_log")):
            return {"num_rows": 0, "num_cols": 0}
        
        try:
            dt = DeltaTable(path)
            at = dt.to_pyarrow_table()
            
            return {
                "num_rows": len(at),
                "num_cols": len(at.schema)
            }
        except Exception as e:
            logger.warn(f"Failed to get stats for {path}: {e}")
            return {"num_rows": 0, "num_cols": 0}

    # ==================== History & Versioning ====================

    def history(self, project_id: int, dataset_id: int) -> List[Dict[str, Any]]:
        """Get Delta table history for the main table."""
        dt = DeltaTable(self._main_path(project_id, dataset_id))
        hist = dt.history()
        
        logger.info(json.dumps({
            "event": "history",
            "project_id": project_id,
            "dataset_id": dataset_id,
            "entries": len(hist)
        }))
        
        return hist

    def get_latest_operation_stats(self, project_id: int, dataset_id: int) -> Dict[str, Any]:
        """Get operation metrics from the latest Delta table commit.
        
        Returns stats like rows_added, rows_updated, rows_deleted from Delta's
        operationMetrics in the transaction log.
        """
        path = self._main_path(project_id, dataset_id)
        
        try:
            dt = DeltaTable(path)
            hist = dt.history(limit=1)  # Get only the latest entry
            
            if not hist:
                return {"rows_added": 0, "rows_updated": 0, "rows_deleted": 0, "total_rows": 0}
            
            latest = hist[0]
            metrics = latest.get("operationMetrics", {})
            
            # Extract metrics based on operation type
            rows_added = 0
            rows_updated = 0
            rows_deleted = 0
            
            # For WRITE/append operations
            if "numOutputRows" in metrics:
                rows_added = int(metrics["numOutputRows"])
            
            # For MERGE operations
            if "numTargetRowsInserted" in metrics:
                rows_added = int(metrics["numTargetRowsInserted"])
            if "numTargetRowsUpdated" in metrics:
                rows_updated = int(metrics["numTargetRowsUpdated"])
            if "numTargetRowsDeleted" in metrics:
                rows_deleted = int(metrics["numTargetRowsDeleted"])
            
            # For RESTORE operations - calculate diff
            if latest.get("operation") == "RESTORE":
                # Get current row count
                total_rows = len(dt.to_pyarrow_table())
                return {
                    "rows_added": rows_added,
                    "rows_updated": rows_updated, 
                    "rows_deleted": rows_deleted,
                    "total_rows": total_rows,
                    "operation": "RESTORE",
                    "version": latest.get("version", 0)
                }
            
            # Get current total row count
            total_rows = len(dt.to_pyarrow_table())
            
            return {
                "rows_added": rows_added,
                "rows_updated": rows_updated,
                "rows_deleted": rows_deleted,
                "total_rows": total_rows,
                "operation": latest.get("operation", "UNKNOWN"),
                "version": latest.get("version", 0)
            }
            
        except Exception as e:
            logger.warn(f"Failed to get operation stats for {path}: {e}")
            return {"rows_added": 0, "rows_updated": 0, "rows_deleted": 0, "total_rows": 0}

    def read_at_version(self, project_id: int, dataset_id: int, version: int, 
                        limit: int = 50, offset: int = 0) -> Dict[str, Any]:
        """Read data from the main table at a specific version (time-travel).
        
        Uses delta-rs version parameter to load historical table state.
        Returns rows as a list of dicts plus metadata.
        """
        path = self._main_path(project_id, dataset_id)
        
        try:
            # Load Delta table at specific version
            dt = DeltaTable(path, version=version)
            
            # Get total row count at this version
            full_table = dt.to_pyarrow_table()
            total_rows = full_table.num_rows
            columns = [f.name for f in full_table.schema]
            
            # Apply pagination by slicing the table
            if offset >= total_rows:
                data = []
            else:
                end = min(offset + limit, total_rows)
                sliced = full_table.slice(offset, end - offset)
                data = sliced.to_pylist()
            
            logger.info(json.dumps({
                "event": "read_at_version",
                "project_id": project_id,
                "dataset_id": dataset_id,
                "version": version,
                "offset": offset,
                "limit": limit,
                "returned": len(data),
                "total": total_rows
            }))
            
            return {
                "columns": columns,
                "data": data,
                "total": total_rows,
                "limit": limit,
                "offset": offset,
                "version": version
            }
            
        except Exception as e:
            logger.error(f"Failed to read at version {version}: {e}")
            raise ValueError(f"Cannot read version {version}: {str(e)}")

    def restore(self, project_id: int, dataset_id: int, version: int) -> Dict[str, Any]:
        """Restore the main table to a previous version using delta-rs.
        
        Safety checks:
        - Validates that the version exists
        - Returns error if files have been removed by VACUUM
        
        Returns stats about the restore operation including new row count.
        """
        path = self._main_path(project_id, dataset_id)
        
        try:
            dt = DeltaTable(path)
            
            # Get current row count before restore
            rows_before = len(dt.to_pyarrow_table())
            
            # Get history to validate version exists
            history = dt.history()
            if version < 0 or version >= len(history):
                raise ValueError(f"Version {version} does not exist. Available versions: 0-{len(history)-1}")
            
            # Use delta-rs native restore (writes version as new commit)
            dt.restore(version)
            
            # Reload to get new state
            dt = DeltaTable(path)
            rows_after = len(dt.to_pyarrow_table())
            
            # Calculate diff
            rows_added = max(0, rows_after - rows_before)
            rows_deleted = max(0, rows_before - rows_after)
            
            logger.info(json.dumps({
                "event": "restore",
                "project_id": project_id,
                "dataset_id": dataset_id,
                "version": version,
                "rows_before": rows_before,
                "rows_after": rows_after,
                "method": "delta-rs"
            }))
            
            return {
                "ok": True,
                "restored_to": version,
                "method": "delta-rs",
                "rows_before": rows_before,
                "rows_after": rows_after,
                "rows_added": rows_added,
                "rows_deleted": rows_deleted,
                "total_rows": rows_after
            }
            
        except Exception as e:
            error_msg = str(e)
            if "not found" in error_msg.lower() or "vacuum" in error_msg.lower():
                raise ValueError(f"Version {version} not restorable: files may have been deleted by VACUUM")
            raise

    # ==================== Helper Methods ====================

    def _align_to_existing_schema(self, path: str, at: pa.Table) -> pa.Table:
        """Align an Arrow table to match existing Delta table schema."""
        con = duckdb.connect()
        con.execute("INSTALL delta; LOAD delta;")
        ti = con.execute(f"PRAGMA table_info(delta_scan('{path}'))").fetchall()
        
        target_cols = []
        for r in ti:
            col = r[0]
            t = str(r[1]).upper() if len(r) > 1 else "VARCHAR"
            
            if t in ("VARCHAR", "TEXT", "STRING"):
                dtype = pa.string()
            elif t in ("BIGINT", "INTEGER", "INT", "INT64"):
                dtype = pa.int64()
            elif t in ("DOUBLE", "FLOAT", "FLOAT8", "FLOAT64", "REAL"):
                dtype = pa.float64()
            elif t in ("BOOLEAN", "BOOL"):
                dtype = pa.bool_()
            else:
                dtype = pa.string()
            
            target_cols.append((col, dtype))
        
        arrays = []
        names = []
        existing_cols = {n: at.column(n) for n in at.column_names}
        
        for col, dtype in target_cols:
            if col in existing_cols:
                arr = existing_cols[col]
                if arr.type != dtype:
                    try:
                        if pa.types.is_string(dtype):
                            arr = pa.array([None if v is None else str(v) for v in arr.to_pylist()], type=pa.string())
                        else:
                            arr = pc.cast(arr, dtype)
                    except Exception:
                        arr = pa.array([None if v is None else str(v) for v in arr.to_pylist()], type=pa.string())
                arrays.append(arr)
                names.append(col)
            else:
                arrays.append(pa.nulls(len(at), type=dtype))
                names.append(col)
        
        return pa.Table.from_arrays(arrays, names=names)

    def _handle_schema_mismatch(self, path: str, at: pa.Table) -> pa.Table:
        """Handle schema mismatch by checking if table is empty and allowing evolution."""
        try:
            dt = DeltaTable(path)
            is_empty = dt.to_pyarrow_table().num_rows == 0
        except Exception:
            is_empty = False
        
        if is_empty:
            write_deltalake(path, at, mode="overwrite")
            return at
        else:
            # Retry with schema alignment
            return self._align_to_existing_schema(path, at)

    def _discover_columns(self, target_path: str, stage_path: str) -> List[str]:
        """Discover union of column names across target and source tables."""
        con = duckdb.connect()
        con.execute("INSTALL delta; LOAD delta;")
        
        tgt_cols = []
        if os.path.exists(os.path.join(target_path, "_delta_log")):
            # Query the Delta table to get columns
            tgt_result = con.execute(f"SELECT * FROM delta_scan('{target_path}') LIMIT 0").description
            tgt_cols = [col[0] for col in tgt_result]
        
        # Query the staging Delta table to get columns
        src_result = con.execute(f"SELECT * FROM delta_scan('{stage_path}') LIMIT 0").description
        src_cols = [col[0] for col in src_result]
        
        cols = sorted(set(tgt_cols) | set(src_cols))
        return cols

    # ==================== Legacy Methods (for backward compatibility) ====================

    def ensure_table(self, name: str, arrow_table: Any) -> str:
        """Legacy method for backward compatibility."""
        path = self._table_path(name)
        if not os.path.exists(path):
            write_deltalake(path, arrow_table, mode="overwrite")
        return path

    def ensure_empty_table(self, name: str, schema: Dict[str, Any]) -> str:
        """Legacy method for backward compatibility."""
        path = self._table_path(name)
        if os.path.exists(path) and os.path.isdir(path) and os.path.exists(os.path.join(path, "_delta_log")):
            return path
        
        if pa is None:
            raise RuntimeError("pyarrow required for delta operations")
        
        props = {}
        if isinstance(schema, dict):
            if "properties" in schema and isinstance(schema["properties"], dict):
                props = schema["properties"]
            else:
                props = schema
        
        fields = []
        type_map = {
            "string": pa.string(),
            "integer": pa.int64(),
            "number": pa.float64(),
            "boolean": pa.bool_(),
        }
        
        for col, meta in (props or {}).items():
            atype = None
            if isinstance(meta, dict):
                tval = meta.get("type")
                if isinstance(tval, list):
                    tval = next((x for x in tval if x != "null"), tval[0] if tval else "string")
                if isinstance(tval, str):
                    atype = type_map.get(tval.lower())
            if atype is None:
                atype = pa.string()
            fields.append(pa.field(col, atype))
        
        if not fields:
            fields = [pa.field("_auto", pa.string())]
        
        schema_obj = pa.schema(fields)
        empty_table = pa.Table.from_arrays(
            [pa.array([], type=f.type) for f in schema_obj],
            names=[f.name for f in schema_obj]
        )
        
        os.makedirs(path, exist_ok=True)
        write_deltalake(path, empty_table, mode="overwrite")
        
        logger.info(json.dumps({"event": "ensure_empty", "table": name, "columns": [f.name for f in schema_obj]}))
        
        return path

    def append_rows(self, name: str, rows: List[Dict[str, Any]]):
        """Legacy method for backward compatibility."""
        if pa is None:
            raise RuntimeError("pyarrow required for delta operations")
        
        at = pa.Table.from_pylist(rows)
        path = self._table_path(name)
        
        try:
            if os.path.exists(os.path.join(path, "_delta_log")):
                at = self._align_to_existing_schema(path, at)
        except Exception:
            pass
        
        try:
            write_deltalake(path, at, mode="append")
        except ValueError as e:
            if "Schema of data does not match" in str(e):
                at = self._handle_schema_mismatch(path, at)
            else:
                raise
        
        logger.info(json.dumps({"event": "append", "table": name, "rows": len(rows)}))
        return {"ok": True, "inserted": len(rows)}

    def overwrite(self, name: str, rows: List[Dict[str, Any]]):
        """Legacy method for backward compatibility."""
        if pa is None:
            raise RuntimeError("pyarrow required for delta operations")
        
        at = pa.Table.from_pylist(rows)
        path = self._table_path(name)
        write_deltalake(path, at, mode="overwrite")
        
        logger.info(json.dumps({"event": "overwrite", "table": name, "rows": len(rows)}))
        return {"ok": True, "replaced": len(rows)}

    def query(self, name: str, sql_where: Optional[str] = None, limit: int = 100, offset: int = 0,
              filters: Optional[Dict[str, Any]] = None, order_by: Optional[str] = None) -> Dict[str, Any]:
        """Legacy method for backward compatibility."""
        path = self._table_path(name)
        return self._query_table(path, sql_where, limit, offset, filters, order_by)

    def merge(self, name: str, rows: Optional[List[Dict[str, Any]]] = None, keys: Optional[List[str]] = None,
              staging_path: Optional[str] = None) -> Dict[str, Any]:
        """Legacy merge method for backward compatibility."""
        if keys is None or len(keys) == 0:
            raise ValueError("keys are required for merge")
        
        target_path = self._table_path(name)
        
        if staging_path:
            stage_path = staging_path
        else:
            if pa is None:
                raise RuntimeError("pyarrow required for delta operations")
            
            at = pa.Table.from_pylist(rows or [])
            tmpdir = tempfile.mkdtemp(prefix="delta_stage_")
            stage_path = os.path.join(tmpdir, str(uuid.uuid4()))
            write_deltalake(stage_path, at, mode="overwrite")
        
        # Use DuckDB-based merge
        con = duckdb.connect()
        con.execute("INSTALL delta; LOAD delta;")
        con.execute(f"CREATE OR REPLACE VIEW tgt AS SELECT * FROM delta_scan('{target_path}')")
        con.execute(f"CREATE OR REPLACE VIEW src AS SELECT * FROM delta_scan('{stage_path}')")
        
        key_cond = " AND ".join([f"tgt.\"{k}\" = src.\"{k}\"" for k in keys])
        all_cols = self._discover_columns(target_path, stage_path)
        select_src = ", ".join([f"src.\"{c}\" as \"{c}\"" for c in all_cols])
        select_tgt = ", ".join([f"tgt.\"{c}\" as \"{c}\"" for c in all_cols])
        
        upsert_sql = f"""
            SELECT {select_src} FROM src
            UNION ALL
            SELECT {select_tgt} FROM tgt
            WHERE NOT EXISTS (SELECT 1 FROM src WHERE {key_cond})
        """
        
        rel = con.execute(upsert_sql).fetch_arrow_table()
        write_deltalake(target_path, rel, mode="overwrite")
        
        logger.info(json.dumps({"event": "merge", "table": name, "keys": keys, "method": "duckdb"}))
        return {"ok": True, "method": "duckdb"}


    # ==================== Legacy Methods (for backward compatibility) ====================

    def ensure_table(self, name: str, arrow_table: Any) -> str:
        """Legacy method for backward compatibility."""
        path = self._table_path(name)
        if not os.path.exists(path):
            write_deltalake(path, arrow_table, mode="overwrite")
        return path

    def ensure_empty_table(self, name: str, schema: Dict[str, Any]) -> str:
        """Legacy method for backward compatibility."""
        path = self._table_path(name)
        if os.path.exists(path) and os.path.isdir(path) and os.path.exists(os.path.join(path, "_delta_log")):
            return path
        
        if pa is None:
            raise RuntimeError("pyarrow required for delta operations")
        
        props = {}
        if isinstance(schema, dict):
            if "properties" in schema and isinstance(schema["properties"], dict):
                props = schema["properties"]
            else:
                props = schema
        
        fields = []
        type_map = {
            "string": pa.string(),
            "integer": pa.int64(),
            "number": pa.float64(),
            "boolean": pa.bool_(),
        }
        
        for col, meta in (props or {}).items():
            atype = None
            if isinstance(meta, dict):
                tval = meta.get("type")
                if isinstance(tval, list):
                    tval = next((x for x in tval if x != "null"), tval[0] if tval else "string")
                if isinstance(tval, str):
                    atype = type_map.get(tval.lower())
            if atype is None:
                atype = pa.string()
            fields.append(pa.field(col, atype))
        
        if not fields:
            fields = [pa.field("_auto", pa.string())]
        
        schema_obj = pa.schema(fields)
        empty_table = pa.Table.from_arrays(
            [pa.array([], type=f.type) for f in schema_obj],
            names=[f.name for f in schema_obj]
        )
        
        os.makedirs(path, exist_ok=True)
        write_deltalake(path, empty_table, mode="overwrite")
        
        logger.info(json.dumps({"event": "ensure_empty", "table": name, "columns": [f.name for f in schema_obj]}))
        
        return path

    def append_rows(self, name: str, rows: List[Dict[str, Any]]):
        """Legacy method for backward compatibility."""
        if pa is None:
            raise RuntimeError("pyarrow required for delta operations")
        
        at = pa.Table.from_pylist(rows)
        path = self._table_path(name)
        
        try:
            if os.path.exists(os.path.join(path, "_delta_log")):
                at = self._align_to_existing_schema(path, at)
        except Exception:
            pass
        
        try:
            write_deltalake(path, at, mode="append")
        except ValueError as e:
            if "Schema of data does not match" in str(e):
                at = self._handle_schema_mismatch(path, at)
            else:
                raise
        
        logger.info(json.dumps({"event": "append", "table": name, "rows": len(rows)}))
        return {"ok": True, "inserted": len(rows)}

    def overwrite(self, name: str, rows: List[Dict[str, Any]]):
        """Legacy method for backward compatibility."""
        if pa is None:
            raise RuntimeError("pyarrow required for delta operations")
        
        at = pa.Table.from_pylist(rows)
        path = self._table_path(name)
        write_deltalake(path, at, mode="overwrite")
        
        logger.info(json.dumps({"event": "overwrite", "table": name, "rows": len(rows)}))
        return {"ok": True, "replaced": len(rows)}

    def query(self, name: str, sql_where: Optional[str] = None, limit: int = 100, offset: int = 0,
              filters: Optional[Dict[str, Any]] = None, order_by: Optional[str] = None) -> Dict[str, Any]:
        """Legacy method for backward compatibility."""
        path = self._table_path(name)
        return self._query_table(path, sql_where, limit, offset, filters, order_by)

    def merge(self, name: str, rows: Optional[List[Dict[str, Any]]] = None, keys: Optional[List[str]] = None,
              staging_path: Optional[str] = None) -> Dict[str, Any]:
        """Legacy merge method for backward compatibility."""
        if keys is None or len(keys) == 0:
            raise ValueError("keys are required for merge")
        
        target_path = self._table_path(name)
        
        if staging_path:
            stage_path = staging_path
        else:
            if pa is None:
                raise RuntimeError("pyarrow required for delta operations")
            
            at = pa.Table.from_pylist(rows or [])
            tmpdir = tempfile.mkdtemp(prefix="delta_stage_")
            stage_path = os.path.join(tmpdir, str(uuid.uuid4()))
            write_deltalake(stage_path, at, mode="overwrite")
        
        try:
            tgt = DeltaTable(target_path)
            src = DeltaTable(stage_path)
            pred = " AND ".join([f"t.\"{k}\" = s.\"{k}\"" for k in keys])
            
            (tgt.alias("t")
                .merge(src.alias("s"), pred)
                .when_matched_update_all()
                .when_not_matched_insert_all()
                .execute())
            
            logger.info(json.dumps({"event": "merge", "table": name, "keys": keys, "method": "native"}))
            return {"ok": True, "method": "native"}
        
        except Exception as e:
            con = duckdb.connect()
            con.execute("INSTALL delta; LOAD delta;")
            con.execute(f"CREATE OR REPLACE VIEW tgt AS SELECT * FROM delta_scan('{target_path}')")
            con.execute(f"CREATE OR REPLACE VIEW src AS SELECT * FROM delta_scan('{stage_path}')")
            
            key_cond = " AND ".join([f"tgt.\"{k}\" = src.\"{k}\"" for k in keys])
            all_cols = self._discover_columns(target_path, stage_path)
            select_src = ", ".join([f"src.\"{c}\" as \"{c}\"" for c in all_cols])
            select_tgt = ", ".join([f"tgt.\"{c}\" as \"{c}\"" for c in all_cols])
            
            upsert_sql = f"""
                SELECT {select_src} FROM src
                UNION ALL
                SELECT {select_tgt} FROM tgt
                WHERE NOT EXISTS (SELECT 1 FROM src WHERE {key_cond})
            """
            
            rel = con.execute(upsert_sql).fetch_arrow_table()
            write_deltalake(target_path, rel, mode="overwrite")
            
            logger.info(json.dumps({"event": "merge", "table": name, "keys": keys, "method": "fallback", "error": str(e)}))
            return {"ok": True, "method": "fallback"}
