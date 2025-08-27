package models

import "time"

type Project struct {
    ID          uint      `json:"id" gorm:"primaryKey"`
    Name        string    `json:"name" gorm:"size:200;not null;uniqueIndex"`
    Description string    `json:"description" gorm:"size:2000"`
    OwnerID     uint      `json:"owner_id" gorm:"index"`
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}
