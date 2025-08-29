package models

import "time"

type ChangeRequest struct {
	ID         uint `json:"id" gorm:"primaryKey"`
	ProjectID  uint `json:"project_id" gorm:"index"`
	DatasetID  uint `json:"dataset_id" gorm:"index"`
	UserID     uint `json:"user_id" gorm:"index"`
	ReviewerID uint `json:"reviewer_id" gorm:"index"`
	// JSON array of reviewer user IDs for multi-reviewer support
	Reviewers string `json:"reviewers" gorm:"type:text"`
	// JSON array of objects: [{"id":<user_id>, "status":"pending|approved|rejected", "decided_at":"RFC3339"}]
	ReviewerStates string    `json:"reviewer_states" gorm:"type:text"`
	Type           string    `json:"type" gorm:"size:50"`   // e.g., "append"
	Status         string    `json:"status" gorm:"size:50"` // pending|approved|rejected|withdrawn
	Title          string    `json:"title" gorm:"size:200"`
	Payload        string    `json:"payload" gorm:"type:text"` // JSON rows or metadata
	Summary        string    `json:"summary" gorm:"type:text"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
