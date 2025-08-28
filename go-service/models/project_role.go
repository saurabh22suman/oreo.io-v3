package models

import "time"

// ProjectRole links a user to a project with a role (owner/contributor/approver/viewer)
type ProjectRole struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	ProjectID uint      `json:"project_id" gorm:"index:uniq_project_user,unique;not null"`
	UserID    uint      `json:"user_id" gorm:"index:uniq_project_user,unique;not null"`
	Role      string    `json:"role" gorm:"size:32;not null"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
