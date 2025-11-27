"""
Live Edit Models for Oreo.io

Implements data models for the Live Edit system as specified in live_edit_api.spec.md

This module defines:
- Live Edit Session
- Cell Edit records
- Preview summaries
- Validation payloads
"""

from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime, timedelta


class SessionMode(str, Enum):
    """Live edit session mode"""
    ROW_SELECTION = "row_selection"  # Edit specific rows
    FULL_TABLE = "full_table"        # Edit entire table


class SessionStatus(str, Enum):
    """Session lifecycle status"""
    ACTIVE = "active"
    PREVIEW = "preview"
    SUBMITTED = "submitted"
    ABORTED = "aborted"
    EXPIRED = "expired"


class LiveEditSession(BaseModel):
    """
    Live Edit Session entity
    
    Represents a short-lived editing session for a dataset.
    """
    # Identity
    session_id: str  # sess_xxx format
    dataset_id: str
    project_id: str
    user_id: str
    
    # Configuration
    mode: SessionMode = SessionMode.FULL_TABLE
    selected_rows: List[int] = Field(default_factory=list)  # For row_selection mode
    
    # Metadata
    staging_path: str  # .../live_edit/<session_id>/
    editable_columns: List[str] = Field(default_factory=list)
    rules_map: Dict[str, List[Dict[str, Any]]] = Field(default_factory=dict)
    
    # Status
    status: SessionStatus = SessionStatus.ACTIVE
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None  # TTL
    
    # Change tracking
    edit_count: int = 0
    cells_changed: int = 0
    rows_affected: int = 0
    
    # Associated CR
    change_request_id: Optional[str] = None
    
    # Extensions
    metadata: Dict[str, Any] = Field(default_factory=dict)

    def is_expired(self) -> bool:
        """Check if session has expired"""
        if self.expires_at:
            return datetime.utcnow() > self.expires_at
        return False
    
    def can_edit(self) -> bool:
        """Check if session allows editing"""
        return (
            self.status == SessionStatus.ACTIVE 
            and not self.is_expired()
            and self.change_request_id is None
        )


class CellEdit(BaseModel):
    """
    Individual cell edit record
    
    Stored in session_edits Delta table.
    """
    edit_id: str  # edit_xxx format
    session_id: str
    row_id: str  # Primary key of the row being edited
    column: str
    old_value: Any
    new_value: Any
    user_id: str
    
    # Timestamps
    client_ts: Optional[datetime] = None  # Client-side timestamp
    server_ts: datetime = Field(default_factory=datetime.utcnow)
    
    # Validation
    validation: Optional[Dict[str, Any]] = None  # Validation result
    is_valid: bool = True
    
    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CellEditRequest(BaseModel):
    """Request to edit a single cell"""
    row_id: str
    column: str
    new_value: Any
    client_ts: Optional[str] = None  # ISO timestamp


class BulkEditRequest(BaseModel):
    """Request to edit multiple cells (batch)"""
    edits: List[CellEditRequest]


class PreviewSummary(BaseModel):
    """Preview summary for a live edit session"""
    session_id: str
    rows_changed: int
    cells_changed: int
    diffs: List[Dict[str, Any]] = Field(default_factory=list)
    validation_summary: Dict[str, Any] = Field(default_factory=dict)
    estimated_impact: Optional[str] = None


class StartSessionRequest(BaseModel):
    """Request to start a live edit session"""
    user_id: str
    mode: SessionMode = SessionMode.FULL_TABLE
    rows: List[int] = Field(default_factory=list)  # For row_selection mode


class StartSessionResponse(BaseModel):
    """Response for starting a session"""
    session_id: str
    staging_path: str
    editable_columns: List[str]
    rules_map: Dict[str, List[Dict[str, Any]]]
    sample_rows: List[Dict[str, Any]] = Field(default_factory=list)
    expires_at: str  # ISO timestamp


class EditResponse(BaseModel):
    """Response for a cell edit"""
    status: str  # "ok" or "error"
    validation: Dict[str, Any]
    edit_id: Optional[str] = None


class BulkEditResponse(BaseModel):
    """Response for bulk edits"""
    results: List[Dict[str, Any]]


class GridDataRequest(BaseModel):
    """Request for grid data"""
    page: int = 1
    limit: int = 100
    session_id: Optional[str] = None
    filters: Optional[Dict[str, Any]] = None
    sort_by: Optional[str] = None
    sort_order: str = "asc"


class GridColumn(BaseModel):
    """Column metadata for grid"""
    name: str
    type: str  # string, integer, float, boolean, date, etc.
    editable: bool = False
    nullable: bool = True
    rules: List[Dict[str, Any]] = Field(default_factory=list)


class GridRow(BaseModel):
    """Row data for grid"""
    row_id: str
    cells: Dict[str, Any]
    edited: bool = False  # True if this row has edits in the session
    validation_issues: List[str] = Field(default_factory=list)


class GridDataResponse(BaseModel):
    """Response for grid data query"""
    meta: Dict[str, Any]  # {page, limit, total}
    columns: List[GridColumn]
    rows: List[GridRow]


class SessionStatistics:
    """Helper class for session statistics"""
    
    @staticmethod
    def calculate_statistics(edits: List[CellEdit]) -> Dict[str, int]:
        """Calculate statistics from edits"""
        unique_rows = set(edit.row_id for edit in edits)
        unique_cells = set(f"{edit.row_id}:{edit.column}" for edit in edits)
        
        return {
            "total_edits": len(edits),
            "rows_affected": len(unique_rows),
            "cells_changed": len(unique_cells),
            "valid_edits": sum(1 for e in edits if e.is_valid),
            "invalid_edits": sum(1 for e in edits if not e.is_valid),
        }


# Session TTL configuration
DEFAULT_SESSION_TTL_HOURS = 24

def calculate_session_expiry() -> datetime:
    """Calculate session expiry time"""
    return datetime.utcnow() + timedelta(hours=DEFAULT_SESSION_TTL_HOURS)
