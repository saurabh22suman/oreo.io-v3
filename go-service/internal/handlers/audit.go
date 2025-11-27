package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/config"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/internal/database"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/models"
)

// RegisterAuditRoutes registers audit-related endpoints
func RegisterAuditRoutes(r *gin.Engine) {
	api := r.Group("/api")

	// Dataset-level audit events (under /api/datasets/:id/audit)
	dsAudit := api.Group("/datasets", AuthMiddleware())
	{
		dsAudit.GET("/:id/audit", DatasetAuditList)
	}

	// Individual audit event endpoints (under /api/audit/:auditId)
	audit := api.Group("/audit", AuthMiddleware())
	{
		audit.GET("/:auditId", AuditEventGet)
		audit.GET("/:auditId/diff", AuditEventDiff)
		audit.GET("/:auditId/validation", AuditEventValidation)
	}
}

// DatasetAuditList returns a timeline of audit events for a dataset
// Merges events from AuditEvent table (CR events) with Delta history (version events)
// GET /api/datasets/:id/audit
// Query params: ?limit=50&offset=0&type=merge,append
func DatasetAuditList(c *gin.Context) {
	datasetID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dataset id"})
		return
	}

	// Parse query params
	limit := 50
	offset := 0
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}
	eventTypes := c.Query("type")

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

	// Collect all events into a unified timeline
	var allEvents []models.AuditEventListResponse

	// 1. Fetch audit events from DB (CR events)
	var dbEvents []models.AuditEvent
	query := gdb.Model(&models.AuditEvent{}).Where("dataset_id = ?", datasetID)
	if eventTypes != "" {
		types := strings.Split(eventTypes, ",")
		query = query.Where("event_type IN ?", types)
	}
	query.Order("created_at DESC").Find(&dbEvents)

	for _, evt := range dbEvents {
		allEvents = append(allEvents, models.AuditEventListResponse{
			AuditID:     fmt.Sprintf("evt_%d", evt.ID),
			SnapshotID:  evt.SnapshotID,
			Type:        evt.EventType,
			Title:       evt.Title,
			Description: evt.Description,
			CreatedBy:   fmt.Sprintf("user_%d", evt.ActorID),
			ActorEmail:  evt.ActorEmail,
			Timestamp:   evt.CreatedAt,
			Summary: models.AuditEventSummary{
				RowsAdded:    evt.RowsAdded,
				RowsUpdated:  evt.RowsUpdated,
				RowsDeleted:  evt.RowsDeleted,
				CellsChanged: evt.CellsChanged,
				Warnings:     evt.Warnings,
				Errors:       evt.Errors,
			},
			Metadata: evt.Metadata,
		})
	}

	// 2. Fetch Delta history from Python service (if Delta backend)
	if strings.EqualFold(dataset.StorageBackend, "delta") {
		deltaEvents := fetchDeltaHistory(dataset.ProjectID, uint(datasetID))
		allEvents = append(allEvents, deltaEvents...)
	}

	// 3. Sort all events by timestamp descending (most recent first)
	sortEventsByTimestamp(allEvents)

	// 4. Apply pagination
	total := len(allEvents)
	start := offset
	end := offset + limit
	if start > total {
		start = total
	}
	if end > total {
		end = total
	}
	paginatedEvents := allEvents[start:end]

	c.JSON(http.StatusOK, gin.H{
		"events": paginatedEvents,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// fetchDeltaHistory calls Python service to get Delta table history
// Only returns events that aren't already tracked by our audit system
func fetchDeltaHistory(projectID, datasetID uint) []models.AuditEventListResponse {
	var events []models.AuditEventListResponse

	cfg := config.Get()
	pyBase := cfg.PythonServiceURL
	if pyBase == "" {
		pyBase = "http://python-service:8000"
	}

	// Call /delta/history/{project_id}/{dataset_id}
	url := fmt.Sprintf("%s/delta/history/%d/%d", pyBase, projectID, datasetID)
	resp, err := http.Get(url)
	if err != nil {
		// Delta history not available, return empty
		return events
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return events
	}

	body, _ := io.ReadAll(resp.Body)
	var historyResp struct {
		History []map[string]interface{} `json:"history"`
	}
	if err := json.Unmarshal(body, &historyResp); err != nil {
		return events
	}

	// Convert Delta history entries to audit events
	// Skip WRITE and RESTORE operations as they are tracked via CR Merged and Restore audit events
	for _, entry := range historyResp.History {
		version := int64(0)
		if v, ok := entry["version"].(float64); ok {
			version = int64(v)
		}

		operation := "unknown"
		if op, ok := entry["operation"].(string); ok {
			operation = op
		}

		// Skip operations that are already tracked by our audit system:
		// - WRITE: tracked by "CR Merged" or "Append" events
		// - RESTORE: tracked by "Restore" audit event
		// Only show CREATE TABLE (dataset creation) from Delta history
		upperOp := strings.ToUpper(operation)
		if upperOp == "WRITE" || upperOp == "RESTORE" {
			continue
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

		// Build human-readable title based on operation
		// For CREATE TABLE (version 0), just show the operation without version prefix
		var title string
		if strings.EqualFold(operation, "CREATE TABLE") {
			title = "Dataset Created"
		} else {
			title = humanizeOperation(operation)
		}

		// Extract metrics if available
		var rowsAdded, rowsUpdated, rowsDeleted int
		if metrics, ok := entry["operationMetrics"].(map[string]interface{}); ok {
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

		events = append(events, models.AuditEventListResponse{
			AuditID:    fmt.Sprintf("delta_v%d", version),
			SnapshotID: fmt.Sprintf("v%d", version),
			Type:       mapDeltaOperationToEventType(operation),
			Title:      title,
			CreatedBy:  "system",
			Timestamp:  timestamp,
			Summary: models.AuditEventSummary{
				RowsAdded:   rowsAdded,
				RowsUpdated: rowsUpdated,
				RowsDeleted: rowsDeleted,
			},
			Metadata: models.JSONB(entry),
		})
	}

	return events
}

// humanizeOperation converts Delta operation to human-readable text
func humanizeOperation(op string) string {
	switch strings.ToUpper(op) {
	case "WRITE":
		return "Data written"
	case "CREATE TABLE":
		return "Table created"
	case "MERGE":
		return "Data merged"
	case "DELETE":
		return "Data deleted"
	case "UPDATE":
		return "Data updated"
	case "RESTORE":
		return "Restored to previous version"
	case "OPTIMIZE":
		return "Table optimized"
	case "VACUUM":
		return "Old files cleaned up"
	default:
		return op
	}
}

// mapDeltaOperationToEventType maps Delta operation to audit event type
func mapDeltaOperationToEventType(op string) string {
	switch strings.ToUpper(op) {
	case "WRITE":
		return models.AuditEventTypeAppend
	case "CREATE TABLE":
		return "dataset_created"
	case "MERGE":
		return models.AuditEventTypeCRMerged
	case "DELETE":
		return "delete"
	case "UPDATE":
		return models.AuditEventTypeEdit
	case "RESTORE":
		return models.AuditEventTypeRestore
	default:
		return "delta_" + strings.ToLower(op)
	}
}

// sortEventsByTimestamp sorts events by timestamp descending (most recent first)
func sortEventsByTimestamp(events []models.AuditEventListResponse) {
	for i := 0; i < len(events)-1; i++ {
		for j := i + 1; j < len(events); j++ {
			if events[j].Timestamp.After(events[i].Timestamp) {
				events[i], events[j] = events[j], events[i]
			}
		}
	}
}

// handleDeltaEventDetail handles detail requests for Delta-sourced events (delta_v* format)
func handleDeltaEventDetail(c *gin.Context, auditIDStr string) {
	// Parse version from delta_v0, delta_v1, etc.
	versionStr := strings.TrimPrefix(auditIDStr, "delta_v")
	version, err := strconv.ParseInt(versionStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid delta version format"})
		return
	}

	// For Delta events, we return a synthetic response based on the version info
	// The actual Delta log data was already fetched and included in metadata during list
	response := models.AuditEventDetailResponse{
		AuditID:     auditIDStr,
		SnapshotID:  fmt.Sprintf("v%d", version),
		Type:        "delta_operation",
		Title:       fmt.Sprintf("Delta Version %d", version),
		Description: "This event was recorded in the Delta Lake transaction log.",
		CreatedBy:   "system",
		Timestamp:   time.Now(), // Will be overwritten if we fetch from Delta
		Summary:     models.AuditEventSummary{},
	}

	// For version 0, it's typically a table creation
	if version == 0 {
		response.Title = "Dataset Created"
		response.Type = "dataset_created"
		response.Description = "The dataset table was created in Delta Lake."
	}

	c.JSON(http.StatusOK, response)
}

// AuditEventGet returns details for a specific audit event
// GET /api/audit/:auditId
func AuditEventGet(c *gin.Context) {
	auditIDStr := c.Param("auditId")

	// Handle delta_v* format for Delta events (e.g., delta_v0, delta_v1)
	if strings.HasPrefix(auditIDStr, "delta_v") {
		handleDeltaEventDetail(c, auditIDStr)
		return
	}

	// Parse audit ID (format: evt_123 or just 123)
	auditID, err := parseAuditID(auditIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid audit id format"})
		return
	}

	gdb := dbpkg.Get()
	if gdb == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	var event models.AuditEvent
	if err := gdb.First(&event, auditID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "audit event not found"})
		return
	}

	// Build response
	response := models.AuditEventDetailResponse{
		AuditID:        fmt.Sprintf("evt_%d", event.ID),
		SnapshotID:     event.SnapshotID,
		Type:           event.EventType,
		Title:          event.Title,
		Description:    event.Description,
		CreatedBy:      fmt.Sprintf("user_%d", event.ActorID),
		ActorEmail:     event.ActorEmail,
		Timestamp:      event.CreatedAt,
		DiffPath:       event.DiffPath,
		ValidationPath: event.ValidationPath,
		MetadataPath:   event.MetadataPath,
		Summary: models.AuditEventSummary{
			RowsAdded:    event.RowsAdded,
			RowsUpdated:  event.RowsUpdated,
			RowsDeleted:  event.RowsDeleted,
			CellsChanged: event.CellsChanged,
			Warnings:     event.Warnings,
			Errors:       event.Errors,
		},
	}

	if event.Metadata != nil {
		response.Metadata = event.Metadata
	}

	// Load diff, validation, and metadata files if paths exist
	deltaRoot := getDeltaRoot()

	if event.DiffPath != "" {
		if diff, err := loadJSONFile(filepath.Join(deltaRoot, event.DiffPath)); err == nil {
			response.Diff = diff
		}
	}

	if event.ValidationPath != "" {
		if validation, err := loadJSONFile(filepath.Join(deltaRoot, event.ValidationPath)); err == nil {
			response.Validation = validation
		}
	}

	if event.MetadataPath != "" {
		if metadata, err := loadJSONFile(filepath.Join(deltaRoot, event.MetadataPath)); err == nil {
			response.Metadata = metadata
		}
	}

	// Load related change request if exists
	if event.ChangeRequestID != nil && *event.ChangeRequestID > 0 {
		var cr models.ChangeRequest
		if err := gdb.First(&cr, *event.ChangeRequestID).Error; err == nil {
			response.RelatedCR = &models.ChangeRequestBrief{
				ID:     cr.ID,
				Title:  cr.Title,
				Type:   cr.Type,
				Status: cr.Status,
			}
		}
	}

	c.JSON(http.StatusOK, response)
}

// AuditEventDiff returns the diff JSON for an audit event
// GET /api/audit/:auditId/diff
func AuditEventDiff(c *gin.Context) {
	auditIDStr := c.Param("auditId")

	auditID, err := parseAuditID(auditIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid audit id format"})
		return
	}

	gdb := dbpkg.Get()
	if gdb == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	var event models.AuditEvent
	if err := gdb.First(&event, auditID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "audit event not found"})
		return
	}

	if event.DiffPath == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "no diff available for this event"})
		return
	}

	deltaRoot := getDeltaRoot()
	diff, err := loadJSONFile(filepath.Join(deltaRoot, event.DiffPath))
	if err != nil {
		// If file doesn't exist, try to generate diff on-the-fly via Python service
		if os.IsNotExist(err) {
			diff, err = generateDiffViaPython(event.DatasetID, event.Version)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "diff file not found and could not be generated"})
				return
			}
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load diff"})
			return
		}
	}

	c.JSON(http.StatusOK, diff)
}

