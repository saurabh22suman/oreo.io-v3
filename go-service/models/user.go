package models

import "time"

type User struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	Email    string `gorm:"uniqueIndex;size:255" json:"email"`
	Password string `json:"-"` // hashed
	Role     string `gorm:"size:32" json:"role"`
	// Profile fields
	Name      string `gorm:"size:255" json:"name"`
	Phone     string `gorm:"size:64" json:"phone"`
	AvatarURL string `gorm:"size:1024" json:"avatar_url"`
	// Email verification workflow (optional)
	PendingEmail    string     `gorm:"size:255" json:"pending_email"`
	EmailVerifiedAt *time.Time `json:"email_verified_at"`
	// User preferences stored as JSON (jsonb on Postgres)
	Preferences JSONB     `gorm:"type:jsonb" json:"preferences"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}
