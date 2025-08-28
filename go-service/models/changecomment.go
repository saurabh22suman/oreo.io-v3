package models

import "time"

type ChangeComment struct {
    ID             uint      `json:"id" gorm:"primaryKey"`
    ProjectID      uint      `json:"project_id" gorm:"index"`
    ChangeRequestID uint     `json:"change_request_id" gorm:"index"`
    UserID         uint      `json:"user_id" gorm:"index"`
    Body           string    `json:"body" gorm:"type:text"`
    CreatedAt      time.Time `json:"created_at"`
}
