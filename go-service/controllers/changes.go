package controllers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
	"github.com/oreo-io/oreo.io-v2/go-service/models"
)

// ChangesList lists change requests for a project
func ChangesList(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pidStr := c.Param("id")
	if pidStr == "" {
		pidStr = c.Param("projectId")
	}
	pid, _ := strconv.Atoi(pidStr)
	if !HasProjectRole(c, uint(pid), "owner", "contributor", "approver", "viewer") {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	var items []models.ChangeRequest
	if err := gdb.Where("project_id = ?", pid).Order("id desc").Find(&items).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	c.JSON(200, items)
}

// ChangeApprove approves a pending change request and applies it
func ChangeApprove(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pidStr := c.Param("id")
	if pidStr == "" {
		pidStr = c.Param("projectId")
	}
	pid, _ := strconv.Atoi(pidStr)
	if !HasProjectRole(c, uint(pid), "owner", "approver") {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	changeID, _ := strconv.Atoi(c.Param("changeId"))

	var cr models.ChangeRequest
	if err := gdb.Where("project_id = ?", pid).First(&cr, changeID).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}
	if cr.Status != "pending" {
		c.JSON(409, gin.H{"error": "not_pending"})
		return
	}

	// Apply according to type. For append, prefer DB staging -> main append; fallback to durable file update.
	if cr.Type == "append" {
		var ds models.Dataset
		if err := gdb.Where("project_id = ?", pid).First(&ds, cr.DatasetID).Error; err != nil { c.JSON(404, gin.H{"error": "dataset_not_found"}); return }
		// Payload holds { upload_id, filename }
		var payload struct{ UploadID uint `json:"upload_id"`; Filename string `json:"filename"` }
		_ = json.Unmarshal([]byte(cr.Payload), &payload)
		if payload.UploadID == 0 { c.JSON(400, gin.H{"error":"no_upload_ref"}); return }
		var up models.DatasetUpload
		if err := gdb.Where("project_id = ? AND id = ?", pid, payload.UploadID).First(&up).Error; err != nil { c.JSON(404, gin.H{"error":"upload_not_found"}); return }
		// DB path: append staging table rows to main table, then drop staging
		stg := dsStagingTable(ds.ID, cr.ID)
		main := dsMainTable(ds.ID)
		usedDB := false
		if tableExists(gdb, stg) {
			_ = ensureMainTable(gdb, ds.ID)
			if ex := gdb.Exec(fmt.Sprintf("INSERT INTO %s (data) SELECT data FROM %s", main, stg)); ex.Error == nil {
				_ = gdb.Exec(fmt.Sprintf("DROP TABLE %s", stg)).Error
				now := time.Now()
				ds.LastUploadAt = &now
				_ = gdb.Save(&ds).Error
				// Refresh dataset metadata (rows/columns/last update)
				upsertDatasetMeta(gdb, &ds)
				usedDB = true
			}
		}
		if !usedDB {
			// Fallback: Write upload bytes to a durable temp file, then point dataset to it
			base := os.TempDir()
			dir := filepath.Join(base, "oreo_uploads")
			_ = os.MkdirAll(dir, 0o755)
			name := payload.Filename
			if name == "" { name = "approved_append.csv" }
			out := filepath.Join(dir, "ds_"+strconv.Itoa(int(ds.ID))+"_approved_"+strconv.FormatInt(time.Now().UnixNano(), 10)+"_"+filepath.Base(name))
			if err := os.WriteFile(out, up.Content, 0o644); err != nil { c.JSON(500, gin.H{"error":"store"}); return }
			now := time.Now()
			ds.LastUploadPath = out
			ds.LastUploadAt = &now
			if err := gdb.Save(&ds).Error; err != nil { c.JSON(500, gin.H{"error": "db"}); return }
			// Refresh metadata as well (may not reflect row count if not in DB, but update owner/last update)
			upsertDatasetMeta(gdb, &ds)
		}
		cr.Status = "approved"
		cr.Summary = "Applied append at " + time.Now().Format(time.RFC3339)
		if err := gdb.Save(&cr).Error; err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		c.JSON(200, gin.H{"ok": true, "change_request": cr})
		return
	}

	// Unknown type: mark approved without side effects for now
	cr.Status = "approved"
	if err := gdb.Save(&cr).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	c.JSON(200, gin.H{"ok": true, "change_request": cr})
}

// ChangeReject rejects a pending change request
func ChangeReject(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pidStr := c.Param("id")
	if pidStr == "" {
		pidStr = c.Param("projectId")
	}
	pid, _ := strconv.Atoi(pidStr)
	if !HasProjectRole(c, uint(pid), "owner", "approver") {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	changeID, _ := strconv.Atoi(c.Param("changeId"))
	var cr models.ChangeRequest
	if err := gdb.Where("project_id = ?", pid).First(&cr, changeID).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}
	if cr.Status != "pending" {
		c.JSON(409, gin.H{"error": "not_pending"})
		return
	}
	cr.Status = "rejected"
	if err := gdb.Save(&cr).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	c.JSON(200, gin.H{"ok": true, "change_request": cr})
}
