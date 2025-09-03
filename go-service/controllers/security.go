package controllers

import (
	"context"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
	"github.com/oreo-io/oreo.io-v2/go-service/models"
	"github.com/redis/go-redis/v9"
)

// RegisterSecurityRoutes wires security and governance endpoints
func RegisterSecurityRoutes(r *gin.Engine) {
	api := r.Group("/api")
	sec := api.Group("/security", AuthMiddleware())
	{
		sec.POST("/sessions", createSession)
		sec.DELETE("/sessions/:sessionId", revokeSession)
		sec.GET("/sessions", listSessions)

		sec.POST("/audit", writeAudit)
		sec.GET("/audit", listAudit)

		sec.POST("/activities", createActivity)
		sec.GET("/activities", listActivities)

		// Notifications (inbox)
		sec.POST("/notifications", createNotification)             // system/admin create
		sec.GET("/notifications", listNotifications)               // list mine
		sec.POST("/notifications/read", markNotificationsRead)     // bulk mark read
		sec.POST("/notifications/unread", markNotificationsUnread) // bulk mark unread
		sec.GET("/notifications/unread_count", unreadCount)
		sec.GET("/notifications/stream", NotificationsStream) // SSE stream

		sec.POST("/dq/rules", createDQRule)
		sec.GET("/dq/rules", listDQRULES)
		sec.POST("/dq/results", createDQResult)
		sec.GET("/dq/results", listDQResults)
	}
}

func createSession(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"ok": false, "reason": "todo"})
}

// listSessions returns sessions for the current user or all sessions for admin
func listSessions(c *gin.Context) {
	db := dbpkg.Get()
	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "db unavailable"})
		return
	}

	// If admin, allow listing all sessions; otherwise, only list for current user
	userIDIfc, _ := c.Get("user_id")
	userRoleIfc, _ := c.Get("user_role")
	var sessions []models.UserSession

	if userRoleIfc == "admin" {
		if err := db.Order("created_at desc").Find(&sessions).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "sessions": sessions})
		return
	}

	// normal user
	userID, _ := userIDIfc.(uint)
	if err := db.Where("user_id = ?", userID).Order("created_at desc").Find(&sessions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "sessions": sessions})
}

// revokeSession marks a session as revoked. Users can revoke their own sessions; admins can revoke any.
func revokeSession(c *gin.Context) {
	db := dbpkg.Get()
	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "db unavailable"})
		return
	}
	sid := c.Param("sessionId")
	if sid == "" {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "missing sessionId"})
		return
	}

	var s models.UserSession
	if err := db.Where("session_id = ?", sid).First(&s).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"ok": false, "error": "session not found"})
		return
	}

	userIDIfc, _ := c.Get("user_id")
	userRoleIfc, _ := c.Get("user_role")
	userID, _ := userIDIfc.(uint)

	if userRoleIfc != "admin" && s.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"ok": false, "error": "forbidden"})
		return
	}

	s.Revoked = true
	// bump expiry to now
	s.ExpiresAt = time.Now()
	// capture refresh token hash before clearing
	refHash := s.RefreshTokenHash
	s.RefreshTokenHash = ""
	if err := db.Save(&s).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}

	// If REDIS_URL is configured, attempt to remove any refresh token entry
	if refHash != "" {
		if ru := os.Getenv("REDIS_URL"); ru != "" {
			if opts, err := redis.ParseURL(ru); err == nil {
				rdb := redis.NewClient(opts)
				_ = rdb.Del(context.Background(), "refresh:"+refHash).Err()
				_ = rdb.Close()
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// writeAudit appends an AuditLog entry. Expects JSON body matching AuditLog fields.
func writeAudit(c *gin.Context) {
	db := dbpkg.Get()
	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "db unavailable"})
		return
	}

	var a models.AuditLog
	if err := c.ShouldBindJSON(&a); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid body"})
		return
	}

	// Authorization: caller must be admin or a member of the project
	userIDIfc, _ := c.Get("user_id")
	userRoleIfc, _ := c.Get("user_role")
	// allow admins
	if userRoleIfc != "admin" {
		// project must be set
		if a.ProjectID == 0 {
			c.JSON(http.StatusForbidden, gin.H{"ok": false, "error": "forbidden"})
			return
		}
		// check membership in project
		uid := uint(0)
		switch v := userIDIfc.(type) {
		case uint:
			uid = v
		case int:
			uid = uint(v)
		case int64:
			uid = uint(v)
		case float64:
			uid = uint(v)
		}
		var pr models.ProjectRole
		if err := dbpkg.Get().Where("project_id = ? AND user_id = ?", a.ProjectID, uid).First(&pr).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"ok": false, "error": "forbidden"})
			return
		}
	}

	// populate timestamp and insert (append-only)
	a.CreatedAt = time.Now()
	if err := db.Create(&a).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"ok": true, "audit_id": a.ID})
}

