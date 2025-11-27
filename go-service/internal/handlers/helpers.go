package handlers

import (
	"encoding/json"
	"time"

	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/internal/database"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/models"
)

// AddNotification inserts a notification for a user.
func AddNotification(userID uint, message string, metadata models.JSONB) error {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			return err
		}
		gdb = dbpkg.Get()
	}
	n := models.Notification{UserID: userID, Message: message, IsRead: false, Metadata: metadata, CreatedAt: time.Now()}
	if err := gdb.Create(&n).Error; err != nil {
		return err
	}
	// Push unread count update
	NotifHub.PublishUnreadCount(userID)
	// Also push the notification payload itself to SSE so clients can react instantly
	// Event shape: { type, message, id, ...metadata }
	payload := map[string]any{"type": "notification", "message": message, "id": n.ID}
	if metadata != nil {
		for k, v := range metadata {
			payload[k] = v
		}
		if t, ok := metadata["type"]; ok {
			payload["type"] = t
		}
	}
	if b, err := json.Marshal(payload); err == nil {
		NotifHub.Publish(userID, b)
	}
	return nil
}

// AddNotificationsBulk inserts notifications for multiple users.
func AddNotificationsBulk(userIDs []uint, message string, metadata models.JSONB) error {
	if len(userIDs) == 0 {
		return nil
	}
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			return err
		}
		gdb = dbpkg.Get()
	}
	now := time.Now()
	items := make([]models.Notification, 0, len(userIDs))
	for _, uid := range userIDs {
		if uid == 0 {
			continue
		}
		items = append(items, models.Notification{UserID: uid, Message: message, IsRead: false, Metadata: metadata, CreatedAt: now})
	}
	if len(items) == 0 {
		return nil
	}
	if err := gdb.Create(&items).Error; err != nil {
		return err
	}
	// publish for each user (coalesce duplicates)
	seen := map[uint]struct{}{}
	for _, it := range items {
		if _, ok := seen[it.UserID]; ok {
			continue
		}
		seen[it.UserID] = struct{}{}
		NotifHub.PublishUnreadCount(it.UserID)
		// Also publish the event payload for each distinct user
		payload := map[string]any{"type": "notification", "message": message, "id": it.ID}
		if metadata != nil {
			for k, v := range metadata {
				payload[k] = v
			}
			if t, ok := metadata["type"]; ok {
				payload["type"] = t
			}
		}
		if b, err := json.Marshal(payload); err == nil {
			NotifHub.Publish(it.UserID, b)
		}
	}
	return nil
}
