package models

import (
	"time"

	"github.com/google/uuid"
)

// Job represents an async background job (e.g. schema inference)
type Job struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Type      string    `json:"type" gorm:"size:200;index"`
	Status    string    `json:"status" gorm:"size:50;index"` // pending|running|success|failed
	Metadata  JSONB     `json:"metadata" gorm:"type:jsonb"`
	Result    JSONB     `json:"result" gorm:"type:jsonb"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