// AuditEventValidation returns the validation JSON for an audit event
// GET /api/audit/:auditId/validation
func AuditEventValidation(c *gin.Context) {
	auditIDStr := c.Param("auditId")

	auditID, err := parseAuditID(auditIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid audit id format"})
		return
	}

	gdb := dbpkg.Get()
	if gdb == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	var event models.AuditEvent
	if err := gdb.First(&event, auditID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "audit event not found"})
		return
	}

	if event.ValidationPath == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "no validation report available for this event"})
		return
	}

	deltaRoot := getDeltaRoot()
	validation, err := loadJSONFile(filepath.Join(deltaRoot, event.ValidationPath))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load validation report"})
		return
	}

	c.JSON(http.StatusOK, validation)
}

// CreateAuditEvent creates a new audit event in the database
func CreateAuditEvent(event *models.AuditEvent) error {
	gdb := dbpkg.Get()
	if gdb == nil {
		return fmt.Errorf("database not available")
	}

	// Ensure table exists
	_ = gdb.AutoMigrate(&models.AuditEvent{})

	return gdb.Create(event).Error
}

// backfillAuditEventsFromChangeRequests creates audit events from existing change requests
func backfillAuditEventsFromChangeRequests(datasetID uint) {
	gdb := dbpkg.Get()
	if gdb == nil {
		return
	}

	// Ensure table exists
	_ = gdb.AutoMigrate(&models.AuditEvent{})

	// Get all change requests for this dataset
	var crs []models.ChangeRequest
	if err := gdb.Where("dataset_id = ?", datasetID).Order("created_at ASC").Find(&crs).Error; err != nil {
		return
	}

	for _, cr := range crs {
		// Create creation event
		crID := cr.ID
		createEvent := &models.AuditEvent{
			ProjectID:       cr.ProjectID,
			DatasetID:       cr.DatasetID,
			EventType:       models.AuditEventTypeCRCreated,
			Title:           fmt.Sprintf("Change Request #%d created: %s", cr.ID, cr.Title),
			Description:     fmt.Sprintf("A new %s change request was created", cr.Type),
			ActorID:         cr.UserID,
			ChangeRequestID: &crID,
			EntityType:      "change_request",
			EntityID:        fmt.Sprintf("%d", cr.ID),
			CreatedAt:       cr.CreatedAt,
		}

		// Get actor email
		var user models.User
		if err := gdb.First(&user, cr.UserID).Error; err == nil {
			createEvent.ActorEmail = user.Email
		}

		// Try to parse summary for metrics
		if cr.Summary != "" {
			var summary map[string]interface{}
			if err := json.Unmarshal([]byte(cr.Summary), &summary); err == nil {
				if rows, ok := summary["row_count"].(float64); ok {
					createEvent.RowsAdded = int(rows)
				}
			}
		}

		gdb.Create(createEvent)

		// Create status change event if CR is not pending
		if cr.Status != "pending" {
			var eventType string
			var title string
			switch cr.Status {
			case "approved":
				eventType = models.AuditEventTypeCRApproved
				title = fmt.Sprintf("Change Request #%d approved", cr.ID)
			case "rejected":
				eventType = models.AuditEventTypeCRRejected
				title = fmt.Sprintf("Change Request #%d rejected", cr.ID)
			case "withdrawn":
				eventType = models.AuditEventTypeCRWithdrawn
				title = fmt.Sprintf("Change Request #%d withdrawn", cr.ID)
			case "merged":
				eventType = models.AuditEventTypeCRMerged
				title = fmt.Sprintf("Change Request #%d merged", cr.ID)
			}

			if eventType != "" {
				statusEvent := &models.AuditEvent{
					ProjectID:       cr.ProjectID,
					DatasetID:       cr.DatasetID,
					EventType:       eventType,
					Title:           title,
					ActorID:         cr.ReviewerID,
					ChangeRequestID: &crID,
					EntityType:      "change_request",
					EntityID:        fmt.Sprintf("%d", cr.ID),
					CreatedAt:       cr.UpdatedAt,
				}

				// Get reviewer email
				if cr.ReviewerID > 0 {
					var reviewer models.User
					if err := gdb.First(&reviewer, cr.ReviewerID).Error; err == nil {
						statusEvent.ActorEmail = reviewer.Email
					}
				}

				gdb.Create(statusEvent)
			}
		}
	}
}

