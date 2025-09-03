package controllers

import (
	"strconv"

	"github.com/gin-gonic/gin"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
	"github.com/oreo-io/oreo.io-v2/go-service/models"
)

type ProjectIn struct {
	Name        string `json:"name" binding:"required,min=1"`
	Description string `json:"description"`
}

func ProjectsList(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	var items []models.Project
	// Optionally filter by owner/membership
	var uidNum uint = 0
	if uid, ok := c.Get("user_id"); ok {
		// Coerce numeric types to uint for safe SQL params
		switch v := uid.(type) {
		case float64:
			uidNum = uint(v)
		case float32:
			uidNum = uint(v)
		case int:
			uidNum = uint(v)
		case int64:
			uidNum = uint(v)
		case uint:
			uidNum = v
		case string:
			// try parse numeric strings
			// fallthrough to 0 if parse fails
		}
		if uidNum != 0 {
			// Show projects owned by the user OR where the user is a member in project_roles
			gdb = gdb.Where("owner_id = ? OR id IN (SELECT project_id FROM project_roles WHERE user_id = ?)", uidNum, uidNum)
		}
	}
	if err := gdb.Order("id desc").Find(&items).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}

	// Build response that includes dataset counts per project for frontend
	out := make([]map[string]interface{}, 0, len(items))
	for _, p := range items {
		var cnt int64
		// Use a fresh DB session for the count so previous query clauses on `gdb` don't leak into this query
		_ = dbpkg.Get().Model(&models.Dataset{}).Where("project_id = ?", p.ID).Count(&cnt).Error
		// determine this user's role on the project (if any)
		role := ""
		if uidNum != 0 {
			var pr models.ProjectRole
			if err := dbpkg.Get().Where("project_id = ? AND user_id = ?", p.ID, uidNum).First(&pr).Error; err == nil {
				role = pr.Role
			}
		}

		// load members (user_id, email, role)
		type memberRow struct {
			UserID uint   `json:"user_id"`
			Email  string `json:"email"`
			Role   string `json:"role"`
		}
		var members []memberRow
		_ = dbpkg.Get().Table("project_roles").Select("project_roles.user_id, project_roles.role, users.email").Joins("left join users on users.id = project_roles.user_id").Where("project_roles.project_id = ?", p.ID).Scan(&members).Error

		m := map[string]interface{}{
			"id":           p.ID,
			"name":         p.Name,
			"description":  p.Description,
			"owner_id":     p.OwnerID,
			"created_at":   p.CreatedAt,
			"updated_at":   p.UpdatedAt,
			"datasetCount": cnt,
			"role":         role,
			"members":      members,
		}
		out = append(out, m)
	}
	c.JSON(200, out)
}

func ProjectsCreate(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	var in ProjectIn
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(400, gin.H{"error": "invalid_payload"})
		return
	}
	var ownerID uint = 0
	if uid, ok := c.Get("user_id"); ok {
		switch v := uid.(type) {
		case float64:
			ownerID = uint(v)
		case int:
			ownerID = uint(v)
		case uint:
			ownerID = v
		}
	}
	p := models.Project{Name: in.Name, Description: in.Description, OwnerID: ownerID}
	if err := gdb.Create(&p).Error; err != nil {
		c.JSON(409, gin.H{"error": "name_conflict"})
		return
	}
	if ownerID != 0 {
		_ = gdb.Create(&models.ProjectRole{ProjectID: p.ID, UserID: ownerID, Role: "owner"}).Error
	}
	c.JSON(201, p)
}

func ProjectsGet(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	idStr := c.Param("id")
	id, _ := strconv.Atoi(idStr)
	var p models.Project
	if err := gdb.First(&p, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}
	// Role: any role can view
	if !HasProjectRole(c, p.ID, "owner", "contributor", "viewer") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	c.JSON(200, p)
}

func ProjectsUpdate(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	idStr := c.Param("id")
	id, _ := strconv.Atoi(idStr)
	var p models.Project
	if err := gdb.First(&p, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}
	// Role: owner/contributor can update
	if !HasProjectRole(c, p.ID, "owner", "contributor") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	var in ProjectIn
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(400, gin.H{"error": "invalid_payload"})
		return
	}
	p.Name = in.Name
	p.Description = in.Description
	if err := gdb.Save(&p).Error; err != nil {
		c.JSON(409, gin.H{"error": "name_conflict"})
		return
	}
	c.JSON(200, p)
}

func ProjectsDelete(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	idStr := c.Param("id")
	id, _ := strconv.Atoi(idStr)
	var p models.Project
	if err := gdb.First(&p, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}
	// Role: owner can delete
	if !HasProjectRole(c, p.ID, "owner") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	if err := gdb.Where("id = ?", id).Delete(&models.Project{}).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	c.Status(204)
}
