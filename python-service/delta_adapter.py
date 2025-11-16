from __future__ import annotations
import os
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass
import json
import logging
import tempfile
import uuid

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
    """Lightweight adapter around delta-rs (deltalake) + DuckDB for queries.

    - Writes use write_deltalake (append/overwrite/merge via upsert helpers)
    - Reads/queries use embedded DuckDB with the delta scan extension.
    """

    def __init__(self, config: Optional[DeltaConfig] = None):
        self.cfg = config or DeltaConfig.from_env()

    def _table_path(self, name: str) -> str:
        # Name -> path mapping; could namespace by project later
        safe = name.replace("/", "_")
        return os.path.join(self.cfg.root, safe)

    def ensure_table(self, name: str, arrow_table: Any) -> str:
        path = self._table_path(name)
        if not os.path.exists(path):
            write_deltalake(path, arrow_table, mode="overwrite")
        return path

    def ensure_empty_table(self, name: str, schema: Dict[str, Any]) -> str:
        """Create an empty Delta table with provided JSON schema if it does not exist.

        The schema is a JSON Schema-like mapping; we convert its properties to Arrow fields.
        Unrecognized or missing types default to string.
        """
        path = self._table_path(name)
        if os.path.exists(path) and os.path.isdir(path) and os.path.exists(os.path.join(path, "_delta_log")):
            return path  # already exists
        if pa is None:
            raise RuntimeError("pyarrow required for delta operations")
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
        empty_table = pa.Table.from_arrays([pa.array([], type=f.type) for f in schema_obj], names=[f.name for f in schema_obj])
        # Ensure parent directory exists
        os.makedirs(path, exist_ok=True)
        write_deltalake(path, empty_table, mode="overwrite")
        logger.info(json.dumps({"event": "ensure_empty", "table": name, "columns": [f.name for f in schema_obj]}))
        return path

    def append_rows(self, name: str, rows: List[Dict[str, Any]]):
        if pa is None:
            raise RuntimeError("pyarrow required for delta operations")
        at = pa.Table.from_pylist(rows)
        path = self._table_path(name)
        # If table exists, coerce incoming columns to match existing schema where possible
        try:
            if os.path.exists(os.path.join(path, "_delta_log")):
                # Discover target schema using DuckDB (robust across delta-rs versions)
                con = duckdb.connect()
                con.execute("INSTALL delta; LOAD delta;")
                ti = con.execute(f"PRAGMA table_info(delta_scan('{path}'))").fetchall()
                # ti rows: [column_name, column_type, ...]
                target_cols = []  # list of (name, pa.DataType)
                for r in ti:
                    col = r[0]
                    t = str(r[1]).upper() if len(r) > 1 else "VARCHAR"
                    if t in ("VARCHAR", "TEXT", "STRING"):
                        target_cols.append((col, pa.string()))
                    elif t in ("BIGINT", "INTEGER", "INT", "INT64"):
                        target_cols.append((col, pa.int64()))
                    elif t in ("DOUBLE", "FLOAT", "FLOAT8", "FLOAT64", "REAL"):
                        target_cols.append((col, pa.float64()))
                    elif t in ("BOOLEAN", "BOOL"):
                        target_cols.append((col, pa.bool_()))
                    else:
                        # default to string for unknown types
                        target_cols.append((col, pa.string()))
                # Build arrays in target order, casting where feasible; fill missing with nulls
                arrays = []
                names = []
                existing_cols = {n: at.column(n) for n in at.column_names}
                for col, dtype in target_cols:
                    if col in existing_cols:
                        arr = existing_cols[col]
                        if arr.type != dtype:
                            try:
                                if pa.types.is_string(dtype):
                                    # Ensure canonical utf8 (not large_string)
                                    arr = pa.array([None if v is None else str(v) for v in arr.to_pylist()], type=pa.string())
                                else:
                                    arr = pc.cast(arr, dtype)
                            except Exception:
                                # Last resort: cast to canonical string
                                arr = pa.array([None if v is None else str(v) for v in arr.to_pylist()], type=pa.string())
                        arrays.append(arr)
                        names.append(col)
                    else:
                        arrays.append(pa.nulls(len(at), type=dtype))
                        names.append(col)
                at = pa.Table.from_arrays(arrays, names=names)
        except Exception:
            # If any of the above discovery/casts fail, proceed with original table and let writer validate
            pass
        try:
            write_deltalake(path, at, mode="append")
        except ValueError as e:
            mismatch = "Schema of data does not match" in str(e)
            if not mismatch:
                raise
            # If table currently empty (only ensures) allow schema evolution by overwriting with data schema
            try:
                dt = DeltaTable(path)
                is_empty = dt.to_pyarrow_table().num_rows == 0
            except Exception:
                is_empty = False
            if is_empty:
                write_deltalake(path, at, mode="overwrite")
            else:
                # Retry once by coercing columns to existing schema
                try:
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
                    at2 = pa.Table.from_arrays(arrays, names=names)
                    write_deltalake(path, at2, mode="append")
                except Exception:
                    raise
        logger.info(json.dumps({"event": "append", "table": name, "rows": len(rows)}))
        return {"ok": True, "inserted": len(rows)}

    def overwrite(self, name: str, rows: List[Dict[str, Any]]):
        if pa is None:
            raise RuntimeError("pyarrow required for delta operations")
        at = pa.Table.from_pylist(rows)
        path = self._table_path(name)
        write_deltalake(path, at, mode="overwrite")
        logger.info(json.dumps({"event": "overwrite", "table": name, "rows": len(rows)}))
        return {"ok": True, "replaced": len(rows)}

    def history(self, name: str) -> List[Dict[str, Any]]:
        dt = DeltaTable(self._table_path(name))
        hist = dt.history()
        # history returns list of dicts already json-serializable
        logger.info(json.dumps({"event": "history", "table": name, "entries": len(hist)}))
        return hist

    def restore(self, name: str, version: int):
        # Simple restore by reading older version and overwriting head
        dt = DeltaTable(self._table_path(name))
        if pa is None:
            raise RuntimeError("pyarrow required for delta operations")
        # load older snapshot into Arrow then overwrite
        at = dt.to_pyarrow_table(version=version)
        write_deltalake(self._table_path(name), at, mode="overwrite")
        logger.info(json.dumps({"event": "restore", "table": name, "version": version}))
        return {"ok": True, "restored_to": version}

    def query(self, name: str, sql_where: Optional[str] = None, limit: int = 100, offset: int = 0,
              filters: Optional[Dict[str, Any]] = None, order_by: Optional[str] = None) -> Dict[str, Any]:
        con = duckdb.connect()
        # Enable delta native scan
        con.execute("INSTALL delta;")
        con.execute("LOAD delta;")
        path = self._table_path(name)
        con.execute(f"CREATE OR REPLACE VIEW v AS SELECT * FROM delta_scan('{path}')")
        base_query = "SELECT * FROM v"
        clauses: List[str] = []
        if sql_where and sql_where.strip():
            clauses.append(sql_where)
        if filters:
            # Simple equality filters only for now
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
        out = {"columns": rel.column_names, "rows": rows, "count": len(rows)}
        logger.info(json.dumps({"event": "query", "table": name, "limit": limit, "offset": offset, "returned": len(rows)}))
        return out

    # --------------- Merge support ---------------
    def merge(self, name: str, rows: Optional[List[Dict[str, Any]]] = None, keys: Optional[List[str]] = None,
              staging_path: Optional[str] = None) -> Dict[str, Any]:
        """Upsert semantics using DeltaTable.merge if available; otherwise fallback overwrite by join.

        rows: optional list of dicts to stage for merge
        keys: list of column names composing primary key
        staging_path: optional external delta table path to merge from
        """
        if keys is None or len(keys) == 0:
            raise ValueError("keys are required for merge")
        target_path = self._table_path(name)
        # Prepare staging delta table
        if staging_path:
            stage_path = staging_path
        else:
            if pa is None:
                raise RuntimeError("pyarrow required for delta operations")
            at = pa.Table.from_pylist(rows or [])
            tmpdir = tempfile.mkdtemp(prefix="delta_stage_")
            stage_path = os.path.join(tmpdir, str(uuid.uuid4()))
            write_deltalake(stage_path, at, mode="overwrite")
        # Try native merge
        try:
            tgt = DeltaTable(target_path)
            src = DeltaTable(stage_path)
            # Build predicate like: t.k1 = s.k1 AND t.k2 = s.k2
            pred = " AND ".join([f"t.\"{k}\" = s.\"{k}\"" for k in keys])
            (tgt.alias("t")
                .merge(src.alias("s"), pred)
                .when_matched_update_all()
                .when_not_matched_insert_all()
                .execute())
            logger.info(json.dumps({"event": "merge", "table": name, "keys": keys, "method": "native"}))
            return {"ok": True, "method": "native"}
        except Exception as e:
            # Fallback: materialize both into DuckDB and rebuild target with upserted rows
            con = duckdb.connect()
            con.execute("INSTALL delta; LOAD delta;")
            con.execute(f"CREATE OR REPLACE VIEW tgt AS SELECT * FROM delta_scan('{target_path}')")
            con.execute(f"CREATE OR REPLACE VIEW src AS SELECT * FROM delta_scan('{stage_path}')")
            # Build upsert using DuckDB SQL
            key_cond = " AND ".join([f"tgt.\"{k}\" = src.\"{k}\"" for k in keys])
            all_cols = self._discover_columns(target_path, stage_path)
            select_src = ", ".join([f"src.\"{c}\" as \"{c}\"" for c in all_cols])
            select_tgt = ", ".join([f"tgt.\"{c}\" as \"{c}\"" for c in all_cols])
            # rows present in src override target on key match; union with non-matched target rows
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

    def _discover_columns(self, target_path: str, stage_path: str) -> List[str]:
        # union of column names across target and source
        con = duckdb.connect()
        con.execute("INSTALL delta; LOAD delta;")
        tgt_cols = [r[0] for r in con.execute(f"PRAGMA table_info(delta_scan('{target_path}'))").fetchall()] if os.path.exists(os.path.join(target_path, "_delta_log")) else []
        src_cols = [r[0] for r in con.execute(f"PRAGMA table_info(delta_scan('{stage_path}'))").fetchall()]
        cols = sorted(set(tgt_cols) | set(src_cols))
        return cols