// Helper functions

func parseAuditID(s string) (uint64, error) {
	// Handle format: evt_123 or just 123
	s = strings.TrimPrefix(s, "evt_")
	return strconv.ParseUint(s, 10, 64)
}

func getDeltaRoot() string {
	cfg := config.Get()
	if cfg.DeltaDataRoot != "" {
		return cfg.DeltaDataRoot
	}
	return "/data/delta"
}

func loadJSONFile(path string) (map[string]interface{}, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}

	return result, nil
}

func generateDiffViaPython(datasetID uint, version int64) (map[string]interface{}, error) {
	cfg := config.Get()
	base := cfg.PythonServiceURL
	if strings.TrimSpace(base) == "" {
		base = "http://python-service:8000"
	}

	// Build request to Python service
	url := fmt.Sprintf("%s/diff?dataset_id=%d&version=%d", base, datasetID, version)
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("python service returned status %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}

	return result, nil
}

// RecordAuditEvent is a convenience function to record an audit event during operations
func RecordAuditEvent(projectID, datasetID, actorID uint, eventType, title, description string, changeRequestID *uint, summary models.AuditEventSummary, paths map[string]string) error {
	gdb := dbpkg.Get()
	if gdb == nil {
		return fmt.Errorf("database not available")
	}

	// Get actor email
	var actorEmail string
	var user models.User
	if err := gdb.First(&user, actorID).Error; err == nil {
		actorEmail = user.Email
	}

	event := &models.AuditEvent{
		ProjectID:       projectID,
		DatasetID:       datasetID,
		EventType:       eventType,
		Title:           title,
		Description:     description,
		ActorID:         actorID,
		ActorEmail:      actorEmail,
		ChangeRequestID: changeRequestID,
		EntityType:      "dataset",
		EntityID:        fmt.Sprintf("%d", datasetID),
		RowsAdded:       summary.RowsAdded,
		RowsUpdated:     summary.RowsUpdated,
		RowsDeleted:     summary.RowsDeleted,
		CellsChanged:    summary.CellsChanged,
		Warnings:        summary.Warnings,
		Errors:          summary.Errors,
		CreatedAt:       time.Now(),
	}

	if diffPath, ok := paths["diff"]; ok {
		event.DiffPath = diffPath
	}
	if validationPath, ok := paths["validation"]; ok {
		event.ValidationPath = validationPath
	}
	if metadataPath, ok := paths["metadata"]; ok {
		event.MetadataPath = metadataPath
	}

	return gdb.Create(event).Error
}
