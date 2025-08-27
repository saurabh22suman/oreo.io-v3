package models

import "time"

type User struct {
    ID        uint      `gorm:"primaryKey" json:"id"`
    Email     string    `gorm:"uniqueIndex;size:255" json:"email"`
    Password  string    `json:"-"` // hashed
    Role      string    `gorm:"size:32" json:"role"`
    CreatedAt time.Time `json:"createdAt"`
    UpdatedAt time.Time `json:"updatedAt"`
}
