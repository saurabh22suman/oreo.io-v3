"""
Validation Flow State Machine Models for Oreo.io

This module defines the data structures and enums for the validation state machine
as specified in Validation_flow_state_machine.spec.md
"""

from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class ValidationState(str, Enum):
    """Primary validation states"""
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    PARTIAL_PASS = "PARTIAL_PASS"
    PASSED = "PASSED"
    FAILED = "FAILED"


class ValidationSeverity(str, Enum):
    """Validation result severities"""
    INFO = "INFO"              # Advisory only
    WARNING = "WARNING"        # Soft-fail, requires reviewer attention
    ERROR = "ERROR"            # Hard-fail, blocks submission
    FATAL = "FATAL"            # Stop-flow immediately


class CellValidationState(str, Enum):
    """Cell-level validation states"""
    EDIT_RECEIVED = "EDIT_RECEIVED"
    VALIDATE_CELL = "VALIDATE_CELL"
    VALID_CELL = "VALID_CELL"
    INVALID_CELL = "INVALID_CELL"


class SessionValidationState(str, Enum):
    """Session-level validation states"""
    SESSION_OPEN = "SESSION_OPEN"
    SESSION_EDITING = "SESSION_EDITING"
    SESSION_PREVIEW_REQUESTED = "SESSION_PREVIEW_REQUESTED"
    VALIDATE_SESSION = "VALIDATE_SESSION"
    SESSION_VALID = "SESSION_VALID"
    SESSION_INVALID = "SESSION_INVALID"
    CR_CREATABLE = "CR_CREATABLE"
    CR_BLOCKED_BY_ERRORS = "CR_BLOCKED_BY_ERRORS"


class ChangeRequestValidationState(str, Enum):
    """Change request validation states"""
    CR_CREATED = "CR_CREATED"
    CR_PENDING_REVIEW = "CR_PENDING_REVIEW"
    REVALIDATE_STAGING = "REVALIDATE_STAGING"
    CR_VALID = "CR_VALID"
    CR_INVALID = "CR_INVALID"


class MergeState(str, Enum):
    """Merge execution states"""
    MERGE_ALLOWED = "MERGE_ALLOWED"
    MERGING = "MERGING"
    MERGE_SUCCESS = "MERGE_SUCCESS"
    MERGE_FAILED = "MERGE_FAILED"
    CLEANUP_STAGING = "CLEANUP_STAGING"
    DONE = "DONE"
    CR_REOPEN_FOR_FIX = "CR_REOPEN_FOR_FIX"


class ValidationMessage(BaseModel):
    """Individual validation message"""
    column: Optional[str] = None
    row: Optional[int] = None
    severity: ValidationSeverity
    message: str
    rule_name: Optional[str] = None
    expectation_type: Optional[str] = None


class ValidationCounts(BaseModel):
    """Counts of validation results by severity"""
    info: int = 0
    warning: int = 0
    error: int = 0
    fatal: int = 0

    def has_blocking_errors(self) -> bool:
        """Check if there are any blocking errors (error or fatal)"""
        return self.error > 0 or self.fatal > 0

    def has_warnings(self) -> bool:
        """Check if there are warnings"""
        return self.warning > 0

    def is_clean(self) -> bool:
        """Check if validation is completely clean (only info, no warnings/errors)"""
        return self.warning == 0 and self.error == 0 and self.fatal == 0


class CellValidationResult(BaseModel):
    """Result of cell-level validation"""
    valid: bool
    severity: ValidationSeverity
    messages: List[str] = Field(default_factory=list)
    row_id: Optional[str] = None
    column: Optional[str] = None


class ValidationResult(BaseModel):
    """Complete validation result"""
    state: ValidationState
    counts: ValidationCounts
    messages: List[ValidationMessage] = Field(default_factory=list)
    can_proceed: bool
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    validation_suite_version: Optional[str] = None
    run_id: Optional[str] = None

    def determine_state(self) -> ValidationState:
        """Determine validation state based on counts"""
        if self.counts.has_blocking_errors():
            return ValidationState.FAILED
        elif self.counts.has_warnings():
            return ValidationState.PARTIAL_PASS
        else:
            return ValidationState.PASSED

    def can_create_change_request(self) -> bool:
        """Check if change request can be created"""
        return not self.counts.has_blocking_errors()

    def can_merge(self) -> bool:
        """Check if merge is allowed"""
        # Only PASSED allows automatic merge
        # PARTIAL_PASS requires approver override
        return self.state == ValidationState.PASSED


class SessionValidationResult(BaseModel):
    """Result of session-level validation"""
    session_id: str
    state: SessionValidationState
    validation_result: ValidationResult
    edited_rows_count: int = 0
    can_create_cr: bool


class ChangeRequestValidationResult(BaseModel):
    """Result of change request validation"""
    change_request_tag: str
    state: ChangeRequestValidationState
    validation_result: ValidationResult
    can_approve: bool
    requires_override: bool = False


class MergeValidationResult(BaseModel):
    """Result of merge-stage validation"""
    change_request_tag: str
    merge_state: MergeState
    validation_result: ValidationResult
    conflict_detected: bool = False
    conflict_details: Optional[Dict[str, Any]] = None


# State transition helper
class ValidationStateMachine:
    """Helper class for validation state transitions"""

    @staticmethod
    def transition(
        current_state: ValidationState,
        counts: ValidationCounts,
        override_approved: bool = False
    ) -> ValidationState:
        """
        Determine next state based on current state and validation counts
        
        Implements the state transition rules from the spec:
        - NOT_STARTED -> IN_PROGRESS (when validation called)
        - IN_PROGRESS -> PASSED (if all clean)
        - IN_PROGRESS -> PARTIAL_PASS (if warnings exist)
        - IN_PROGRESS -> FAILED (if errors/fatal exist)
        - PARTIAL_PASS -> PASSED (if approved override)
        - PARTIAL_PASS -> FAILED (if rejected)
        """
        if current_state == ValidationState.NOT_STARTED:
            return ValidationState.IN_PROGRESS

        if current_state == ValidationState.IN_PROGRESS:
            if counts.has_blocking_errors():
                return ValidationState.FAILED
            elif counts.has_warnings():
                return ValidationState.PARTIAL_PASS
            else:
                return ValidationState.PASSED

        if current_state == ValidationState.PARTIAL_PASS:
            if override_approved:
                return ValidationState.PASSED
            else:
                # Staying in PARTIAL_PASS until decision
                return ValidationState.PARTIAL_PASS

        # All other transitions return current state
        return current_state

    @staticmethod
    def can_proceed_to_next_stage(state: ValidationState, counts: ValidationCounts) -> bool:
        """Check if we can proceed to next stage of workflow"""
        if state == ValidationState.FAILED:
            return False
        if state == ValidationState.PARTIAL_PASS:
            # Requires manual review but doesn't completely block
            return True
        if state == ValidationState.PASSED:
            return True
        return False
