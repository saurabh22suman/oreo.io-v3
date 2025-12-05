package handlers

import (
	"context"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/duckdb"
)

// useDuckDBDirect controls whether to use direct DuckDB queries (POC feature flag)
// Set via USE_DUCKDB_DIRECT=true environment variable
var useDuckDBDirect = false

func init() {
	// Check environment variable for feature flag
	if val := os.Getenv("USE_DUCKDB_DIRECT"); strings.EqualFold(val, "true") {
		useDuckDBDirect = true
	}
}

// DatasetDataGetDuckDB handles data fetching using direct DuckDB queries.
// This is the optimized path that bypasses the Python service for read operations.
func DatasetDataGetDuckDB(c *gin.Context, ds interface {
	GetProjectID() uint
	GetID() uint
}) (*duckdb.QueryResult, error) {
	// Parse query parameters
	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 50
	}
	if limit > 1000 {
		limit = 1000 // Cap at 1000 rows
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	// Get DuckDB pool
	pool, err := duckdb.GetPool()
	if err != nil {
		return nil, err
	}

	// Query with timeout
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	return pool.QueryDataset(ctx, int(ds.GetProjectID()), int(ds.GetID()), limit, offset)
}

// DuckDBHealthHandler returns health status of the DuckDB pool
func DuckDBHealthHandler(c *gin.Context) {
	pool, err := duckdb.GetPool()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"ok":      false,
			"error":   err.Error(),
			"backend": "duckdb",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	status := pool.HealthCheck(ctx)
	stats := pool.Stats()

	httpStatus := http.StatusOK
	if !status.OK {
		httpStatus = http.StatusServiceUnavailable
	}

	c.JSON(httpStatus, gin.H{
		"ok":           status.OK,
		"message":      status.Message,
		"delta_root":   status.DeltaRoot,
		"response_ms":  status.ResponseTime.Milliseconds(),
		"backend":      "duckdb",
		"pool_stats":   stats,
		"feature_flag": useDuckDBDirect,
	})
}

// DuckDBQueryHandler handles SQL queries using direct DuckDB
func DuckDBQueryHandler(c *gin.Context) {
	var req struct {
		SQL           string            `json:"sql" binding:"required"`
		TableMappings map[string]string `json:"table_mappings" binding:"required"`
		Limit         int               `json:"limit"`
		Offset        int               `json:"offset"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request", "details": err.Error()})
		return
	}

	// Apply defaults
	if req.Limit <= 0 {
		req.Limit = 250
	}
	if req.Limit > 1000 {
		req.Limit = 1000
	}

	pool, err := duckdb.GetPool()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "duckdb not available", "details": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	start := time.Now()
	result, err := pool.QueryDatasetSQL(ctx, req.SQL, req.TableMappings, req.Limit, req.Offset)
	elapsed := time.Since(start)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed", "details": err.Error()})
		return
	}

	// Convert to the format expected by frontend (columns + rows as arrays)
	rows := make([][]interface{}, len(result.Rows))
	for i, rowMap := range result.Rows {
		row := make([]interface{}, len(result.Columns))
		for j, col := range result.Columns {
			row[j] = rowMap[col]
		}
		rows[i] = row
	}

	c.JSON(http.StatusOK, gin.H{
		"columns":    result.Columns,
		"rows":       rows,
		"total":      result.Total,
		"elapsed_ms": elapsed.Milliseconds(),
		"backend":    "duckdb-direct",
	})
}

// IsDuckDBEnabled returns whether direct DuckDB queries are enabled
func IsDuckDBEnabled() bool {
	return useDuckDBDirect
}

// EnableDuckDB enables direct DuckDB queries (for testing)
func EnableDuckDB() {
	useDuckDBDirect = true
}

// DisableDuckDB disables direct DuckDB queries (for testing)
func DisableDuckDB() {
	useDuckDBDirect = false
}
