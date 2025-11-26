package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/config"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/internal/database"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/models"
)

// RegisterSnapshotRoutes registers snapshot-related endpoints
func RegisterSnapshotRoutes(r *gin.Engine) {
	api := r.Group("/api")

	// Dataset-level snapshot endpoints
	dsSnapshot := api.Group("/datasets", AuthMiddleware())
	{
		dsSnapshot.GET("/:id/snapshots/calendar", SnapshotCalendar)
		dsSnapshot.GET("/:id/snapshots/:version/data", SnapshotData)
		dsSnapshot.POST("/:id/snapshots/:version/restore", SnapshotRestore)
	}
}

// SnapshotEntry represents a single snapshot in the calendar
type SnapshotEntry struct {
	Version          int                    `json:"version"`
	Timestamp        time.Time              `json:"timestamp"`
	Title            string                 `json:"title"`
	Type             string                 `json:"type"`
	CreatedBy        string                 `json:"created_by"`
	ActorEmail       string                 `json:"actor_email,omitempty"`
	Operation        string                 `json:"operation,omitempty"`
	OperationMetrics map[string]interface{} `json:"operation_metrics,omitempty"`
	Summary          SnapshotSummary        `json:"summary"`
}

// SnapshotSummary contains metrics for a snapshot
type SnapshotSummary struct {
	RowsAdded    int `json:"rows_added"`
	RowsUpdated  int `json:"rows_updated"`
	RowsDeleted  int `json:"rows_deleted"`
	CellsChanged int `json:"cells_changed"`
}

// SnapshotCalendar returns snapshots grouped by date for calendar display
// GET /api/datasets/:id/snapshots/calendar
func SnapshotCalendar(c *gin.Context) {
	datasetID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dataset id"})
		return
	}

	gdb := dbpkg.Get()
	if gdb == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	// Get dataset to find project_id for Delta history call
	var dataset models.Dataset
	if err := gdb.First(&dataset, datasetID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "dataset not found"})
		return
	}

	// Fetch Delta history from Python service
	versions := fetchDeltaHistoryForSnapshots(dataset.ProjectID, uint(datasetID))

	// Group by date
	calendar := make(map[string][]SnapshotEntry)
	for _, v := range versions {
		dateKey := v.Timestamp.Format("2006-01-02")
		calendar[dateKey] = append(calendar[dateKey], v)
	}

	// Sort versions within each date (most recent first)
	for dateKey := range calendar {
		sort.Slice(calendar[dateKey], func(i, j int) bool {
			return calendar[dateKey][i].Timestamp.After(calendar[dateKey][j].Timestamp)
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"calendar": calendar,
		"versions": versions,
	})
}

// fetchDeltaHistoryForSnapshots calls Python service to get Delta table history
func fetchDeltaHistoryForSnapshots(projectID, datasetID uint) []SnapshotEntry {
	var entries []SnapshotEntry

	cfg := config.Get()
	pyBase := cfg.PythonServiceURL
	if pyBase == "" {
		pyBase = "http://python-service:8000"
	}

	// Call /delta/history/{project_id}/{dataset_id}
	url := fmt.Sprintf("%s/delta/history/%d/%d", pyBase, projectID, datasetID)
	resp, err := http.Get(url)
	if err != nil {
		return entries
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return entries
	}

	body, _ := io.ReadAll(resp.Body)
	var historyResp struct {
		History []map[string]interface{} `json:"history"`
	}
	if err := json.Unmarshal(body, &historyResp); err != nil {
		return entries
	}

	// Convert Delta history entries to snapshot entries
	for _, entry := range historyResp.History {
		version := int64(0)
		if v, ok := entry["version"].(float64); ok {
			version = int64(v)
		}

		timestamp := time.Now()
		if ts, ok := entry["timestamp"].(string); ok {
			if parsed, err := time.Parse(time.RFC3339, ts); err == nil {
				timestamp = parsed
			}
		}
		// Also try milliseconds format from Delta
		if tsMs, ok := entry["timestamp"].(float64); ok {
			timestamp = time.UnixMilli(int64(tsMs))
		}

		operation := "WRITE"
		if op, ok := entry["operation"].(string); ok {
			operation = op
		}

		// Build human-readable title
		title := humanizeSnapshotOperation(operation, version)

		// Extract metrics
		var rowsAdded, rowsUpdated, rowsDeleted int
		var opMetrics map[string]interface{}
		if metrics, ok := entry["operationMetrics"].(map[string]interface{}); ok {
			opMetrics = metrics
			if v, ok := metrics["numOutputRows"].(float64); ok {
				rowsAdded = int(v)
			}
			if v, ok := metrics["numTargetRowsInserted"].(float64); ok {
				rowsAdded = int(v)
			}
			if v, ok := metrics["numTargetRowsUpdated"].(float64); ok {
				rowsUpdated = int(v)
			}
			if v, ok := metrics["numTargetRowsDeleted"].(float64); ok {
				rowsDeleted = int(v)
			}
		}

		entries = append(entries, SnapshotEntry{
			Version:          int(version),
			Timestamp:        timestamp,
			Title:            title,
			Type:             mapOperationToSnapshotType(operation),
			CreatedBy:        "system",
			Operation:        operation,
			OperationMetrics: opMetrics,
			Summary: SnapshotSummary{
				RowsAdded:   rowsAdded,
				RowsUpdated: rowsUpdated,
				RowsDeleted: rowsDeleted,
			},
		})
	}

	// Sort by version descending
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Version > entries[j].Version
	})

	return entries
}

