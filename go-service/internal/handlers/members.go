package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/internal/database"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/models"
)

type MemberIn struct {
	Email string `json:"email" binding:"required,email"`
	// Accept 'contributor' (new) and 'editor' (legacy alias)
	Role string `json:"role" binding:"required,oneof=owner editor contributor viewer"`
}

// MembersList returns members for a project (any project role can view)
func MembersList(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pidOrTag := c.Param("id")
	project, err := LookupProjectByIDOrTag(gdb, pidOrTag)
	if err != nil {
		c.JSON(404, gin.H{"error": "project_not_found"})
		return
	}
	if !HasProjectRole(c, project.ID, "owner", "contributor", "viewer") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	var roles []models.ProjectRole
	if err := gdb.Where("project_id = ?", project.ID).Find(&roles).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	type Member struct {
		ID    uint   `json:"id"`
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	out := make([]Member, 0, len(roles))
	for _, pr := range roles {
		var u models.User
		if err := gdb.First(&u, pr.UserID).Error; err == nil {
			out = append(out, Member{ID: u.ID, Email: u.Email, Role: normalizeRole(pr.Role)})
		}
	}
	c.JSON(200, out)
}

// MembersUpsert adds or updates a member role (owner only)
func MembersUpsert(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pidOrTag := c.Param("id")
	project, err := LookupProjectByIDOrTag(gdb, pidOrTag)
	if err != nil {
		c.JSON(404, gin.H{"error": "project_not_found"})
		return
	}
	if !HasProjectRole(c, project.ID, "owner") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	var in MemberIn
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(400, gin.H{"error": "invalid_payload"})
		return
	}
	// find or create user by email
	var u models.User
	if err := gdb.Where("email = ?", in.Email).First(&u).Error; err != nil {
		// create with empty password placeholder
		u.Email = in.Email
		if err2 := gdb.Create(&u).Error; err2 != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
	}
	// Prevent demoting the project owner to a lower role
	if u.ID == project.OwnerID && normalizeRole(in.Role) != "owner" {
		c.JSON(400, gin.H{"error": "cannot_demote_owner"})
		return
	}
	// upsert project role (normalize role name)
	var pr models.ProjectRole
	if err := gdb.Where("project_id = ? AND user_id = ?", project.ID, u.ID).First(&pr).Error; err != nil {
		pr = models.ProjectRole{ProjectID: project.ID, UserID: u.ID, Role: normalizeRole(in.Role)}
		if err := gdb.Create(&pr).Error; err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		// Notify the user they were added to the project
		_ = AddNotification(u.ID, "You were added to a project", models.JSONB{"type": "project_member_added", "project_id": project.ID, "project_name": project.Name, "role": pr.Role})
	} else {
		pr.Role = normalizeRole(in.Role)
		if err := gdb.Save(&pr).Error; err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
	}
	c.JSON(200, gin.H{"id": u.ID, "email": u.Email, "role": pr.Role})
}

// MembersDelete removes a member (owner only)
func MembersDelete(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pidOrTag := c.Param("id")
	project, err := LookupProjectByIDOrTag(gdb, pidOrTag)
	if err != nil {
		c.JSON(404, gin.H{"error": "project_not_found"})
		return
	}
	if !HasProjectRole(c, project.ID, "owner") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	// Prevent removing self and prevent removing the project owner
	targetUID, _ := strconv.Atoi(c.Param("userId"))
	// Read current user id from JWT
	meVal, has := c.Get("user_id")
	var me uint
	if has {
		switch v := meVal.(type) {
		case float64:
			me = uint(v)
		case int:
			me = uint(v)
		case uint:
			me = v
		}
	}
	if me != 0 && me == uint(targetUID) {
		c.JSON(400, gin.H{"error": "cannot_remove_self"})
		return
	}
	// Disallow removing the project owner
	if uint(targetUID) == project.OwnerID {
		c.JSON(400, gin.H{"error": "cannot_remove_owner"})
		return
	}
	if err := gdb.Where("project_id = ? AND user_id = ?", project.ID, targetUID).Delete(&models.ProjectRole{}).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	c.Status(http.StatusNoContent)
}

// MemberMyRole returns the current user's role for this project
func MemberMyRole(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pidOrTag := c.Param("id")
	project, err := LookupProjectByIDOrTag(gdb, pidOrTag)
	if err != nil {
		c.JSON(404, gin.H{"error": "project_not_found"})
		return
	}
	// must be part of the project in any capacity to query role
	if !HasProjectRole(c, project.ID, "owner", "contributor", "viewer") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	uidVal, ok := c.Get("user_id")
	if !ok {
		c.JSON(401, gin.H{"error": "unauthorized"})
		return
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
	var pr models.ProjectRole
	if err := gdb.Where("project_id = ? AND user_id = ?", project.ID, uid).First(&pr).Error; err != nil {
		c.JSON(200, gin.H{"role": nil})
		return
	}
	c.JSON(200, gin.H{"role": normalizeRole(pr.Role)})
}
