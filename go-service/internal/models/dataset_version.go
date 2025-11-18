package models

import "time"

// DatasetVersion captures a versioned snapshot or reference of a dataset.
// Data can store a JSON array snapshot or a reference (e.g., table name) depending on ingestion mode.
type DatasetVersion struct {
	ID        uint `json:"id" gorm:"primaryKey"`
	DatasetID uint `json:"dataset_id" gorm:"index;not null"`
	// Either raw JSON (text/jsonb) or a table reference string (e.g., staging or main table at that time)
	Data     string    `json:"data" gorm:"type:text"`
	EditedBy uint      `json:"edited_by" gorm:"index"`
	EditedAt time.Time `json:"edited_at"`
	Status   string    `json:"status" gorm:"size:50"` // draft|approved
	// JSON array of approver user IDs or enriched objects
	Approvers string `json:"approvers" gorm:"type:text"`
}
