package controllers

import (
	"strings"

	"github.com/gin-gonic/gin"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
	"github.com/oreo-io/oreo.io-v2/go-service/models"
)

// HasProjectRole checks if the current user has any of the roles for the given project id.
func HasProjectRole(c *gin.Context, projectID uint, roles ...string) bool {
	uidVal, ok := c.Get("user_id")
	if !ok {
		return false
	}
	var uid uint
	switch v := uidVal.(type) {
	case float64:
		uid = uint(v)
	case int:
		uid = uint(v)
	case uint:
		uid = v
	}
	if uid == 0 {
		return false
	}
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			return false
		}
		gdb = dbpkg.Get()
	}
	var pr models.ProjectRole
	if err := gdb.Where("project_id = ? AND user_id = ?", projectID, uid).First(&pr).Error; err != nil {
		return false
	}
	// Normalize stored role (alias legacy "editor" to "contributor")
	userRole := normalizeRole(pr.Role)
	if len(roles) == 0 {
		return true
	}
	// Build allowed set from requested roles with precedence expansion
	allowed := map[string]struct{}{}
	for _, want := range roles {
		nw := normalizeRole(want)
		for _, ar := range expandAllowedRoles(nw) {
			allowed[ar] = struct{}{}
		}
	}
	_, ok = allowed[userRole]
	return ok
}

// normalizeRole lower-cases and maps legacy names to current ones
func normalizeRole(role string) string {
	r := strings.ToLower(strings.TrimSpace(role))
	if r == "editor" {
		return "contributor"
	}
	return r
}

// expandAllowedRoles applies precedence so higher roles satisfy lower role checks
// Order of precedence (high->low): owner > contributor (prev. editor) > approver > viewer
func expandAllowedRoles(want string) []string {
	switch want {
	case "owner":
		return []string{"owner"}
	case "contributor":
		return []string{"contributor", "owner"}
	case "approver":
		return []string{"approver", "contributor", "owner"}
	case "viewer":
		return []string{"viewer", "approver", "contributor", "owner"}
	default:
		return []string{want}
	}
}
