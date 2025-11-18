package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/internal/database"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/config"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/models"
	"gorm.io/gorm"
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
	if !HasProjectRole(c, uint(pid), "owner", "contributor", "viewer") {
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
	// Basic access: must at least be a project member (viewer or above)
	if !HasProjectRole(c, uint(pid), "owner", "contributor", "viewer") {
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
	// Permission: allow if the acting user is an assigned reviewer OR has project role 'approver'
	var uid uint
	if uidVal, ok := c.Get("user_id"); ok {
		switch v := uidVal.(type) {
		case float64:
			uid = uint(v)
		case int:
			uid = uint(v)
		case uint:
			uid = v
		}
	}
	isAssigned := false
	if uid != 0 {
		if cr.ReviewerID != 0 && uid == cr.ReviewerID {
			isAssigned = true
		}
		if !isAssigned && strings.TrimSpace(cr.Reviewers) != "" {
			var ids []uint
			_ = json.Unmarshal([]byte(cr.Reviewers), &ids)
			for _, id := range ids {
				if id == uid {
					isAssigned = true
					break
				}
			}
		}
	}
	if !isAssigned {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	// Mark reviewer state for acting user, then check if all reviewers have approved
	var actingUID uint
	if uv, ok := c.Get("user_id"); ok {
		switch v := uv.(type) {
		case float64:
			actingUID = uint(v)
		case int:
			actingUID = uint(v)
		case uint:
			actingUID = v
		}
	}
	var allApproved = true
	if strings.TrimSpace(cr.ReviewerStates) != "" && actingUID != 0 {
		var states []map[string]any
		_ = json.Unmarshal([]byte(cr.ReviewerStates), &states)
		changed := false
		for _, st := range states {
			if st["id"] == actingUID || (st["id"] != nil && (fmt.Sprintf("%v", st["id"]) == fmt.Sprintf("%v", actingUID))) {
				st["status"] = "approved"
				st["decided_at"] = time.Now().Format(time.RFC3339)
				changed = true
			}
		}
		// Check if all reviewers have status 'approved'
		for _, st := range states {
			if st["status"] != "approved" {
				allApproved = false
				break
			}
		}
		if changed {
			if b, err := json.Marshal(states); err == nil {
				cr.ReviewerStates = string(b)
				_ = gdb.Save(&cr).Error
			}
		}
	}
	// If not all reviewers have approved, do not proceed to final approval
	if strings.TrimSpace(cr.ReviewerStates) != "" && !allApproved {
		c.JSON(200, gin.H{"ok": true, "change_request": cr, "message": "Waiting for all reviewers to approve."})
		return
	}

	// Apply according to type. For append, prefer backend-specific path.
	if cr.Type == "append" {
		var ds models.Dataset
		if err := gdb.Where("project_id = ?", pid).First(&ds, cr.DatasetID).Error; err != nil {
			c.JSON(404, gin.H{"error": "dataset_not_found"})
			return
		}
		// Payload holds { upload_id, filename }
		var payload struct {
			UploadID uint   `json:"upload_id"`
			Filename string `json:"filename"`
		}
		_ = json.Unmarshal([]byte(cr.Payload), &payload)
		if payload.UploadID == 0 {
			c.JSON(400, gin.H{"error": "no_upload_ref"})
			return
		}
		var up models.DatasetUpload
		if err := gdb.Where("project_id = ? AND id = ?", pid, payload.UploadID).First(&up).Error; err != nil {
			c.JSON(404, gin.H{"error": "upload_not_found"})
			return
		}
		// Delta backend: stream upload directly to python /delta/append-file
		if strings.EqualFold(ds.StorageBackend, "delta") {
			cfg := config.Get(); pyBase := cfg.PythonServiceURL
			if strings.TrimSpace(pyBase) == "" { pyBase = "http://python-service:8000" }
			var mpBuf bytes.Buffer
			mw := multipart.NewWriter(&mpBuf)
			_ = mw.WriteField("table", fmt.Sprintf("%d", ds.ID))
			fw, _ := mw.CreateFormFile("file", payload.Filename)
			_, _ = fw.Write(up.Content)
			_ = mw.Close()
			req, _ := http.NewRequest(http.MethodPost, pyBase+"/delta/append-file", &mpBuf)
			req.Header.Set("Content-Type", mw.FormDataContentType())
			resp, err := http.DefaultClient.Do(req)
			if err != nil || resp == nil {
				c.JSON(502, gin.H{"error": "python_unreachable"})
				return
			}
			defer resp.Body.Close()
			if resp.StatusCode < 200 || resp.StatusCode >= 300 {
				c.JSON(500, gin.H{"error": "append_failed"})
				return
			}
			// Update timestamps and meta
		now := time.Now()
		ds.LastUploadAt = &now
		_ = gdb.Save(&ds).Error
		upsertDatasetMeta(gdb, &ds)
		// Record version snapshot (delta path reference)
		cfg = config.Get()
		root := strings.TrimRight(cfg.DeltaDataRoot, "/\\")
		if root == "" { root = "/data/delta" }
		main := fmt.Sprintf("%s/%d", root, ds.ID)
			var rowCount int64 = 0
			verData := map[string]any{
				"table":      main,
				"row_count":  rowCount,
				"change_id":  cr.ID,
				"applied_at": time.Now().Format(time.RFC3339),
			}
			if b, err := json.Marshal(verData); err == nil {
				approvers := cr.ReviewerStates
				if strings.TrimSpace(approvers) == "" { approvers = cr.Reviewers }
				_ = gdb.Create(&models.DatasetVersion{ DatasetID: ds.ID, Data: string(b), EditedBy: cr.UserID, EditedAt: time.Now(), Status: "approved", Approvers: approvers }).Error
			}
			cr.Status = "completed"
			cr.Summary = "Applied append at " + time.Now().Format(time.RFC3339)
			if err := gdb.Save(&cr).Error; err != nil {
				c.JSON(500, gin.H{"error": "db"})
				return
			}
			// Notify requester
			if cr.UserID != 0 { _ = AddNotification(cr.UserID, "Your append request has been applied successfully", models.JSONB{"type": "append_completed", "project_id": uint(pid), "dataset_id": cr.DatasetID, "change_request_id": cr.ID}) }
			c.JSON(200, gin.H{"ok": true, "change_request": cr})
			return
		}

		// DB path: append staging table rows to main PHYSICAL table, then drop staging (transactional)
		stg := dsStagingTable(ds.ID, cr.ID)
		main := datasetPhysicalTable(&ds)
		altMain := dsMainTable(ds.ID)
		// Diagnostics
		fmt.Printf("[ChangeApprove] append start ds=%d cr=%d stg=%s main=%s altMain=%s\n", ds.ID, cr.ID, stg, main, altMain)
		usedDB := false
		if tableExists(gdb, stg) {
			// Non-transactional merge to avoid driver/visibility issues observed in dev
			// ensure physical table exists
			if err := ensureDatasetTable(gdb, &ds); err != nil {
				fmt.Printf("[ChangeApprove] ensureDatasetTable failed: %v\n", err)
			} else {
				// Count rows to be appended (for auditing)
				var toAppend int64
				_ = gdb.Raw(fmt.Sprintf("SELECT COUNT(*) FROM %s", stg)).Row().Scan(&toAppend)
				fmt.Printf("[ChangeApprove] stg rows to append = %d\n", toAppend)
				// append into physical table; on failure, fallback to internal ds_<id> table
				var ex *gorm.DB
				if strings.EqualFold(gdb.Dialector.Name(), "postgres") {
					ex = gdb.Exec(fmt.Sprintf("INSERT INTO %s (data) SELECT data::jsonb FROM %s", main, stg))
				} else {
					ex = gdb.Exec(fmt.Sprintf("INSERT INTO %s (data) SELECT data FROM %s", main, stg))
				}
				if ex.Error != nil {
					fmt.Printf("[ChangeApprove] insert into main failed: %v\n", ex.Error)
					// Ensure alt table exists and retry
					if err := ensureMainTable(gdb, ds.ID); err == nil {
						if strings.EqualFold(gdb.Dialector.Name(), "postgres") {
							ex = gdb.Exec(fmt.Sprintf("INSERT INTO %s (data) SELECT data::jsonb FROM %s", altMain, stg))
						} else {
							ex = gdb.Exec(fmt.Sprintf("INSERT INTO %s (data) SELECT data FROM %s", altMain, stg))
						}
					}
					if ex.Error == nil {
						main = altMain
					}
				}
				if ex != nil && ex.Error == nil {
					fmt.Printf("[ChangeApprove] rows appended = %d into %s\n", ex.RowsAffected, main)
					// drop staging (best-effort)
					_ = gdb.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", stg)).Error
					// timestamps and metadata
					now := time.Now()
					ds.LastUploadAt = &now
					_ = gdb.Save(&ds).Error
					upsertDatasetMeta(gdb, &ds)
					// Post-merge count (best-effort)
					var after int64
					_ = gdb.Raw(fmt.Sprintf("SELECT COUNT(*) FROM %s", main)).Row().Scan(&after)
					fmt.Printf("[ChangeApprove] post-merge row_count in %s = %d\n", main, after)
					// audit
					_ = gdb.AutoMigrate(&models.AuditLog{})
					_ = gdb.Create(&models.AuditLog{
						ActorID:    actingUID,
						ProjectID:  ds.ProjectID,
						EntityType: "dataset",
						EntityID:   fmt.Sprintf("%d", ds.ID),
						Action:     "append_approved",
						NewValue:   models.JSONB{"change_request_id": cr.ID, "dataset_id": ds.ID, "rows_appended": ex.RowsAffected},
						CreatedAt:  time.Now(),
					}).Error
					usedDB = true
				}
			}
		}
		if !usedDB {
			// Fallback: Directly ingest upload content into the dataset's physical table
			mainTbl := datasetPhysicalTable(&ds)
			if err := gdb.Transaction(func(tx *gorm.DB) error {
				if err := ensureDatasetTable(tx, &ds); err != nil {
					return err
				}
				if err := ingestBytesToTable(tx, up.Content, payload.Filename, mainTbl); err != nil {
					return err
				}
				// Drop staging if it exists (best-effort)
				_ = tx.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", dsStagingTable(ds.ID, cr.ID))).Error
				now := time.Now()
				ds.LastUploadAt = &now
				if err := tx.Save(&ds).Error; err != nil {
					return err
				}
				upsertDatasetMeta(tx, &ds)
				var after int64
				_ = tx.Raw(fmt.Sprintf("SELECT COUNT(*) FROM %s", mainTbl)).Row().Scan(&after)
				fmt.Printf("[ChangeApprove] fallback ingest into %s complete, row_count = %d\n", mainTbl, after)
				return nil
			}); err != nil {
				c.JSON(500, gin.H{"error": "append_ingest_failed"})
				return
			}
			usedDB = true
		}

		// Record a dataset version snapshot (table reference and row count) on approved change
		// Compute row count from main table if available
	var rowCount int64
	_ = gdb.Raw(fmt.Sprintf("SELECT COUNT(*) FROM %s", main)).Row().Scan(&rowCount)
	fmt.Printf("[ChangeApprove] version snapshot: table=%s row_count=%d\n", main, rowCount)
		verData := map[string]any{
			"table":      main,
			"row_count":  rowCount,
			"change_id":  cr.ID,
			"applied_at": time.Now().Format(time.RFC3339),
		}
		if b, err := json.Marshal(verData); err == nil {
			approvers := cr.ReviewerStates
			if strings.TrimSpace(approvers) == "" {
				approvers = cr.Reviewers
			}
			_ = gdb.Create(&models.DatasetVersion{
				DatasetID: ds.ID,
				Data:      string(b),
				EditedBy:  cr.UserID,
				EditedAt:  time.Now(),
				Status:    "approved",
				Approvers: approvers,
			}).Error
		}
		// Mark change status
	if usedDB {
			cr.Status = "completed"
		} else {
			cr.Status = "approved"
		}
		cr.Summary = "Applied append at " + time.Now().Format(time.RFC3339)
		if err := gdb.Save(&cr).Error; err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		// Notify requester that their append request was applied
		if cr.UserID != 0 {
			msg := "Your append request has been applied successfully"
			if !usedDB {
				msg = "Your append request was approved; data was stored for later processing"
			}
			_ = AddNotification(cr.UserID, msg, models.JSONB{"type": "append_completed", "project_id": uint(pid), "dataset_id": cr.DatasetID, "change_request_id": cr.ID})
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
	// Basic access: must at least be a project member (viewer or above)
	if !HasProjectRole(c, uint(pid), "owner", "contributor", "viewer") {
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
	// Permission: allow if the acting user is an assigned reviewer OR has project role 'approver'
	var uid uint
	if uidVal, ok := c.Get("user_id"); ok {
		switch v := uidVal.(type) {
		case float64:
			uid = uint(v)
		case int:
			uid = uint(v)
		case uint:
			uid = v
		}
	}
	isAssigned := false
	if uid != 0 {
		if cr.ReviewerID != 0 && uid == cr.ReviewerID {
			isAssigned = true
		}
		if !isAssigned && strings.TrimSpace(cr.Reviewers) != "" {
			var ids []uint
			_ = json.Unmarshal([]byte(cr.Reviewers), &ids)
			for _, id := range ids {
				if id == uid {
					isAssigned = true
					break
				}
			}
		}
	}
	if !isAssigned {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	// Mark reviewer state if present
	var actingUID uint
	if uv, ok := c.Get("user_id"); ok {
		switch v := uv.(type) {
		case float64:
			actingUID = uint(v)
		case int:
			actingUID = uint(v)
		case uint:
			actingUID = v
		}
	}
	if strings.TrimSpace(cr.ReviewerStates) != "" && actingUID != 0 {
		var states []map[string]any
		_ = json.Unmarshal([]byte(cr.ReviewerStates), &states)
		changed := false
		for _, st := range states {
			if idv, ok := st["id"].(float64); ok && uint(idv) == actingUID {
				st["status"] = "rejected"
				st["decided_at"] = time.Now().Format(time.RFC3339)
				changed = true
				break
			}
			if idu, ok := st["id"].(uint); ok && idu == actingUID {
				st["status"] = "rejected"
				st["decided_at"] = time.Now().Format(time.RFC3339)
				changed = true
				break
			}
		}
		if changed {
			if b, err := json.Marshal(states); err == nil {
				cr.ReviewerStates = string(b)
				_ = gdb.Save(&cr).Error
			}
		}
	}
	cr.Status = "rejected"
	if err := gdb.Save(&cr).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	c.JSON(200, gin.H{"ok": true, "change_request": cr})
}

// ChangeWithdraw lets the creator withdraw their pending request
func ChangeWithdraw(c *gin.Context) {
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
	if !HasProjectRole(c, uint(pid), "owner", "contributor", "viewer") {
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
	// Only the creator can withdraw
	var uid uint
	if uv, ok := c.Get("user_id"); ok {
		switch v := uv.(type) {
		case float64:
			uid = uint(v)
		case int:
			uid = uint(v)
		case uint:
			uid = v
		}
	}
	if uid == 0 || uid != cr.UserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "not_owner_of_change"})
		return
	}
	cr.Status = "withdrawn"
	cr.Summary = "Withdrawn by requester at " + time.Now().Format(time.RFC3339)
	if err := gdb.Save(&cr).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	c.JSON(200, gin.H{"ok": true, "change_request": cr})
}

// DatasetApprovalsListTop lists change requests for a given dataset ID (top-level datasets route)
// GET /api/datasets/:id/approvals?status=pending|approved|rejected|withdrawn|all
func DatasetApprovalsListTop(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	// Resolve dataset and enforce RBAC by its project
	dsID, _ := strconv.Atoi(c.Param("id"))
	var ds models.Dataset
	if err := gdb.First(&ds, dsID).Error; err != nil {
		c.JSON(404, gin.H{"error": "dataset_not_found"})
		return
	}
	if !HasProjectRole(c, ds.ProjectID, "owner", "contributor", "viewer") {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	status := strings.ToLower(strings.TrimSpace(c.Query("status")))
	if status == "" { // default to pending when not specified
		status = "pending"
	}
	var items []models.ChangeRequest
	q := gdb.Where("project_id = ? AND dataset_id = ?", ds.ProjectID, ds.ID)
	if status != "all" {
		q = q.Where("LOWER(status) = ?", status)
	}
	if err := q.Order("id desc").Find(&items).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	c.JSON(200, items)
}
