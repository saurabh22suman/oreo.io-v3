"""
Change Request API Endpoints

FastAPI endpoints for Change Request operations.
Add these to main.py after the validation endpoints.
"""

from fastapi import HTTPException
from pydantic import BaseModel
from typing import List, Optional

# Import CR models and service
from change_request_models import (
    ChangeRequestStatus,
    CreateChangeRequestRequest,
    ApproveChangeRequestRequest,
    RejectChangeRequestRequest,
    MergeChangeRequestRequest,
)
from change_request_service import ChangeRequestService
from validation_models import ValidationSummary

# Initialize CR service
try:
    _cr_service = ChangeRequestService()
except Exception as e:
    import sys, traceback
    print(f"[CRServiceInitError] {type(e).__name__}: {e}", file=sys.stderr)
    traceback.print_exc()
    _cr_service = None


class SubmitForReviewRequest(BaseModel):
    """Request to submit CR for review"""
    submitter_id: str
    validation_summary: Optional[ValidationSummary] = None


@app.post("/change_requests")
def create_change_request(request: CreateChangeRequestRequest, created_by: str = "system"):
    """
    Create a new Change Request
    
    POST /change_requests
    Body: CreateChangeRequestRequest
    
    Returns: ChangeRequest
    """
    if _cr_service is None:
        raise HTTPException(status_code=500, detail="CR service not available")
    
    try:
        cr = _cr_service.create_change_request(request, created_by)
        return cr.dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create CR: {str(e)}")


@app.get("/change_requests/{cr_id}")
def get_change_request(cr_id: str):
    """
    Get a Change Request by ID
    
    GET /change_requests/{cr_id}
    
    Returns: ChangeRequest
    """
    if _cr_service is None:
        raise HTTPException(status_code=500, detail="CR service not available")
    
    cr = _cr_service.get_change_request(cr_id)
    if not cr:
        raise HTTPException(status_code=404, detail=f"CR {cr_id} not found")
    
    return cr.dict()


@app.get("/datasets/{dataset_id}/change_requests")
def list_change_requests_for_dataset(
    dataset_id: str,
    project_id: Optional[str] = None,
    status: Optional[str] = None
):
    """
    List Change Requests for a dataset
    
    GET /datasets/{dataset_id}/change_requests?project_id=xxx&status=pending_review
    
    Returns: List[ChangeRequest]
    """
    if _cr_service is None:
        raise HTTPException(status_code=500, detail="CR service not available")
    
    try:
        # Parse status if provided
        cr_status = None
        if status:
            try:
                cr_status = ChangeRequestStatus(status)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
        
        crs = _cr_service.list_change_requests(
            project_id=project_id,
            dataset_id=dataset_id,
            status=cr_status
        )
        
        return [cr.dict() for cr in crs]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list CRs: {str(e)}")


@app.post("/change_requests/{cr_id}/submit")
def submit_change_request_for_review(cr_id: str, request: SubmitForReviewRequest):
    """
    Submit a CR for review
    
    POST /change_requests/{cr_id}/submit
    Body: SubmitForReviewRequest
    
    Transitions: DRAFT -> PENDING_REVIEW
    
    Returns: ChangeRequest
    """
    if _cr_service is None:
        raise HTTPException(status_code=500, detail="CR service not available")
    
    success, error, cr = _cr_service.submit_for_review(
        cr_id,
        request.submitter_id,
        request.validation_summary
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=error)
    
    return cr.dict()


@app.post("/change_requests/{cr_id}/approve")
def approve_change_request(cr_id: str, request: ApproveChangeRequestRequest):
    """
    Approve a Change Request
    
    POST /change_requests/{cr_id}/approve
    Body: ApproveChangeRequestRequest
    
    Transitions: PENDING_REVIEW -> APPROVED
    
    Returns: ChangeRequest
    """
    if _cr_service is None:
        raise HTTPException(status_code=500, detail="CR service not available")
    
    success, error, cr = _cr_service.approve_change_request(cr_id, request)
    
    if not success:
        raise HTTPException(status_code=400, detail=error)
    
    return cr.dict()


@app.post("/change_requests/{cr_id}/reject")
def reject_change_request(cr_id: str, request: RejectChangeRequestRequest):
    """
    Reject a Change Request
    
    POST /change_requests/{cr_id}/reject
    Body: RejectChangeRequestRequest
    
    Transitions: PENDING_REVIEW -> REJECTED
    
    Returns: ChangeRequest
    """
    if _cr_service is None:
        raise HTTPException(status_code=500, detail="CR service not available")
    
    success, error, cr = _cr_service.reject_change_request(cr_id, request)
    
    if not success:
        raise HTTPException(status_code=400, detail=error)
    
    return cr.dict()


@app.post("/change_requests/{cr_id}/merge")
def merge_change_request(cr_id: str, request: MergeChangeRequestRequest):
    """
    Merge a Change Request into main Delta table
    
    POST /change_requests/{cr_id}/merge
    Body: MergeChangeRequestRequest
    
    Transitions: APPROVED -> MERGED
    
    This is typically an internal operation triggered after approval.
    
    Returns: ChangeRequest
    """
    if _cr_service is None:
        raise HTTPException(status_code=500, detail="CR service not available")
    
    if _delta_adapter is None:
        raise HTTPException(status_code=500, detail="Delta adapter not available")
    
    success, error, cr = _cr_service.merge_change_request(
        cr_id,
        request,
        _delta_adapter
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=error)
    
    return cr.dict()


@app.get("/change_requests/{cr_id}/events")
def get_change_request_events(cr_id: str):
    """
    Get audit trail events for a CR
    
    GET /change_requests/{cr_id}/events
    
    Returns: List[ChangeRequestEvent]
    """
    if _cr_service is None:
        raise HTTPException(status_code=500, detail="CR service not available")
    
    events = _cr_service.get_cr_events(cr_id)
    return [evt.dict() for evt in events]


@app.get("/change_requests/{cr_id}/edits")
def get_change_request_edits(cr_id: str):
    """
    Get diff/edits for a CR
    
    GET /change_requests/{cr_id}/edits
    
    Returns: ChangeRequestEdits
    """
    if _cr_service is None:
        raise HTTPException(status_code=500, detail="CR service not available")
    
    edits = _cr_service.get_cr_edits(cr_id)
    if not edits:
        raise HTTPException(status_code=404, detail=f"No edits found for CR {cr_id}")
    
    return edits.dict()
