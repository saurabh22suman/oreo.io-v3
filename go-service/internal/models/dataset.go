package models

import "time"

type Dataset struct {
	ID         uint   `json:"id" gorm:"primaryKey"`
	VanityTag  string `json:"vanity_tag" gorm:"size:50;uniqueIndex"`
	ProjectID  uint   `json:"project_id" gorm:"not null;uniqueIndex:uniq_project_name"`
	Name       string `json:"name" gorm:"size:200;not null;uniqueIndex:uniq_project_name"`
	Source     string `json:"source" gorm:"size:50"`      // local | s3 | azure | gcs
	TargetType string `json:"target_type" gorm:"size:50"` // postgres, etc
	TargetDSN  string `json:"target_dsn" gorm:"size:1000"`
	// Structured target fields for clarity and querying. Kept optional for backward compatibility.
	TargetDatabase string `json:"target_database" gorm:"size:200"`
	TargetSchema   string `json:"target_schema" gorm:"size:200"`
	TargetTable    string `json:"target_table" gorm:"size:200"`
	// New: choose storage backend per dataset ("postgres" or "delta")
	StorageBackend string     `json:"storage_backend" gorm:"size:50"`
	Schema         string     `json:"schema" gorm:"type:text"`
	Rules          string     `json:"rules" gorm:"type:text"`
	LastUploadPath string     `json:"last_upload_path" gorm:"size:500"`
	LastUploadAt   *time.Time `json:"last_upload_at"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`

	// Relations (optional for eager loading)
	// Project Project `gorm:"constraint:OnDelete:CASCADE;"`
}
