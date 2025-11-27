"""
Live Edit API Endpoints

FastAPI endpoints for Live Edit operations.
Add these to main.py after the change request endpoints.
"""

from fastapi import HTTPException, Query
from pydantic import BaseModel
from typing import Optional

# Import Live Edit models and service
from live_edit_models import (
    StartSessionRequest,
    CellEditRequest,
    BulkEditRequest,
    GridDataRequest,
)
from live_edit_service import LiveEditService

# Initialize Live Edit service
try:
    _live_edit_service = LiveEditService()
except Exception as e:
    import sys, traceback
    print(f"[LiveEditServiceInitError] {type(e).__name__}: {e}", file=sys.stderr)
    traceback.print_exc()
    _live_edit_service = None


@app.post("/api/v1/datasets/{dataset_id}/live_sessions")
def start_live_session(
    dataset_id: str,
    request: StartSessionRequest,
    project_id: str = "1"  # TODO: Get from context/auth
):
    """
    Start a new live edit session
    
    POST /api/v1/datasets/{dataset_id}/live_sessions
    
    Returns: session_id, staging_path, editable_columns, rules_map, sample_rows
    """
    if _live_edit_service is None:
        raise HTTPException(status_code=500, detail="Live Edit service not available")
    
    try:
        response = _live_edit_service.start_session(request, project_id, dataset_id)
        return response.dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start session: {str(e)}")


@app.get("/api/v1/datasets/{dataset_id}/data")
def get_grid_data(
    dataset_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=1000),
    session_id: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: str = Query("asc", regex="^(asc|desc)$"),
    project_id: str = "1"  # TODO: Get from context/auth
):
    """
    Get paginated grid data with optional session overlay
    
    GET /api/v1/datasets/{dataset_id}/data?page=1&limit=100&session_id=sess_xxx
    
    If session_id provided, overlays live edits on base data.
    
    Returns: {meta, columns, rows}
    """
    if _live_edit_service is None:
        raise HTTPException(status_code=500, detail="Live Edit service not available")
    
    try:
        request = GridDataRequest(
            page=page,
            limit=limit,
            session_id=session_id,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        response = _live_edit_service.get_grid_data(project_id, dataset_id, request)
        return response.dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get grid data: {str(e)}")


@app.post("/api/v1/datasets/{dataset_id}/live_sessions/{session_id}/edits")
def save_cell_edit(
    dataset_id: str,
    session_id: str,
    request: CellEditRequest,
    user_id: str = "user_001"  # TODO: Get from context/auth
):
    """
    Save a single cell edit
    
    POST /api/v1/datasets/{dataset_id}/live_sessions/{session_id}/edits
    Body: {row_id, column, new_value, client_ts}
    
    Returns: {status, validation, edit_id}
    """
    if _live_edit_service is None:
        raise HTTPException(status_code=500, detail="Live Edit service not available")
    
    try:
        response = _live_edit_service.save_cell_edit(session_id, request, user_id)
        
        # Return 422 for invalid edits
        if response.status == "error":
            raise HTTPException(status_code=422, detail=response.dict())
        
        return response.dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save edit: {str(e)}")


@app.post("/api/v1/datasets/{dataset_id}/live_sessions/{session_id}/edits/batch")
def save_bulk_edits(
    dataset_id: str,
    session_id: str,
    request: BulkEditRequest,
    user_id: str = "user_001"  # TODO: Get from context/auth
):
    """
    Save multiple edits in batch
    
    POST /api/v1/datasets/{dataset_id}/live_sessions/{session_id}/edits/batch
    Body: {edits: [{row_id, column, new_value}, ...]}
    
    Returns: {results: [{edit_id, valid, messages}, ...]}
    """
    if _live_edit_service is None:
        raise HTTPException(status_code=500, detail="Live Edit service not available")
    
    try:
        response = _live_edit_service.save_bulk_edits(session_id, request, user_id)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save bulk edits: {str(e)}")


@app.post("/api/v1/datasets/{dataset_id}/live_sessions/{session_id}/preview")
def preview_session(dataset_id: str, session_id: str):
    """
    Generate preview summary for a session
    
    POST /api/v1/datasets/{dataset_id}/live_sessions/{session_id}/preview
    
    Returns: {summary: {rows_changed, cells_changed}, diffs, validation_summary}
    """
    if _live_edit_service is None:
        raise HTTPException(status_code=500, detail="Live Edit service not available")
    
    try:
        preview = _live_edit_service.generate_preview(session_id)
        return preview.dict()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate preview: {str(e)}")


@app.delete("/api/v1/datasets/{dataset_id}/live_sessions/{session_id}")
def abort_session(dataset_id: str, session_id: str):
    """
    Abort/cancel a live edit session
    
    DELETE /api/v1/datasets/{dataset_id}/live_sessions/{session_id}
    
    Cannot delete if change request exists.
    
    Returns: {ok: true}
    """
    if _live_edit_service is None:
        raise HTTPException(status_code=500, detail="Live Edit service not available")
    
    try:
        success = _live_edit_service.delete_session(session_id)
        if not success:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {str(e)}")


@app.get("/api/v1/datasets/{dataset_id}/live_sessions/{session_id}")
def get_session(dataset_id: str, session_id: str):
    """
    Get live edit session details
    
    GET /api/v1/datasets/{dataset_id}/live_sessions/{session_id}
    
    Returns: LiveEditSession
    """
    if _live_edit_service is None:
        raise HTTPException(status_code=500, detail="Live Edit service not available")
    
    session = _live_edit_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return session.dict()


@app.get("/api/v1/datasets/{dataset_id}/live_sessions/{session_id}/edits")
def get_session_edits(dataset_id: str, session_id: str):
    """
    Get all edits for a session
    
    GET /api/v1/datasets/{dataset_id}/live_sessions/{session_id}/edits
    
    Returns: List[CellEdit]
    """
    if _live_edit_service is None:
        raise HTTPException(status_code=500, detail="Live Edit service not available")
    
    edits = _live_edit_service.get_session_edits(session_id)
    return [edit.dict() for edit in edits]


@app.post("/api/v1/admin/cleanup_sessions")
def cleanup_expired_sessions():
    """
    Admin endpoint to cleanup expired sessions
    
    POST /api/v1/admin/cleanup_sessions
    
    Returns: {cleaned: count}
    """
    if _live_edit_service is None:
        raise HTTPException(status_code=500, detail="Live Edit service not available")
    
    try:
        cleaned = _live_edit_service.cleanup_expired_sessions()
        return {"cleaned": cleaned}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")


@app.get("/api/v1/admin/delta_status")
def delta_status():
    """
    Check Delta adapter availability
    
    GET /api/v1/admin/delta_status
    
    Returns: {available: bool, message: str}
    """
    if _delta_adapter is None:
        return {"available": False, "message": "Delta adapter not available"}
    
    try:
        # Try a simple operation
        return {"available": True, "message": "Delta adapter is operational"}
    except Exception as e:
        return {"available": False, "message": str(e)}
