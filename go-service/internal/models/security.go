package models

import (
	"time"

	"github.com/google/uuid"
)

// UserSession tracks login sessions
type UserSession struct {
	SessionID        uuid.UUID `json:"session_id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID           uint      `json:"user_id" gorm:"index;not null"`
	IPAddress        string    `json:"ip_address" gorm:"size:45"`
	UserAgent        string    `json:"user_agent" gorm:"type:text"`
	RefreshTokenHash string    `json:"refresh_token_hash" gorm:"type:text"`
	CreatedAt        time.Time `json:"created_at"`
	ExpiresAt        time.Time `json:"expires_at"`
	Revoked          bool      `json:"revoked"`
}

// AuditLog is an append-only audit trail
type AuditLog struct {
	ID         uint64    `json:"id" gorm:"primaryKey;autoIncrement:true"`
	ActorID    uint      `json:"actor_id" gorm:"index"`
	ProjectID  uint      `json:"project_id" gorm:"index"`
	EntityType string    `json:"entity_type" gorm:"size:200"`
	EntityID   string    `json:"entity_id" gorm:"size:200"`
	Action     string    `json:"action" gorm:"size:100"`
	OldValue   JSONB     `json:"old_value" gorm:"type:jsonb"`
	NewValue   JSONB     `json:"new_value" gorm:"type:jsonb"`
	IPAddress  string    `json:"ip_address" gorm:"size:45"`
	CreatedAt  time.Time `json:"created_at"`
}

// ProjectActivity powers project timeline
type ProjectActivity struct {
	ID         uint64    `json:"id" gorm:"primaryKey;autoIncrement:true"`
	ProjectID  uint      `json:"project_id" gorm:"index"`
	ActorID    uint      `json:"actor_id" gorm:"index"`
	Action     string    `json:"action" gorm:"size:200"`
	EntityType string    `json:"entity_type" gorm:"size:200"`
	EntityID   string    `json:"entity_id" gorm:"size:200"`
	Details    JSONB     `json:"details" gorm:"type:jsonb"`
	CreatedAt  time.Time `json:"created_at"`
}

// Notification for users
type Notification struct {
	ID        uint64    `json:"id" gorm:"primaryKey;autoIncrement:true"`
	UserID    uint      `json:"user_id" gorm:"index"`
	Message   string    `json:"message" gorm:"type:text"`
	IsRead    bool      `json:"is_read"`
	Metadata  JSONB     `json:"metadata" gorm:"type:jsonb"`
	CreatedAt time.Time `json:"created_at"`
}

// DataQualityRule defines validations for a dataset
type DataQualityRule struct {
	ID         uint64    `json:"id" gorm:"primaryKey;autoIncrement:true"`
	DatasetID  uint      `json:"dataset_id" gorm:"index"`
	RuleType   string    `json:"rule_type" gorm:"size:100"`
	Definition JSONB     `json:"definition" gorm:"type:jsonb"`
	Severity   string    `json:"severity" gorm:"size:20"`
	CreatedAt  time.Time `json:"created_at"`
}

// DataQualityResult stores validation results for uploads
type DataQualityResult struct {
	ID        uint64    `json:"id" gorm:"primaryKey;autoIncrement:true"`
	UploadID  uint      `json:"upload_id" gorm:"index"`
	RuleID    uint64    `json:"rule_id" gorm:"index"`
	Passed    bool      `json:"passed"`
	Details   JSONB     `json:"details" gorm:"type:jsonb"`
	CreatedAt time.Time `json:"created_at"`
}
