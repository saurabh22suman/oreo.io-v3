"""
Change Request Service for Oreo.io

Implements Change Request lifecycle management including:
- CR creation and submission
- Approval and rejection workflows
- Merge operations with Delta Lake
- Event tracking and audit trail
- Validation integration
"""

import json
import logging
import uuid
import os
import shutil
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

from change_request_models import (
    ChangeRequest,
    ChangeRequestStatus,
    ChangeRequestEvent,
    ChangeRequestEventType,
    ChangeRequestEdits,
    ChangeRequestStateMachine,
    ValidationSummary,
    RowDiff,
    CreateChangeRequestRequest,
    ApproveChangeRequestRequest,
    RejectChangeRequestRequest,
    MergeChangeRequestRequest,
)

logger = logging.getLogger("change_request_service")


class ChangeRequestService:
    """
    Service layer for Change Request operations
    
    Integrates with:
    - Delta Lake storage adapter
    - Validation service
    - Metadata database (future)
    """
    
    def __init__(self, delta_root: str = "/data/delta"):
        self.delta_root = delta_root
        self.state_machine = ChangeRequestStateMachine()
        # In-memory storage for demo (replace with DB)
        self._crs: Dict[str, ChangeRequest] = {}
        self._events: List[ChangeRequestEvent] = []
        self._edits: Dict[str, ChangeRequestEdits] = {}
    
    def _get_dataset_path(self, project_id: str, dataset_id: str) -> str:
        """Get path to dataset root"""
        return os.path.join(
            self.delta_root,
            "projects",
            project_id,
            "datasets",
            dataset_id
        )
    
    def _generate_cr_id(self) -> str:
        """Generate unique CR ID"""
        return f"cr_{uuid.uuid4().hex[:12]}"
    
    def _generate_event_id(self) -> str:
        """Generate unique event ID"""
        return f"evt_{uuid.uuid4().hex[:12]}"
    
    def create_change_request(
        self,
        request: CreateChangeRequestRequest,
        created_by: str
    ) -> ChangeRequest:
        """
        Create a new Change Request
        
        Steps:
        1. Generate CR ID
        2. Create staging Delta path
        3. Initialize CR record
        4. Create CREATED event
        """
        cr_id = self._generate_cr_id()
        
        # Construct staging path
        staging_path = os.path.join(
            self._get_dataset_path(request.project_id, request.dataset_id),
            "staging",
            cr_id
        )
        
        # Create CR
        cr = ChangeRequest(
            id=cr_id,
            project_id=request.project_id,
            dataset_id=request.dataset_id,
            session_id=request.session_id,
            title=request.title,
            description=request.description,
            created_by=created_by,
            approvers=request.approvers,
            status=ChangeRequestStatus.DRAFT,
            staging_path=staging_path
        )
        
        # Store CR
        self._crs[cr_id] = cr
        
        # Create event
        event = ChangeRequestEvent(
            id=self._generate_event_id(),
            cr_id=cr_id,
            event_type=ChangeRequestEventType.CREATED,
            actor_id=created_by,
            message=f"Created CR: {request.title}"
        )
        self._events.append(event)
        
        logger.info(json.dumps({
            "event": "cr_created",
            "cr_id": cr_id,
            "project_id": request.project_id,
            "dataset_id": request.dataset_id,
            "created_by": created_by
        }))
        
        return cr
    
    def get_change_request(self, cr_id: str) -> Optional[ChangeRequest]:
        """Get CR by ID"""
        return self._crs.get(cr_id)
    
    def list_change_requests(
        self,
        project_id: Optional[str] = None,
        dataset_id: Optional[str] = None,
        status: Optional[ChangeRequestStatus] = None
    ) -> List[ChangeRequest]:
        """List CRs with optional filters"""
        results = list(self._crs.values())
        
        if project_id:
            results = [cr for cr in results if cr.project_id == project_id]
        
        if dataset_id:
            results = [cr for cr in results if cr.dataset_id == dataset_id]
        
        if status:
            results = [cr for cr in results if cr.status == status]
        
        # Sort by created_at descending
        results.sort(key=lambda cr: cr.created_at, reverse=True)
        
        return results
    
    def submit_for_review(
        self,
        cr_id: str,
        submitter_id: str,
        validation_summary: Optional[ValidationSummary] = None
    ) -> Tuple[bool, Optional[str], Optional[ChangeRequest]]:
        """
        Submit CR for review
        
        Transitions: DRAFT -> PENDING_REVIEW
        
        Returns (success, error_message, updated_cr)
        """
        cr = self.get_change_request(cr_id)
        if not cr:
            return False, f"CR {cr_id} not found", None
        
        # Update validation summary if provided
        if validation_summary:
            cr.validation_summary = validation_summary
            cr.warnings_count = validation_summary.counts.get("warning", 0)
            cr.errors_count = validation_summary.counts.get("error", 0)
            cr.fatal_errors = validation_summary.counts.get("fatal", 0)
        
        # Validate submission
        can_submit, error = self.state_machine.validate_submission(cr)
        if not can_submit:
            return False, error, cr
        
        # Check state transition
        if not self.state_machine.can_transition(cr.status, ChangeRequestStatus.PENDING_REVIEW):
            return False, f"Cannot transition from {cr.status} to PENDING_REVIEW", cr
        
        # Update CR
        cr.status = ChangeRequestStatus.PENDING_REVIEW
        cr.updated_at = datetime.utcnow()
        
        # Create event
        event = ChangeRequestEvent(
            id=self._generate_event_id(),
            cr_id=cr_id,
            event_type=ChangeRequestEventType.SUBMITTED,
            actor_id=submitter_id,
            message="Submitted for review"
        )
        self._events.append(event)
        
        logger.info(json.dumps({
            "event": "cr_submitted",
            "cr_id": cr_id,
            "submitter_id": submitter_id,
            "warnings": cr.warnings_count,
            "errors": cr.errors_count
        }))
        
        return True, None, cr
    
    def approve_change_request(
        self,
        cr_id: str,
        request: ApproveChangeRequestRequest
    ) -> Tuple[bool, Optional[str], Optional[ChangeRequest]]:
        """
        Approve a CR
        
        Transitions: PENDING_REVIEW -> APPROVED
        """
        cr = self.get_change_request(cr_id)
        if not cr:
            return False, f"CR {cr_id} not found", None
        
        # Validate approval
        can_approve, error = self.state_machine.validate_approval(cr)
        if not can_approve:
            return False, error, cr
        
        # Check state transition
        if not self.state_machine.can_transition(cr.status, ChangeRequestStatus.APPROVED):
            return False, f"Cannot transition from {cr.status} to APPROVED", cr
        
        # Update CR
        cr.status = ChangeRequestStatus.APPROVED
        cr.approved_at = datetime.utcnow()
        cr.updated_at = datetime.utcnow()
        
        # Create event
        event = ChangeRequestEvent(
            id=self._generate_event_id(),
            cr_id=cr_id,
            event_type=ChangeRequestEventType.APPROVED,
            actor_id=request.approver_id,
            message=request.message or "Approved"
        )
        self._events.append(event)
        
        logger.info(json.dumps({
            "event": "cr_approved",
            "cr_id": cr_id,
            "approver_id": request.approver_id
        }))
        
        return True, None, cr
    
    def reject_change_request(
        self,
        cr_id: str,
        request: RejectChangeRequestRequest
    ) -> Tuple[bool, Optional[str], Optional[ChangeRequest]]:
        """
        Reject a CR
        
        Transitions: PENDING_REVIEW -> REJECTED
        """
        cr = self.get_change_request(cr_id)
        if not cr:
            return False, f"CR {cr_id} not found", None
        
        # Check state transition
        if not self.state_machine.can_transition(cr.status, ChangeRequestStatus.REJECTED):
            return False, f"Cannot transition from {cr.status} to REJECTED", cr
        
        # Update CR
        cr.status = ChangeRequestStatus.REJECTED
        cr.rejected_at = datetime.utcnow()
        cr.updated_at = datetime.utcnow()
        
        # Create event
        event = ChangeRequestEvent(
            id=self._generate_event_id(),
            cr_id=cr_id,
            event_type=ChangeRequestEventType.REJECTED,
            actor_id=request.reviewer_id,
            message=request.message
        )
        self._events.append(event)
        
        logger.info(json.dumps({
            "event": "cr_rejected",
            "cr_id": cr_id,
            "reviewer_id": request.reviewer_id,
            "reason": request.message
        }))
        
        return True, None, cr
    
    def merge_change_request(
        self,
        cr_id: str,
        request: MergeChangeRequestRequest,
        delta_adapter: Any  # DeltaStorageAdapter instance
    ) -> Tuple[bool, Optional[str], Optional[ChangeRequest]]:
        """
        Merge CR into main Delta table
        
        Steps:
        1. Validate merge preconditions
        2. Get current Delta version
        3. Execute Delta MERGE
        4. Record version_after
        5. Calculate statistics
        6. Save audit data
        7. Update CR status to MERGED
        8. Clean up staging (optional, configurable)
        
        Transitions: APPROVED -> MERGED
        """
        cr = self.get_change_request(cr_id)
        if not cr:
            return False, f"CR {cr_id} not found", None
        
        # Validate merge
        can_merge, error = self.state_machine.validate_merge(cr)
        if not can_merge and not request.force:
            return False, error, cr
        
        try:
            # Get Delta version before merge
            main_path = os.path.join(
                self._get_dataset_path(cr.project_id, cr.dataset_id),
                "main"
            )
            
            # Get current version using DuckDB
            if duckdb is None:
                raise RuntimeError("DuckDB required for merge")
            
            con = get_duckdb_connection()
            
            # Get version before
            # Note: This is a simplified approach - proper version tracking would use Delta Lake history
            version_before = 0  # Placeholder
            
            # Execute merge via delta adapter
            merge_result = delta_adapter.merge_staging_to_main(
                int(cr.project_id),
                int(cr.dataset_id),
                int(cr_id.replace("cr_", "")),  # Simplified - needs proper ID mapping
                keys=["id"]  # Default key - should be configurable
            )
            
            if not merge_result.get("ok"):
                return False, "Merge operation failed", cr
            
            # Get version after
            version_after = version_before + 1  # Placeholder
            
            # Update CR with merge info
            cr.delta_version_before = version_before
            cr.delta_version_after = version_after
            cr.merged_at = datetime.utcnow()
            cr.status = ChangeRequestStatus.MERGED
            cr.updated_at = datetime.utcnow()
            
            # Create merged event
            event = ChangeRequestEvent(
                id=self._generate_event_id(),
                cr_id=cr_id,
                event_type=ChangeRequestEventType.MERGED,
                actor_id=request.executor_id,
                message=f"Merged to version {version_after}"
            )
            self._events.append(event)
            
            logger.info(json.dumps({
                "event": "cr_merged",
                "cr_id": cr_id,
                "version_before": version_before,
                "version_after": version_after,
                "executor_id": request.executor_id
            }))
            
            return True, None, cr
            
        except Exception as e:
            logger.error(f"Merge failed for CR {cr_id}: {e}")
            return False, f"Merge failed: {str(e)}", cr
    
    def get_cr_events(self, cr_id: str) -> List[ChangeRequestEvent]:
        """Get all events for a CR (audit trail)"""
        return [evt for evt in self._events if evt.cr_id == cr_id]
    
    def get_cr_edits(self, cr_id: str) -> Optional[ChangeRequestEdits]:
        """Get diffs for a CR"""
        return self._edits.get(cr_id)
    
    def save_cr_edits(self, cr_id: str, edits: ChangeRequestEdits):
        """Save diffs for a CR"""
        self._edits[cr_id] = edits
        
        logger.info(json.dumps({
            "event": "cr_edits_saved",
            "cr_id": cr_id,
            "diff_count": len(edits.diffs)
        }))
    
    def cleanup_staging(self, cr: ChangeRequest) -> bool:
        """
        Clean up staging directory after successful merge
        
        Note: Only call this after merge is confirmed successful
        """
        try:
            if os.path.exists(cr.staging_path):
                shutil.rmtree(cr.staging_path)
                logger.info(json.dumps({
                    "event": "staging_cleaned",
                    "cr_id": cr.id,
                    "staging_path": cr.staging_path
                }))
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to cleanup staging for CR {cr.id}: {e}")
            return False
