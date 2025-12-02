package models

import "time"

// SharedQuery stores publicly shareable query results
type SharedQuery struct {
	ID          string    `json:"id" gorm:"primaryKey;size:32"`
	DatasetID   uint      `json:"dataset_id" gorm:"index"`
	ProjectID   uint      `json:"project_id" gorm:"index"`
	UserID      uint      `json:"user_id" gorm:"index"`
	SQL         string    `json:"sql" gorm:"type:text"`
	Columns     string    `json:"columns" gorm:"type:text"`     // JSON array of column names
	Rows        string    `json:"rows" gorm:"type:text"`        // JSON array of row data
	Total       int       `json:"total"`
	DatasetName string    `json:"dataset_name" gorm:"size:255"`
	ProjectName string    `json:"project_name" gorm:"size:255"`
	CreatedAt   time.Time `json:"created_at"`
	ExpiresAt   *time.Time `json:"expires_at"` // Optional expiration
}
