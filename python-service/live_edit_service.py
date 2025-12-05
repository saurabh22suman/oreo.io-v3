"""
Live Edit Service for Oreo.io

Implements Live Edit session management and cell editing logic.

This service handles:
- Session lifecycle (create, read, delete)
- Cell editing with validation
- Grid data overlay (base + edits)
- Preview generation
- Integration with Change Request system
"""

import json
import logging
import uuid
import os
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

try:
    import duckdb
    import pyarrow as pa
except ImportError:
    duckdb = None
    pa = None

# Import centralized DuckDB connection pool
try:
    from duckdb_pool import get_connection as get_duckdb_connection
except ImportError:
    def get_duckdb_connection():
        con = duckdb.connect()
        con.execute("INSTALL delta; LOAD delta;")
        return con

from live_edit_models import (
    LiveEditSession,
    SessionMode,
    SessionStatus,
    CellEdit,
    CellEditRequest,
    BulkEditRequest,
    PreviewSummary,
    StartSessionRequest,
    StartSessionResponse,
    EditResponse,
    GridDataRequest,
    GridDataResponse,
    GridColumn,
    GridRow,
    SessionStatistics,
    calculate_session_expiry,
)
from validation_service import ValidationService

logger = logging.getLogger("live_edit_service")


class LiveEditService:
    """
    Service layer for Live Edit operations
    
    Integrates with:
    - Delta Lake storage adapter
    - Validation service
    - Change Request service
    """
    
    def __init__(self, delta_root: str = "/data/delta"):
        self.delta_root = delta_root
        self.validation_service = ValidationService(delta_root)
        # In-memory storage for demo (replace with DB)
        self._sessions: Dict[str, LiveEditSession] = {}
        self._edits: Dict[str, List[CellEdit]] = {}  # session_id -> edits
    
    def _generate_session_id(self) -> str:
        """Generate unique session ID"""
        return f"sess_{uuid.uuid4().hex[:12]}"
    
    def _generate_edit_id(self) -> str:
        """Generate unique edit ID"""
        return f"edit_{uuid.uuid4().hex[:12]}"
    
    def _get_dataset_path(self, project_id: str, dataset_id: str) -> str:
        """Get path to dataset root"""
        return os.path.join(
            self.delta_root,
            "projects",
            project_id,
            "datasets",
            dataset_id
        )
    
    def _get_editable_columns(self, dataset_id: str) -> Tuple[List[str], Dict[str, List[Dict]]]:
        """
        Get editable columns and their rules for a dataset
        
        Returns: (editable_columns, rules_map)
        """
        # TODO: Load from metadata database or dataset schema
        # For now, return a simple example
        editable_columns = ["amount", "status", "description"]
        rules_map = {
            "amount": [
                {"type": "min", "value": 0},
                {"type": "max", "value": 1000000}
            ],
            "status": [
                {"type": "allowed_values", "values": ["pending", "approved", "rejected"]}
            ]
        }
        return editable_columns, rules_map
    
    def start_session(
        self,
        request: StartSessionRequest,
        project_id: str,
        dataset_id: str
    ) -> StartSessionResponse:
        """
        Start a new live edit session
        
        Steps:
        1. Generate session ID
        2. Create staging path
        3. Get editable columns and rules
        4. Initialize session
        5. Return session metadata
        """
        session_id = self._generate_session_id()
        
        # Create staging path
        dataset_path = self._get_dataset_path(project_id, dataset_id)
        staging_path = os.path.join(dataset_path, "live_edit", session_id)
        
        # Get editable columns and rules
        editable_columns, rules_map = self._get_editable_columns(dataset_id)
        
        # Create session
        session = LiveEditSession(
            session_id=session_id,
            dataset_id=dataset_id,
            project_id=project_id,
            user_id=request.user_id,
            mode=request.mode,
            selected_rows=request.rows if request.mode == SessionMode.ROW_SELECTION else [],
            staging_path=staging_path,
            editable_columns=editable_columns,
            rules_map=rules_map,
            expires_at=calculate_session_expiry()
        )
        
        # Store session
        self._sessions[session_id] = session
        self._edits[session_id] = []
        
        # Get sample rows (first 10)
        sample_rows = self._get_sample_rows(project_id, dataset_id, limit=10)
        
        logger.info(json.dumps({
            "event": "live_session_created",
            "session_id": session_id,
            "user_id": request.user_id,
            "dataset_id": dataset_id,
            "mode": request.mode.value
        }))
        
        return StartSessionResponse(
            session_id=session_id,
            staging_path=staging_path,
            editable_columns=editable_columns,
            rules_map=rules_map,
            sample_rows=sample_rows,
            expires_at=session.expires_at.isoformat()
        )
    
    def _get_sample_rows(
        self,
        project_id: str,
        dataset_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get sample rows from dataset"""
        try:
            if duckdb is None:
                return []
            
            main_path = os.path.join(
                self._get_dataset_path(project_id, dataset_id),
                "main"
            )
            
            if not os.path.exists(main_path):
                return []
            
            con = get_duckdb_connection()
            
            result = con.execute(
                f"SELECT * FROM delta_scan('{main_path}') LIMIT {limit}"
            ).fetch_arrow_table()
            
            return result.to_pylist()
            
        except Exception as e:
            logger.error(f"Failed to get sample rows: {e}")
            return []
    
    def get_session(self, session_id: str) -> Optional[LiveEditSession]:
        """Get session by ID"""
        return self._sessions.get(session_id)
    
    def save_cell_edit(
        self,
        session_id: str,
        request: CellEditRequest,
        user_id: str
    ) -> EditResponse:
        """
        Save a single cell edit
        
        Steps:
        1. Validate session exists and is active
        2. Check column is editable
        3. Get old value from base table
        4. Run validation
        5. Save edit to session_edits
        6. Return validation result
        """
        # Get session
        session = self.get_session(session_id)
        if not session:
            return EditResponse(
                status="error",
                validation={"valid": False, "messages": ["Session not found"]}
            )
        
        # Check session can be edited
        if not session.can_edit():
            return EditResponse(
                status="error",
                validation={"valid": False, "messages": ["Session is not editable"]}
            )
        
        # Check column is editable
        if request.column not in session.editable_columns:
            return EditResponse(
                status="error",
                validation={"valid": False, "messages": [f"Column '{request.column}' is not editable"]}
            )
        
        # Get old value (simplified - should query from base table)
        old_value = None  # TODO: Query actual old value
        
        # Run validation (safely handle string IDs)
        try:
            project_id_int = int(session.project_id) if session.project_id.isdigit() else 1
            dataset_id_int = int(session.dataset_id) if session.dataset_id.isdigit() else 1
        except (ValueError, AttributeError):
            project_id_int = 1
            dataset_id_int = 1
        
        validation_result = self.validation_service.validate_cell(
            project_id_int,
            dataset_id_int,
            request.row_id,
            request.column,
            request.new_value
        )
        
        # Create edit record
        edit_id = self._generate_edit_id()
        edit = CellEdit(
            edit_id=edit_id,
            session_id=session_id,
            row_id=request.row_id,
            column=request.column,
            old_value=old_value,
            new_value=request.new_value,
            user_id=user_id,
            client_ts=datetime.fromisoformat(request.client_ts) if request.client_ts else None,
            validation=validation_result.dict(),
            is_valid=validation_result.valid
        )
        
        # Store edit
        if session_id not in self._edits:
            self._edits[session_id] = []
        self._edits[session_id].append(edit)
        
        # Update session statistics
        session.edit_count = len(self._edits[session_id])
        stats = SessionStatistics.calculate_statistics(self._edits[session_id])
        session.cells_changed = stats["cells_changed"]
        session.rows_affected = stats["rows_affected"]
        session.updated_at = datetime.utcnow()
        
        logger.info(json.dumps({
            "event": "edit_saved",
            "session_id": session_id,
            "edit_id": edit_id,
            "row_id": request.row_id,
            "column": request.column,
            "valid": edit.is_valid
        }))
        
        return EditResponse(
            status="ok" if edit.is_valid else "error",
            validation=validation_result.dict(),
            edit_id=edit_id
        )
    
    def save_bulk_edits(
        self,
        session_id: str,
        request: BulkEditRequest,
        user_id: str
    ) -> Dict[str, Any]:
        """Save multiple edits in batch"""
        results = []
        
        for edit_req in request.edits:
            result = self.save_cell_edit(session_id, edit_req, user_id)
            results.append({
                "edit_id": result.edit_id,
                "valid": result.validation.get("valid", False),
                "messages": result.validation.get("messages", [])
            })
        
        return {"results": results}
    
    def get_grid_data(
        self,
        project_id: str,
        dataset_id: str,
        request: GridDataRequest
    ) -> GridDataResponse:
        """
        Get paginated grid data with optional session overlay
        
        If session_id provided, overlay edits on top of base data.
        """
        try:
            if duckdb is None:
                raise RuntimeError("DuckDB required for grid data")
            
            main_path = os.path.join(
                self._get_dataset_path(project_id, dataset_id),
                "main"
            )
            
            if not os.path.exists(main_path):
                return GridDataResponse(
                    meta={"page": request.page, "limit": request.limit, "total": 0},
                    columns=[],
                    rows=[]
                )
            
            con = get_duckdb_connection()
            
            # Get base data with pagination
            offset = (request.page - 1) * request.limit
            
            # Build query
            query = f"SELECT * FROM delta_scan('{main_path}') "
            
            # Add ordering
            if request.sort_by:
                query += f"ORDER BY {request.sort_by} {request.sort_order.upper()} "
            
            # Add pagination
            query += f"LIMIT {request.limit} OFFSET {offset}"
            
            result = con.execute(query).fetch_arrow_table()
            base_rows = result.to_pylist()
            
            # Get total count
            total = con.execute(f"SELECT COUNT(*) FROM delta_scan('{main_path}')").fetchone()[0]
            
            # Get column metadata
            schema = result.schema
            columns = [
                GridColumn(
                    name=field.name,
                    type=str(field.type),
                    editable=False  # TODO: Check editable columns
                )
                for field in schema
            ]
            
            # Overlay edits if session_id provided
            rows = []
            edited_row_ids = set()
            
            if request.session_id and request.session_id in self._edits:
                # Build edit map: row_id -> {column -> new_value}
                edit_map = {}
                for edit in self._edits[request.session_id]:
                    if edit.row_id not in edit_map:
                        edit_map[edit.row_id] = {}
                    edit_map[edit.row_id][edit.column] = edit.new_value
                    edited_row_ids.add(edit.row_id)
            else:
                edit_map = {}
            
            # Build rows with overlay
            for base_row in base_rows:
                row_id = str(base_row.get("id", base_row.get("row_id", "")))
                cells = dict(base_row)
                
                # Apply edits if any
                if row_id in edit_map:
                    cells.update(edit_map[row_id])
                
                rows.append(GridRow(
                    row_id=row_id,
                    cells=cells,
                    edited=row_id in edited_row_ids
                ))
            
            return GridDataResponse(
                meta={
                    "page": request.page,
                    "limit": request.limit,
                    "total": total
                },
                columns=columns,
                rows=rows
            )
            
        except Exception as e:
            logger.error(f"Failed to get grid data: {e}")
            raise
    
    def generate_preview(self, session_id: str) -> PreviewSummary:
        """
        Generate preview summary for a session
        
        Compiles all edits into a summary with diffs and validation.
        """
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        edits = self._edits.get(session_id, [])
        
        # Build diffs
        diffs = [
            {
                "row_id": edit.row_id,
                "column": edit.column,
                "old": edit.old_value,
                "new": edit.new_value
            }
            for edit in edits
        ]
        
        # Calculate validation summary
        valid_count = sum(1 for e in edits if e.is_valid)
        invalid_count = len(edits) - valid_count
        
        # Count warnings and errors from validation
        warnings = 0
        errors = 0
        for edit in edits:
            if edit.validation:
                severity = edit.validation.get("severity", "info")
                if severity == "warning":
                    warnings += 1
                elif severity in ["error", "fatal"]:
                    errors += 1
        
        validation_summary = {
            "valid": valid_count,
            "warnings": warnings,
            "errors": errors
        }
        
        stats = SessionStatistics.calculate_statistics(edits)
        
        return PreviewSummary(
            session_id=session_id,
            rows_changed=stats["rows_affected"],
            cells_changed=stats["cells_changed"],
            diffs=diffs,
            validation_summary=validation_summary
        )
    
    def delete_session(self, session_id: str) -> bool:
        """
        Delete/abort a live edit session
        
        Cannot delete if CR exists.
        """
        session = self.get_session(session_id)
        if not session:
            return False
        
        # Check if CR exists
        if session.change_request_id:
            raise ValueError("Cannot delete session with associated change request")
        
        # Mark as aborted
        session.status = SessionStatus.ABORTED
        session.updated_at = datetime.utcnow()
        
        # Clean up edits
        if session_id in self._edits:
            del self._edits[session_id]
        
        logger.info(json.dumps({
            "event": "session_aborted",
            "session_id": session_id
        }))
        
        return True
    
    def get_session_edits(self, session_id: str) -> List[CellEdit]:
        """Get all edits for a session"""
        return self._edits.get(session_id, [])
    
    def cleanup_expired_sessions(self) -> int:
        """
        Clean up expired sessions
        
        Returns: Count of sessions cleaned
        """
        cleaned = 0
        for session_id, session in list(self._sessions.items()):
            if session.is_expired() and session.status == SessionStatus.ACTIVE:
                session.status = SessionStatus.EXPIRED
                if session_id in self._edits:
                    del self._edits[session_id]
                cleaned += 1
                
                logger.info(json.dumps({
                    "event": "session_expired",
                    "session_id": session_id
                }))
        
        return cleaned

    def apply_changes(
        self,
        session_id: str,
        project_id: str,
        dataset_id: str,
        edited_cells: List[Dict[str, Any]],
        deleted_rows: List[str]
    ) -> Dict[str, Any]:
        """
        Apply live edit changes to the dataset (on CR approval)
        
        This method:
        1. Generates UPDATE statements for edited cells
        2. Generates DELETE statements for deleted rows  
        3. Applies changes to the Delta table
        4. Updates session status
        
        Args:
            session_id: The live edit session ID
            project_id: Project ID
            dataset_id: Dataset ID
            edited_cells: List of cell edits with row_id, column, old_value, new_value
            deleted_rows: List of row IDs to delete
            
        Returns:
            Dict with status and counts
        """
        try:
            if duckdb is None:
                raise RuntimeError("DuckDB required for applying changes")
            
            from deltalake import write_deltalake
            
            main_path = os.path.join(
                self._get_dataset_path(project_id, dataset_id),
                "main"
            )
            
            if not os.path.exists(main_path):
                return {"ok": False, "error": "dataset_not_found"}
            
            # Connect to DuckDB
            conn = get_duckdb_connection()
            
            rows_updated = 0
            rows_deleted = 0
            
            # Read current data using DuckDB delta_scan
            current_df = conn.execute(f"SELECT * FROM delta_scan('{main_path}')").df()
            
            # Ensure _row_id column exists for matching
            if "_row_id" not in current_df.columns:
                current_df["_row_id"] = range(len(current_df))
            
            # Apply edits
            for edit in edited_cells:
                row_id = edit.get("row_id")
                column = edit.get("column")
                new_value = edit.get("new_value")
                
                if row_id is not None and column and column in current_df.columns:
                    # Find the row and update
                    mask = current_df["_row_id"] == row_id
                    if mask.any():
                        current_df.loc[mask, column] = new_value
                        rows_updated += 1
            
            # Apply deletes
            if deleted_rows:
                rows_before = len(current_df)
                deleted_ids = [int(rid) if isinstance(rid, str) and rid.isdigit() else rid for rid in deleted_rows]
                current_df = current_df[~current_df["_row_id"].isin(deleted_ids)]
                rows_deleted = rows_before - len(current_df)
            
            # Drop the _row_id column before writing back (if it was added)
            if "_row_id" in current_df.columns:
                current_df = current_df.drop(columns=["_row_id"])
            
            # Convert DataFrame to PyArrow Table for write_deltalake
            if pa is not None:
                arrow_table = pa.Table.from_pandas(current_df, preserve_index=False)
                # Write back to Delta table (overwrite mode)
                write_deltalake(main_path, arrow_table, mode="overwrite")
            else:
                raise RuntimeError("PyArrow required for writing to Delta table")
            
            # Update session status if session exists
            session = self.get_session(session_id)
            if session:
                session.status = SessionStatus.COMPLETED
                session.updated_at = datetime.utcnow()
            
            logger.info(json.dumps({
                "event": "live_edit_applied",
                "session_id": session_id,
                "project_id": project_id,
                "dataset_id": dataset_id,
                "rows_updated": rows_updated,
                "rows_deleted": rows_deleted
            }))
            
            return {
                "ok": True,
                "rows_updated": rows_updated,
                "rows_deleted": rows_deleted
            }
            
        except Exception as e:
            logger.error(f"Failed to apply live edit changes: {e}")
            return {"ok": False, "error": str(e)}

    def get_rows_by_ids(
        self,
        project_id: str,
        dataset_id: str,
        row_ids: List[str]
    ) -> Dict[str, Any]:
        """
        Fetch specific rows from a dataset by their row IDs
        
        Args:
            project_id: Project ID
            dataset_id: Dataset ID
            row_ids: List of row IDs to fetch
            
        Returns:
            Dict with ok, rows, and columns
        """
        try:
            if duckdb is None:
                raise RuntimeError("DuckDB required for fetching rows")
            
            main_path = os.path.join(
                self._get_dataset_path(project_id, dataset_id),
                "main"
            )
            
            if not os.path.exists(main_path):
                return {"ok": False, "error": "dataset_not_found", "rows": [], "columns": []}
            
            # Connect to DuckDB and load delta extension
            conn = get_duckdb_connection()
            
            # Read all data and filter by row_id
            df = conn.execute(f"SELECT * FROM delta_scan('{main_path}')").df()
            
            # Add _row_id column if not present
            if "_row_id" not in df.columns:
                df["_row_id"] = range(len(df))
            
            # Convert row_ids to integers for matching
            int_row_ids = []
            for rid in row_ids:
                try:
                    int_row_ids.append(int(rid))
                except (ValueError, TypeError):
                    int_row_ids.append(rid)
            
            # Filter to only requested rows
            filtered_df = df[df["_row_id"].isin(int_row_ids)]
            
            # Get columns
            columns = list(df.columns)
            
            # Convert to list of dicts
            rows = filtered_df.to_dict(orient='records')
            
            conn.close()
            
            logger.info(json.dumps({
                "event": "get_rows_by_ids",
                "project_id": project_id,
                "dataset_id": dataset_id,
                "requested_count": len(row_ids),
                "returned_count": len(rows)
            }))
            
            return {
                "ok": True,
                "rows": rows,
                "columns": columns
            }
            
        except Exception as e:
            logger.error(f"Failed to fetch rows by IDs: {e}")
            return {"ok": False, "error": str(e), "rows": [], "columns": []}
