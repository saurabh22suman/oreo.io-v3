package models

import "time"

// QueryHistory stores past executed queries for auditing
type QueryHistory struct {
	ID         uint      `json:"id" gorm:"primaryKey"`
	ProjectID  uint      `json:"project_id" gorm:"index"`
	UserID     uint      `json:"user_id" gorm:"index"`
	SQL        string    `json:"sql" gorm:"type:text"`
	ResultRows int       `json:"result_rows"`
	CreatedAt  time.Time `json:"created_at"`
}
