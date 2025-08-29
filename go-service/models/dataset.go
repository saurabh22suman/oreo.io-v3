package models

import "time"

type Dataset struct {
	ID             uint       `json:"id" gorm:"primaryKey"`
	ProjectID      uint       `json:"project_id" gorm:"not null;uniqueIndex:uniq_project_name"`
	Name           string     `json:"name" gorm:"size:200;not null;uniqueIndex:uniq_project_name"`
	Source         string     `json:"source" gorm:"size:50"`      // local | s3 | azure | gcs
	TargetType     string     `json:"target_type" gorm:"size:50"` // postgres, etc
	TargetDSN      string     `json:"target_dsn" gorm:"size:1000"`
	Schema         string     `json:"schema" gorm:"type:text"`
	Rules          string     `json:"rules" gorm:"type:text"`
	LastUploadPath string     `json:"last_upload_path" gorm:"size:500"`
	LastUploadAt   *time.Time `json:"last_upload_at"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`

	// Relations (optional for eager loading)
	// Project Project `gorm:"constraint:OnDelete:CASCADE;"`
}
