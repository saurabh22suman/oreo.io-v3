package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/config"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/internal/database"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/models"
)

// LiveEditSubmit creates a change request from a live edit session
// POST /api/projects/:id/datasets/:datasetId/live-edit/submit
func LiveEditSubmit(c *gin.Context) {
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
	dsid, _ := strconv.Atoi(c.Param("datasetId"))

	if !HasProjectRole(c, uint(pid), "owner", "contributor") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}

	var ds models.Dataset
	if err := gdb.Where("project_id = ?", pid).First(&ds, dsid).Error; err != nil {
		c.JSON(404, gin.H{"error": "dataset_not_found"})
		return
	}

	var body struct {
		SessionID   string           `json:"session_id"`
		Title       string           `json:"title"`
		ReviewerIDs []uint           `json:"reviewer_ids"`
		Comment     string           `json:"comment"`
		EditedCells []map[string]any `json:"edited_cells"`
		DeletedRows []string         `json:"deleted_rows"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(400, gin.H{"error": "invalid_payload", "details": err.Error()})
		return
	}

	// Generate session ID if not provided
	if body.SessionID == "" {
		body.SessionID = fmt.Sprintf("live_edit_%d_%d_%d", pid, dsid, time.Now().UnixNano())
	}
	if len(body.ReviewerIDs) == 0 {
		c.JSON(400, gin.H{"error": "reviewer_required"})
		return
	}

	// Validate all reviewers are project members
	uniq := map[uint]struct{}{}
	cleaned := make([]uint, 0, len(body.ReviewerIDs))
	for _, rid := range body.ReviewerIDs {
		if rid != 0 {
			if _, ok := uniq[rid]; !ok {
				uniq[rid] = struct{}{}
				cleaned = append(cleaned, rid)
			}
		}
	}
	if len(cleaned) == 0 {
		c.JSON(400, gin.H{"error": "reviewer_required"})
		return
	}

	var count int64
	if err := gdb.Model(&models.ProjectRole{}).Where("project_id = ? AND user_id IN ?", pid, cleaned).Count(&count).Error; err != nil || count != int64(len(cleaned)) {
		c.JSON(400, gin.H{"error": "reviewer_not_member"})
		return
	}

	// Build payload with session info and edits
	payloadObj := map[string]any{
		"session_id":   body.SessionID,
		"edited_cells": body.EditedCells,
		"deleted_rows": body.DeletedRows,
	}
	pb, _ := json.Marshal(payloadObj)
	reviewersJSON, _ := json.Marshal(cleaned)

	// Initialize reviewer states (pending)
	reviewerStates := make([]map[string]any, 0, len(cleaned))
	for _, rid := range cleaned {
		reviewerStates = append(reviewerStates, map[string]any{
			"id":         rid,
			"status":     "pending",
			"decided_at": nil,
		})
	}
	reviewerStatesJSON, _ := json.Marshal(reviewerStates)

	firstReviewer := uint(0)
	if len(cleaned) > 0 {
		firstReviewer = cleaned[0]
	}

	title := strings.TrimSpace(body.Title)
	if title == "" {
		title = "Live Edit Changes"
	}

	cr := models.ChangeRequest{
		ProjectID:      uint(pid),
		DatasetID:      ds.ID,
		Type:           "live_edit",
		Status:         "pending",
		Title:          title,
		Payload:        string(pb),
		ReviewerID:     firstReviewer,
		Reviewers:      string(reviewersJSON),
		ReviewerStates: string(reviewerStatesJSON),
	}

	if uid, exists := c.Get("user_id"); exists {
		switch v := uid.(type) {
		case float64:
			cr.UserID = uint(v)
		case int:
			cr.UserID = uint(v)
		case uint:
			cr.UserID = v
		}
	}

	if err := gdb.Create(&cr).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}

	// Notify reviewers
	_ = AddNotificationsBulk(cleaned, "You were requested to review a live edit change", models.JSONB{
		"type":              "reviewer_assigned",
		"project_id":        uint(pid),
		"dataset_id":        ds.ID,
		"change_request_id": cr.ID,
		"title":             title,
	})

	// Optional: initial comment
	if strings.TrimSpace(body.Comment) != "" {
		cc := models.ChangeComment{
			ProjectID:       uint(pid),
			ChangeRequestID: cr.ID,
			Body:            strings.TrimSpace(body.Comment),
		}
		if uid, exists := c.Get("user_id"); exists {
			switch v := uid.(type) {
			case float64:
				cc.UserID = uint(v)
			case int:
				cc.UserID = uint(v)
			case uint:
				cc.UserID = v
			}
		}
		_ = gdb.Create(&cc).Error
	}

	// Record audit event for CR creation
	crID := cr.ID
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
	_ = RecordAuditEvent(cr.ProjectID, cr.DatasetID, actingUID, models.AuditEventTypeCRCreated,
		"Review Requested: Data Edits",
		fmt.Sprintf("%d data cells were modified and %d rows were removed. Waiting for approval.", len(body.EditedCells), len(body.DeletedRows)),
		&crID,
		models.AuditEventSummary{CellsChanged: len(body.EditedCells), RowsDeleted: len(body.DeletedRows)},
		nil,
	)

	c.JSON(200, gin.H{"ok": true, "change_request": cr})
}

// ApplyLiveEditChanges applies a live edit change request (called when CR is approved)
func ApplyLiveEditChanges(gdb interface{}, cr *models.ChangeRequest, ds *models.Dataset, actingUID uint) error {
	cfg := config.Get()
	pyBase := cfg.PythonServiceURL
	if strings.TrimSpace(pyBase) == "" {
		pyBase = "http://python-service:8000"
	}

	// Parse payload to get session_id and edits
	var payload struct {
		SessionID   string           `json:"session_id"`
		EditedCells []map[string]any `json:"edited_cells"`
		DeletedRows []string         `json:"deleted_rows"`
	}
	if err := json.Unmarshal([]byte(cr.Payload), &payload); err != nil {
		return fmt.Errorf("invalid_payload")
	}

	// Call Python service to apply the live edit changes
	reqBody := map[string]any{
		"session_id":   payload.SessionID,
		"project_id":   cr.ProjectID,
		"dataset_id":   cr.DatasetID,
		"edited_cells": payload.EditedCells,
		"deleted_rows": payload.DeletedRows,
	}
	reqBytes, _ := json.Marshal(reqBody)

	resp, err := http.Post(pyBase+"/live-edit/apply", "application/json", bytes.NewReader(reqBytes))
	if err != nil {
		return fmt.Errorf("python_unreachable: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("apply_failed: %s", string(bodyBytes))
	}

	// Update dataset timestamp
	now := time.Now()
	ds.LastUploadAt = &now

	return nil
}
