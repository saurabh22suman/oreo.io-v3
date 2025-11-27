package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/internal/database"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/models"
)

// NotifyHub is a lightweight, in-process pub/sub for user-scoped events (SSE).
type NotifyHub struct {
	mu   sync.RWMutex
	subs map[uint]map[chan []byte]struct{}
}

func NewNotifyHub() *NotifyHub {
	return &NotifyHub{subs: make(map[uint]map[chan []byte]struct{})}
}

// global hub instance
var NotifHub = NewNotifyHub()

// Subscribe registers a listener for a user and returns a channel and an unsubscribe func.
func (h *NotifyHub) Subscribe(userID uint) (chan []byte, func()) {
	ch := make(chan []byte, 8)
	h.mu.Lock()
	if h.subs[userID] == nil {
		h.subs[userID] = make(map[chan []byte]struct{})
	}
	h.subs[userID][ch] = struct{}{}
	h.mu.Unlock()
	return ch, func() {
		h.mu.Lock()
		if m, ok := h.subs[userID]; ok {
			delete(m, ch)
			if len(m) == 0 {
				delete(h.subs, userID)
			}
		}
		h.mu.Unlock()
		close(ch)
	}
}

// Publish sends a payload to all subscribers for a user.
func (h *NotifyHub) Publish(userID uint, payload []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for ch := range h.subs[userID] {
		select {
		case ch <- payload:
		default: /* drop if slow */
		}
	}
}

// PublishUnreadCount computes current unread count and broadcasts it.
func (h *NotifyHub) PublishUnreadCount(userID uint) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			return
		}
		gdb = dbpkg.Get()
	}
	var cnt int64
	_ = gdb.Model(&models.Notification{}).Where("user_id = ? AND is_read = ?", userID, false).Count(&cnt).Error
	type evt struct {
		Type  string `json:"type"`
		Count int64  `json:"count"`
	}
	b, _ := json.Marshal(evt{Type: "unread_count", Count: cnt})
	h.Publish(userID, b)
}

// NotificationsStream streams server-sent events for the authenticated user.
func NotificationsStream(c *gin.Context) {
	// user id is set by AuthMiddleware
	uidVal, _ := c.Get("user_id")
	uid := uint(0)
	switch v := uidVal.(type) {
	case uint:
		uid = v
	case int:
		uid = uint(v)
	case int64:
		uid = uint(v)
	case float64:
		uid = uint(v)
	}
	if uid == 0 {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	// headers for SSE
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no") // disable nginx buffering if any

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	ch, unsub := NotifHub.Subscribe(uid)
	defer unsub()

	// Send initial unread count
	NotifHub.PublishUnreadCount(uid)

	ctx := c.Request.Context()
	// stream loop
	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-ch:
			// SSE data frame
			fmt.Fprintf(c.Writer, "data: %s\n\n", msg)
			flusher.Flush()
		}
	}
}
