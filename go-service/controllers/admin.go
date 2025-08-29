package controllers

import (
	"net/http"
	"os"
	"strconv"

	"github.com/gin-gonic/gin"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
	"github.com/oreo-io/oreo.io-v2/go-service/models"
)

// AdminMiddleware checks a static admin password provided via header X-Admin-Password.
// Password is configured via env ADMIN_PASSWORD (default: admin123). No JWT required.
func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		want := os.Getenv("ADMIN_PASSWORD")
		if want == "" {
			want = "admin123"
		}
		got := c.GetHeader("X-Admin-Password")
		if got == "" {
			// also allow query param for quick tests (not recommended for prod)
			got = c.Query("admin_password")
		}
		if got == "" || got != want {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		c.Next()
	}
}

// AdminUsersList returns all registered users (without passwords)
func AdminUsersList(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	var users []models.User
	if err := gdb.Order("id asc").Find(&users).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	c.JSON(200, users)
}

// AdminUsersCreate creates a new user with email/password/role
func AdminUsersCreate(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	var body struct{ Email, Password, Role string }
	if err := c.ShouldBindJSON(&body); err != nil || body.Email == "" || body.Password == "" {
		c.JSON(400, gin.H{"error": "invalid_payload"})
		return
	}
	if body.Role == "" {
		body.Role = "user"
	}
	hashed, err := hashPassword(body.Password)
	if err != nil {
		c.JSON(500, gin.H{"error": "hash"})
		return
	}
	u := models.User{Email: body.Email, Password: hashed, Role: body.Role}
	if err := gdb.Create(&u).Error; err != nil {
		c.JSON(409, gin.H{"error": "conflict_or_db"})
		return
	}
	c.JSON(201, u)
}

// AdminUsersUpdate updates email/password/role for a user
func AdminUsersUpdate(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	id, _ := strconv.Atoi(c.Param("userId"))
	var u models.User
	if err := gdb.First(&u, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}
	var body struct {
		Email    *string `json:"email"`
		Password *string `json:"password"`
		Role     *string `json:"role"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(400, gin.H{"error": "invalid_payload"})
		return
	}
	if body.Email != nil {
		u.Email = *body.Email
	}
	if body.Role != nil {
		u.Role = *body.Role
	}
	if body.Password != nil && *body.Password != "" {
		if hashed, err := hashPassword(*body.Password); err == nil {
			u.Password = hashed
		} else {
			c.JSON(500, gin.H{"error": "hash"})
			return
		}
	}
	if err := gdb.Save(&u).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	c.JSON(200, u)
}

// AdminUsersDelete deletes a user by id
func AdminUsersDelete(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	id, _ := strconv.Atoi(c.Param("userId"))
	if err := gdb.Delete(&models.User{}, id).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}
