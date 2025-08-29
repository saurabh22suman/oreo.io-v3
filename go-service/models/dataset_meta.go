package models

import (
	"os"
	"time"
)

// DatasetMeta stores per-dataset metadata in sys.metadata (Postgres) or sys_metadata (SQLite)
type DatasetMeta struct {
	ID            uint      `json:"id" gorm:"primaryKey"`
	ProjectID     uint      `json:"project_id" gorm:"index"`
	DatasetID     uint      `json:"dataset_id" gorm:"uniqueIndex"`
	OwnerName     string    `json:"owner_name" gorm:"size:200"`
	RowCount      int64     `json:"row_count"`
	ColumnCount   int       `json:"column_count"`
	LastUpdateAt  time.Time `json:"last_update_at"`
	TableLocation string    `json:"table_location" gorm:"size:300"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (DatasetMeta) TableName() string {
	if os.Getenv("DB_DIALECT") == "postgres" {
		return "sys.metadata"
	}
	// default for sqlite
	return "sys_metadata"
}
