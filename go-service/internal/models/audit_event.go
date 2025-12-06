package models

import (
	"time"
)

// AuditEvent stores normalized audit events for the audit timeline
// Events are aggregated from multiple sources: change_requests, delta_log, validation_runs, etc.
type AuditEvent struct {
	ID          uint64 `json:"id" gorm:"primaryKey;autoIncrement:true"`
	ProjectID   uint   `json:"project_id" gorm:"index;not null"`
	DatasetID   uint   `json:"dataset_id" gorm:"index;not null"`
	EventType   string `json:"event_type" gorm:"size:50;index"` // edit, append, cr_created, cr_approved, cr_rejected, cr_merged, restore, schema_change, rule_change, validation
	Title       string `json:"title" gorm:"size:500"`           // Human-readable title
	Description string `json:"description" gorm:"type:text"`    // Detailed description
	ActorID     uint   `json:"actor_id" gorm:"index"`           // User who performed the action
	ActorEmail  string `json:"actor_email" gorm:"size:255"`     // Cached actor email for display
	SnapshotID  string `json:"snapshot_id" gorm:"size:100"`     // Reference to delta snapshot (e.g., "snap_14")
	Version     int64  `json:"version"`                         // Delta version number (internal, not exposed directly in UI)

	// Related entity references
	ChangeRequestID *uint  `json:"change_request_id" gorm:"index"` // If event is related to a CR
	EntityType      string `json:"entity_type" gorm:"size:50"`     // dataset, change_request, schema, rule, etc.
	EntityID        string `json:"entity_id" gorm:"size:100"`      // ID of the related entity

	// Summary metrics
	RowsAdded    int `json:"rows_added"`
	RowsUpdated  int `json:"rows_updated"`
	RowsDeleted  int `json:"rows_deleted"`
	CellsChanged int `json:"cells_changed"`
	Warnings     int `json:"warnings"`
	Errors       int `json:"errors"`

	// Paths to audit files (relative to delta root)
	DiffPath       string `json:"diff_path" gorm:"size:500"`
	ValidationPath string `json:"validation_path" gorm:"size:500"`
	MetadataPath   string `json:"metadata_path" gorm:"size:500"`

	// Additional metadata as JSON
	Metadata JSONB `json:"metadata" gorm:"type:jsonb"`

	CreatedAt time.Time `json:"created_at" gorm:"index"`
}

// AuditEventType constants for event types
const (
	AuditEventTypeEdit           = "edit"
	AuditEventTypeAppend         = "append"
	AuditEventTypeCRCreated      = "cr_created"
	AuditEventTypeCRApproved     = "cr_approved"
	AuditEventTypeCRRejected     = "cr_rejected"
	AuditEventTypeCRMerged       = "cr_merged"
	AuditEventTypeCRWithdrawn    = "cr_withdrawn"
	AuditEventTypeRestore        = "restore"
	AuditEventTypeSchemaChange   = "schema_change"
	AuditEventTypeRuleChange     = "rule_change"
	AuditEventTypeValidation     = "validation"
	AuditEventTypeUpload         = "upload"
	AuditEventTypeDatasetCreated = "dataset_created"
)

// AuditEventListResponse is the response format for listing audit events
type AuditEventListResponse struct {
	AuditID     string                 `json:"audit_id"`
	SnapshotID  string                 `json:"snapshot_id"`
	Type        string                 `json:"type"`
	Title       string                 `json:"title"`
	Description string                 `json:"description,omitempty"`
	CreatedBy   string                 `json:"created_by"`
	ActorEmail  string                 `json:"actor_email"`
	Timestamp   time.Time              `json:"timestamp"`
	Summary     AuditEventSummary      `json:"summary"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// AuditEventSummary contains summary metrics for an audit event
type AuditEventSummary struct {
	RowsAdded    int `json:"rows_added"`
	RowsUpdated  int `json:"rows_updated"`
	RowsDeleted  int `json:"rows_deleted"`
	CellsChanged int `json:"cells_changed"`
	Warnings     int `json:"warnings"`
	Errors       int `json:"errors"`
}

// AuditEventDetailResponse is the response format for getting audit event details
type AuditEventDetailResponse struct {
	AuditID        string                 `json:"audit_id"`
	SnapshotID     string                 `json:"snapshot_id"`
	Type           string                 `json:"type"`
	Title          string                 `json:"title"`
	Description    string                 `json:"description"`
	CreatedBy      string                 `json:"created_by"`
	ActorEmail     string                 `json:"actor_email"`
	Timestamp      time.Time              `json:"timestamp"`
	Summary        AuditEventSummary      `json:"summary"`
	DiffPath       string                 `json:"diff_path,omitempty"`
	ValidationPath string                 `json:"validation_path,omitempty"`
	MetadataPath   string                 `json:"metadata_path,omitempty"`
	Diff           map[string]interface{} `json:"diff,omitempty"`
	Validation     map[string]interface{} `json:"validation,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	RelatedCR      *ChangeRequestBrief    `json:"related_cr,omitempty"`
}

// ChangeRequestBrief is a brief summary of a related change request
type ChangeRequestBrief struct {
	ID     uint   `json:"id"`
	Title  string `json:"title"`
	Type   string `json:"type"`
	Status string `json:"status"`
}
