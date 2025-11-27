package handlers

import (
	"net/http"
	"strconv"
	"path/filepath"
	"sort"
	"strings"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/config"
	appErrors "github.com/oreo-io/oreo.io-v2/go-service/internal/errors"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/internal/database"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/models"
)

// AdminMiddleware checks a static admin password provided via header X-Admin-Password.
// Password is configured via env ADMIN_PASSWORD. No JWT required.
func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		cfg := config.Get()
		got := c.GetHeader("X-Admin-Password")
		if got == "" {
			// also allow query param for quick tests (not recommended for prod)
			got = c.Query("admin_password")
		}
		if got == "" || got != cfg.AdminPassword {
			appErrors.Unauthorized("Invalid admin password").Response(c)
			c.Abort()
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

// AdminDeltaList lists folders and Delta tables under DELTA_DATA_ROOT. Query param: path (optional, relative).
// Response: { root: string, path: string, items: [ { name, path, type: "dir"|"file"|"delta_table" } ] }
func AdminDeltaList(c *gin.Context) {
	cfg := config.Get(); root := strings.TrimRight(cfg.DeltaDataRoot, "/\\")
	if root == "" { root = "/data/delta" }
	rel := strings.TrimLeft(strings.TrimSpace(c.Query("path")), "/\\")
	target := root
	if rel != "" { target = filepath.Join(root, rel) }

	// Stat target
	info, err := os.Stat(target)
	if err != nil || !info.IsDir() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_path", "message": "Path not found or not a directory"})
		return
	}
	entries, err := os.ReadDir(target)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "read_dir_failed"})
		return
	}
	type Item struct { Name, Path, Type string }
	items := make([]Item, 0, len(entries))
	for _, e := range entries {
		name := e.Name()
		p := filepath.Join(target, name)
		t := "file"
		if e.IsDir() {
			t = "dir"
			// detect delta table by _delta_log
			if _, err := os.Stat(filepath.Join(p, "_delta_log")); err == nil {
				t = "delta_table"
			}
		}
		// For files, you could also detect parquet as part of delta fragments; keep as file
		items = append(items, Item{Name: name, Path: p, Type: t})
	}
	sort.Slice(items, func(i, j int) bool { return strings.ToLower(items[i].Name) < strings.ToLower(items[j].Name) })
	c.JSON(http.StatusOK, gin.H{"root": root, "path": target, "items": items})
}
