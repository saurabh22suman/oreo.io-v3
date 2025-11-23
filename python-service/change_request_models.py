"""
Change Request Models for Oreo.io

Implements the Change Request Schema as specified in change_request_schema_spec.md

This module defines:
- Change Request entity and enums
- Change Request Events for audit trail
- Change Request Edits for diff tracking
- State machine logic
"""

from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class ChangeRequestStatus(str, Enum):
    """CR lifecycle status"""
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    REJECTED = "rejected"
    APPROVED = "approved"
    MERGED = "merged"
    CLOSED = "closed"


class ChangeRequestEventType(str, Enum):
    """Event types for CR audit trail"""
    CREATED = "created"
    EDITED = "edited"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    MERGED = "merged"
    RESTORED = "restored"
    CLEANUP = "cleanup"


class ValidationSummary(BaseModel):
    """Validation summary embedded in CR"""
    state: str  # PASSED, PARTIAL_PASS, FAILED
    counts: Dict[str, int]  # {info, warning, error, fatal}
    messages: List[Dict[str, Any]] = Field(default_factory=list)


class CellChange(BaseModel):
    """Individual cell change in a diff"""
    column: str
    old_value: Any
    new_value: Any


class RowDiff(BaseModel):
    """Row-level diff entry"""
    row_id: str
    changes: Dict[str, Dict[str, Any]]  # {column: {old, new}}


class ChangeRequest(BaseModel):
    """
    Core Change Request entity
    
    Represents a single unit of proposed change to a dataset.
    """
    # Identity
    id: str  # cr_xxx format
    project_id: str
    dataset_id: str
    session_id: Optional[str] = None  # Live edit session or None for direct ingest
    
    # Metadata
    title: str
    description: Optional[str] = None
    created_by: str
    approvers: List[str] = Field(default_factory=list)  # List of user IDs
    
    # Status
    status: ChangeRequestStatus = ChangeRequestStatus.DRAFT
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    merged_at: Optional[datetime] = None
    
    # Delta Lake integration
    staging_path: str  # /staging/<cr_id>/
    delta_version_before: Optional[int] = None
    delta_version_after: Optional[int] = None
    
    # Statistics
    row_count_added: int = 0
    row_count_updated: int = 0
    row_count_deleted: int = 0
    cell_count_changed: int = 0
    
    # Validation
    validation_summary: Optional[ValidationSummary] = None
    warnings_count: int = 0
    errors_count: int = 0
    fatal_errors: int = 0
    
    # Extensions
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ChangeRequestEvent(BaseModel):
    """
    Audit trail event for a Change Request
    
    Captures lifecycle events for timeline and audit.
    """
    id: str  # Unique event ID
    cr_id: str  # Change request ID
    event_type: ChangeRequestEventType
    actor_id: str  # User performing the event
    message: Optional[str] = None  # Optional comment/note
    created_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ChangeRequestEdits(BaseModel):
    """
    Aggregated diff summary for a CR
    
    Stores high-level diff information. Detailed diffs live in Delta audit folder.
    """
    cr_id: str
    diffs: List[RowDiff] = Field(default_factory=list)
    summary: Dict[str, Any] = Field(default_factory=dict)


class ChangeRequestStateMachine:
    """
    State machine for Change Request lifecycle
    
    Implements state transitions as specified in the schema.
    """
    
    @staticmethod
    def can_transition(from_status: ChangeRequestStatus, to_status: ChangeRequestStatus) -> bool:
        """Check if a state transition is allowed"""
        valid_transitions = {
            ChangeRequestStatus.DRAFT: [ChangeRequestStatus.PENDING_REVIEW],
            ChangeRequestStatus.PENDING_REVIEW: [
                ChangeRequestStatus.APPROVED,
                ChangeRequestStatus.REJECTED
            ],
            ChangeRequestStatus.REJECTED: [ChangeRequestStatus.PENDING_REVIEW],  # Can resubmit
            ChangeRequestStatus.APPROVED: [
                ChangeRequestStatus.MERGED,
                ChangeRequestStatus.PENDING_REVIEW,  # On merge failure
            ],
            ChangeRequestStatus.MERGED: [ChangeRequestStatus.CLOSED],
            ChangeRequestStatus.CLOSED: [],  # Terminal state
        }
        
        allowed = valid_transitions.get(from_status, [])
        return to_status in allowed
    
    @staticmethod
    def validate_submission(cr: ChangeRequest) -> tuple[bool, Optional[str]]:
        """
        Validate that a CR can be submitted for review
        
        Returns (can_submit, error_message)
        """
        if cr.status != ChangeRequestStatus.DRAFT:
            return False, f"CR must be in DRAFT status, currently {cr.status}"
        
        if not cr.title:
            return False, "CR must have a title"
        
        if cr.fatal_errors > 0:
            return False, "CR has fatal validation errors"
        
        if cr.errors_count > 0:
            return False, "CR has blocking validation errors"
        
        return True, None
    
    @staticmethod
    def validate_approval(cr: ChangeRequest) -> tuple[bool, Optional[str]]:
        """
        Validate that a CR can be approved
        
        Returns (can_approve, error_message)
        """
        if cr.status != ChangeRequestStatus.PENDING_REVIEW:
            return False, f"CR must be in PENDING_REVIEW status, currently {cr.status}"
        
        if cr.fatal_errors > 0:
            return False, "CR has fatal validation errors"
        
        if cr.errors_count > 0:
            return False, "CR has blocking validation errors"
        
        # Warnings are allowed but should be reviewed
        return True, None
    
    @staticmethod
    def validate_merge(cr: ChangeRequest) -> tuple[bool, Optional[str]]:
        """
        Validate that a CR can be merged
        
        Returns (can_merge, error_message)
        """
        if cr.status != ChangeRequestStatus.APPROVED:
            return False, f"CR must be APPROVED before merge, currently {cr.status}"
        
        if not cr.staging_path:
            return False, "CR staging path not set"
        
        return True, None


class CreateChangeRequestRequest(BaseModel):
    """Request to create a new CR"""
    project_id: str
    dataset_id: str
    session_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    approvers: List[str] = Field(default_factory=list)


class ApproveChangeRequestRequest(BaseModel):
    """Request to approve a CR"""
    approver_id: str
    message: Optional[str] = None


class RejectChangeRequestRequest(BaseModel):
    """Request to reject a CR"""
    reviewer_id: str
    message: str  # Comment is required for rejection


class MergeChangeRequestRequest(BaseModel):
    """Request to merge a CR (internal)"""
    executor_id: str
    force: bool = False  # Allow override of certain checks


# Permission check helpers
class ChangeRequestPermissions:
    """Helper class for CR permission checks"""
    
    @staticmethod
    def can_create_cr(role: str) -> bool:
        """Check if role can create CRs"""
        return role in ["owner", "contributor"]
    
    @staticmethod
    def can_approve_cr(role: str) -> bool:
        """Check if role can approve CRs"""
        return role in ["owner", "contributor", "viewer"]
    
    @staticmethod
    def can_merge_cr(role: str) -> bool:
        """Check if role can merge CRs"""
        return role in ["owner", "contributor", "viewer"]
    
    @staticmethod
    def can_view_cr(role: str) -> bool:
        """Check if role can view CRs"""
        return role in ["owner", "contributor", "viewer"]
