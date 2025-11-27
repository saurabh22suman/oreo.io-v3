"""
Validation API endpoints for main.py

Add these endpoints to the main.py file after the business rules section.
"""

# --------- Validation Service (State Machine) ---------
try:
    from validation_service import ValidationService
    _validation_service = ValidationService()
except Exception as e:
    import sys, traceback
    print(f"[ValidationServiceInitError] {type(e).__name__}: {e}", file=sys.stderr)
    traceback.print_exc()
    _validation_service = None


class CellValidationRequest(BaseModel):
    """Request for cell-level validation"""
    project_id: int
    dataset_id: int
    row_id: str
    column: str
    new_value: Any


class SessionValidationRequest(BaseModel):
    """Request for session-level validation"""
    project_id: int
    dataset_id: int
    session_id: str


class ChangeRequestValidationRequest(BaseModel):
    """Request for change request validation"""
    project_id: int
    dataset_id: int
    change_request_id: int


class MergeValidationRequest(BaseModel):
    """Request for merge validation"""
    project_id: int
    dataset_id: int
    change_request_id: int


@app.post("/validation/cell")
def validate_cell_endpoint(req: CellValidationRequest):
    """
    Validate a single cell edit.
    
    Implements cell-level validation from the state machine.
    Returns: CellValidationResult with valid/invalid and severity.
    """
    if _validation_service is None:
        raise HTTPException(status_code=500, detail="Validation service not available")
    
    try:
        result = _validation_service.validate_cell(
            req.project_id,
            req.dataset_id,
            req.row_id,
            req.column,
            req.new_value
        )
        return result.dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cell validation failed: {str(e)}")


@app.post("/validation/session")
def validate_session_endpoint(req: SessionValidationRequest):
    """
    Validate an entire live edit session.
    
    Implements session-level validation from the state machine.
    Returns: SessionValidationResult with state and validation details.
    """
    if _validation_service is None:
        raise HTTPException(status_code=500, detail="Validation service not available")
    
    try:
        result = _validation_service.validate_session(
            req.project_id,
            req.dataset_id,
            req.session_id
        )
        
        # Save validation result
        if result.validation_result:
            _validation_service.save_validation_result(
                req.project_id,
                req.dataset_id,
                result.validation_result
            )
        
        return result.dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Session validation failed: {str(e)}")


@app.post("/validation/change_request")
def validate_change_request_endpoint(req: ChangeRequestValidationRequest):
    """
    Validate a change request before approval.
    
    Implements CR validation from the state machine.
    Returns: ChangeRequestValidationResult with can_approve flag.
    """
    if _validation_service is None:
        raise HTTPException(status_code=500, detail="Validation service not available")
    
    try:
        result = _validation_service.validate_change_request(
            req.project_id,
            req.dataset_id,
            req.change_request_id
        )
        
        # Save validation result
        if result.validation_result:
            _validation_service.save_validation_result(
                req.project_id,
                req.dataset_id,
                result.validation_result
            )
        
        return result.dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CR validation failed: {str(e)}")


@app.post("/validation/merge")
def validate_merge_endpoint(req: MergeValidationRequest):
    """
    Final validation before merge execution.
    
    Implements approval-stage validation from the state machine.
    Returns: MergeValidationResult with merge_state.
    """
    if _validation_service is None:
        raise HTTPException(status_code=500, detail="Validation service not available")
    
    try:
        result = _validation_service.validate_before_merge(
            req.project_id,
            req.dataset_id,
            req.change_request_id
        )
        
        # Save validation result
        if result.validation_result:
            _validation_service.save_validation_result(
                req.project_id,
                req.dataset_id,
                result.validation_result
            )
        
        return result.dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Merge validation failed: {str(e)}")