func listAudit(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"ok": false, "reason": "todo"})
}

func createActivity(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"ok": false, "reason": "todo"})
}
func listActivities(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"ok": false, "reason": "todo"})
}

func createNotification(c *gin.Context) {
	// Allow admins to create notifications for any user; normal users can only create for self
	db := dbpkg.Get()
	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "db unavailable"})
		return
	}
	var in struct {
		UserID   uint         `json:"user_id"`
		Message  string       `json:"message" binding:"required"`
		Metadata models.JSONB `json:"metadata"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid body"})
		return
	}
	uidVal, _ := c.Get("user_id")
	role, _ := c.Get("user_role")
	acting := uint(0)
	switch v := uidVal.(type) {
	case uint:
		acting = v
	case int:
		acting = uint(v)
	case int64:
		acting = uint(v)
	case float64:
		acting = uint(v)
	}
	target := in.UserID
	if role != "admin" {
		// Only allow creating for self
		target = acting
	}
	n := models.Notification{UserID: target, Message: in.Message, IsRead: false, Metadata: in.Metadata, CreatedAt: time.Now()}
	if err := db.Create(&n).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}
	// push updated unread count
	NotifHub.PublishUnreadCount(target)
	c.JSON(http.StatusCreated, gin.H{"ok": true, "id": n.ID})
}
func listNotifications(c *gin.Context) {
	db := dbpkg.Get()
	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "db unavailable"})
		return
	}
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
	// Optional filter: status=unread|read|all (default all)
	status := c.Query("status")
	q := db.Where("user_id = ?", uid)
	if status == "unread" {
		q = q.Where("is_read = ?", false)
	} else if status == "read" {
		q = q.Where("is_read = ?", true)
	}
	// Pagination
	limit := 50
	offset := 0
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 200 {
			limit = n
		}
	}
	if v := c.Query("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}
	var total int64
	_ = q.Model(&models.Notification{}).Count(&total).Error
	var items []models.Notification
	if err := q.Order("created_at desc").Limit(limit).Offset(offset).Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "items": items, "total": total})
}
func markNotificationsRead(c *gin.Context) {
	db := dbpkg.Get()
	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "db unavailable"})
		return
	}
	var in struct {
		IDs []uint64 `json:"ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&in); err != nil || len(in.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid body"})
		return
	}
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
	if err := db.Model(&models.Notification{}).Where("user_id = ? AND id IN ?", uid, in.IDs).Update("is_read", true).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}
	NotifHub.PublishUnreadCount(uid)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
func markNotificationsUnread(c *gin.Context) {
	db := dbpkg.Get()
	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "db unavailable"})
		return
	}
	var in struct {
		IDs []uint64 `json:"ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&in); err != nil || len(in.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid body"})
		return
	}
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
	if err := db.Model(&models.Notification{}).Where("user_id = ? AND id IN ?", uid, in.IDs).Update("is_read", false).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}
	NotifHub.PublishUnreadCount(uid)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
func unreadCount(c *gin.Context) {
	db := dbpkg.Get()
	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "db unavailable"})
		return
	}
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
	var cnt int64
	if err := db.Model(&models.Notification{}).Where("user_id = ? AND is_read = ?", uid, false).Count(&cnt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "count": cnt})
}

func createDQRule(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"ok": false, "reason": "todo"})
}
func listDQRULES(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"ok": false, "reason": "todo"})
}
func createDQResult(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"ok": false, "reason": "todo"})
}
func listDQResults(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"ok": false, "reason": "todo"})
}
