package controllers

import (
	"net/mail"
	"time"

	"github.com/gin-gonic/gin"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
	"github.com/oreo-io/oreo.io-v2/go-service/models"
)

// Get current user's profile
func MeProfile(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	uidIfc, _ := c.Get("user_id")
	var uid uint
	switch v := uidIfc.(type) {
	case float64:
		uid = uint(v)
	case uint:
		uid = v
	case int:
		uid = uint(v)
	}
	if uid == 0 {
		c.JSON(401, gin.H{"error": "unauthorized"})
		return
	}
	var u models.User
	if err := gdb.First(&u, uid).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}
	// Hide password
	u.Password = ""
	c.JSON(200, u)
}

type ProfileUpdate struct {
	Name      string `json:"name"`
	Email     string `json:"email"`
	Phone     string `json:"phone"`
	AvatarURL string `json:"avatar_url"`
}

// Update current user's profile (email change requires verification workflow; store to PendingEmail)
func MeProfileUpdate(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	uidIfc, _ := c.Get("user_id")
	var uid uint
	switch v := uidIfc.(type) {
	case float64:
		uid = uint(v)
	case uint:
		uid = v
	case int:
		uid = uint(v)
	}
	if uid == 0 {
		c.JSON(401, gin.H{"error": "unauthorized"})
		return
	}
	var u models.User
	if err := gdb.First(&u, uid).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}
	var in ProfileUpdate
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(400, gin.H{"error": "invalid_payload"})
		return
	}
	if in.Name != "" {
		u.Name = in.Name
	}
	if in.Phone != "" {
		u.Phone = in.Phone
	}
	if in.AvatarURL != "" {
		u.AvatarURL = in.AvatarURL
	}
	if in.Email != "" && in.Email != u.Email {
		if _, err := mail.ParseAddress(in.Email); err != nil {
			c.JSON(400, gin.H{"error": "invalid_email"})
			return
		}
		// Set pending email; actual verification flow not implemented here
		u.PendingEmail = in.Email
		u.EmailVerifiedAt = nil
	}
	if err := gdb.Save(&u).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	u.Password = ""
	c.JSON(200, u)
}

// Get/Set preferences
func MePreferencesGet(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	uidIfc, _ := c.Get("user_id")
	var uid uint
	switch v := uidIfc.(type) {
	case float64:
		uid = uint(v)
	case uint:
		uid = v
	case int:
		uid = uint(v)
	}
	if uid == 0 {
		c.JSON(401, gin.H{"error": "unauthorized"})
		return
	}
	var u models.User
	if err := gdb.Select("id,preferences").First(&u, uid).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}
	if u.Preferences == nil {
		u.Preferences = models.JSONB{}
	}
	c.JSON(200, u.Preferences)
}

func MePreferencesUpdate(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	uidIfc, _ := c.Get("user_id")
	var uid uint
	switch v := uidIfc.(type) {
	case float64:
		uid = uint(v)
	case uint:
		uid = v
	case int:
		uid = uint(v)
	}
	if uid == 0 {
		c.JSON(401, gin.H{"error": "unauthorized"})
		return
	}
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(400, gin.H{"error": "invalid_payload"})
		return
	}
	// Ensure only expected keys? For now, accept any map and store.
	prefs := models.JSONB(body)
	// optional: update derived theme timestamp
	prefs["_updated_at"] = time.Now().UTC().Format(time.RFC3339)
	if err := gdb.Model(&models.User{}).Where("id = ?", uid).Update("preferences", prefs).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	c.JSON(200, prefs)
}
