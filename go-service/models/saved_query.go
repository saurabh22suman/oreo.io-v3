package models

import "time"

// SavedQuery stores a user-saved query for a project
type SavedQuery struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	ProjectID uint      `json:"project_id" gorm:"index"`
	UserID    uint      `json:"user_id" gorm:"index"`
	Name      string    `json:"name" gorm:"size:255"`
	SQL       string    `json:"sql" gorm:"type:text"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
