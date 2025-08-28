package models

import "time"

// DatasetUpload stores raw file bytes for an upload operation.
// This enables preview/validation and audit without relying on local filesystem paths.
type DatasetUpload struct {
    ID        uint      `json:"id" gorm:"primaryKey"`
    ProjectID uint      `json:"project_id" gorm:"index"`
    DatasetID uint      `json:"dataset_id" gorm:"index"`
    Filename  string    `json:"filename" gorm:"size:500"`
    Content   []byte    `json:"-" gorm:"type:bytea"` // Postgres bytea; SQLite will map to BLOB
    CreatedAt time.Time `json:"created_at"`
}