// humanizeSnapshotOperation converts Delta operation to human-readable snapshot title
func humanizeSnapshotOperation(op string, version int64) string {
	switch strings.ToUpper(op) {
	case "CREATE TABLE":
		return "Dataset Created"
	case "WRITE":
		if version == 0 {
			return "Initial Data"
		}
		return "Data written"
	case "MERGE":
		return "Data merged"
	case "DELETE":
		return "Data deleted"
	case "UPDATE":
		return "Data updated"
	case "RESTORE":
		return "Restored from snapshot"
	case "OPTIMIZE":
		return "Table optimized"
	case "VACUUM":
		return "Cleanup performed"
	default:
		return op
	}
}

// mapOperationToSnapshotType maps Delta operation to snapshot type
func mapOperationToSnapshotType(op string) string {
	switch strings.ToUpper(op) {
	case "CREATE TABLE":
		return "create"
	case "WRITE":
		return "append"
	case "MERGE":
		return "merge"
	case "DELETE":
		return "delete"
	case "UPDATE":
		return "edit"
	case "RESTORE":
		return "restore"
	default:
		return strings.ToLower(op)
	}
}

// SnapshotData returns data at a specific version (time travel)
// GET /api/datasets/:id/snapshots/:version/data
func SnapshotData(c *gin.Context) {
	datasetID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dataset id"})
		return
	}

	version, err := strconv.ParseInt(c.Param("version"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid version"})
		return
	}

	limit := 50
	offset := 0
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 500 {
			limit = parsed
		}
	}
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	gdb := dbpkg.Get()
	if gdb == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	// Get dataset to find project_id
	var dataset models.Dataset
	if err := gdb.First(&dataset, datasetID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "dataset not found"})
		return
	}

	// Call Python service for time-travel query
	result, err := querySnapshotData(dataset.ProjectID, uint(datasetID), int(version), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// querySnapshotData calls Python service to execute time-travel query
func querySnapshotData(projectID, datasetID uint, version, limit, offset int) (map[string]interface{}, error) {
	cfg := config.Get()
	pyBase := cfg.PythonServiceURL
	if pyBase == "" {
		pyBase = "http://python-service:8000"
	}

	// Call new time-travel endpoint
	url := fmt.Sprintf("%s/delta/snapshot/%d/%d/%d?limit=%d&offset=%d",
		pyBase, projectID, datasetID, version, limit, offset)

	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to reach python service: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("python service error: %s", string(body))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %v", err)
	}

	return result, nil
}

// SnapshotRestore restores dataset to a specific version
// POST /api/datasets/:id/snapshots/:version/restore
func SnapshotRestore(c *gin.Context) {
	datasetID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dataset id"})
		return
	}

	version, err := strconv.ParseInt(c.Param("version"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid version"})
		return
	}

	gdb := dbpkg.Get()
	if gdb == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	// Get dataset
	var dataset models.Dataset
	if err := gdb.First(&dataset, datasetID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "dataset not found"})
		return
	}

	// Check permission - must be owner or contributor
	if !HasProjectRole(c, dataset.ProjectID, "owner", "contributor") {
		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions to restore"})
		return
	}

	// Get acting user - handle both uint and float64 from JWT
	var actorID uint
	if uid, ok := c.Get("user_id"); ok {
		switch v := uid.(type) {
		case uint:
			actorID = v
		case float64:
			actorID = uint(v)
		case int:
			actorID = uint(v)
		case int64:
			actorID = uint(v)
		}
	}

	// Call Python service to restore
	result, err := executeRestore(dataset.ProjectID, uint(datasetID), int(version))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Record audit event
	_ = RecordAuditEvent(
		dataset.ProjectID,
		uint(datasetID),
		actorID,
		models.AuditEventTypeRestore,
		fmt.Sprintf("Restored to Snapshot #%d", version),
		"Dataset was restored to a previous snapshot",
		nil,
		models.AuditEventSummary{},
		nil,
	)

	c.JSON(http.StatusOK, result)
}

// executeRestore calls Python service to perform the restore
func executeRestore(projectID, datasetID uint, version int) (map[string]interface{}, error) {
	cfg := config.Get()
	pyBase := cfg.PythonServiceURL
	if pyBase == "" {
		pyBase = "http://python-service:8000"
	}

	// Build request body
	payload := map[string]interface{}{
		"project_id": projectID,
		"dataset_id": datasetID,
		"version":    version,
	}
	payloadBytes, _ := json.Marshal(payload)

	resp, err := http.Post(
		fmt.Sprintf("%s/delta/restore", pyBase),
		"application/json",
		strings.NewReader(string(payloadBytes)),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to reach python service: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("restore failed: %s", string(body))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %v", err)
	}

	// Add our standard response fields
	result["ok"] = true

	return result, nil
}
