//go:build cgo && !windows

// Package duckdb provides a connection pool for DuckDB with Delta Lake extension support.
// This eliminates the need to load the Delta extension on every request, providing
// significant performance improvements for read operations.
//
// NOTE: This package requires CGO and is not available on Windows.
// Use build tag: go build -tags cgo
package duckdb

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"sync"
	"time"

	_ "github.com/marcboeker/go-duckdb" // DuckDB driver
)

// Pool manages a pool of DuckDB connections with the Delta extension pre-loaded.
type Pool struct {
	db        *sql.DB
	deltaRoot string
	mu        sync.RWMutex
	ready     bool
}

var (
	pool     *Pool
	poolOnce sync.Once
	poolErr  error
)

// Config holds DuckDB pool configuration
type Config struct {
	DeltaRoot       string        // Root path for Delta tables (default: /data/delta)
	MaxOpenConns    int           // Max open connections (default: 10)
	MaxIdleConns    int           // Max idle connections (default: 5)
	ConnMaxLifetime time.Duration // Connection max lifetime (default: 30 min)
}

// DefaultConfig returns the default configuration
func DefaultConfig() Config {
	deltaRoot := os.Getenv("DELTA_DATA_ROOT")
	if deltaRoot == "" {
		deltaRoot = "/data/delta"
	}
	return Config{
		DeltaRoot:       deltaRoot,
		MaxOpenConns:    10,
		MaxIdleConns:    5,
		ConnMaxLifetime: 30 * time.Minute,
	}
}

// GetPool returns the global DuckDB pool instance, initializing it if needed.
// This uses a singleton pattern to ensure the Delta extension is loaded only once.
func GetPool() (*Pool, error) {
	poolOnce.Do(func() {
		pool, poolErr = NewPool(DefaultConfig())
	})
	return pool, poolErr
}

// NewPool creates a new DuckDB connection pool with the given configuration.
func NewPool(cfg Config) (*Pool, error) {
	// Open DuckDB with in-memory database (we'll query Delta files directly)
	db, err := sql.Open("duckdb", "")
	if err != nil {
		return nil, fmt.Errorf("failed to open duckdb: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.ConnMaxLifetime)

	// Test connection and load Delta extension
	// Use longer timeout for first-time extension download (can take 60-90s)
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	conn, err := db.Conn(ctx)
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to get connection: %w", err)
	}
	defer conn.Close()

	// Install and load Delta extension (this is the expensive operation we want to do once)
	// Retry up to 3 times with increasing timeout
	var installErr error
	for attempt := 1; attempt <= 3; attempt++ {
		if _, installErr = conn.ExecContext(ctx, "INSTALL delta"); installErr == nil {
			break
		}
		if attempt < 3 {
			time.Sleep(time.Duration(attempt) * 2 * time.Second)
		}
	}
	if installErr != nil {
		db.Close()
		return nil, fmt.Errorf("failed to install delta extension after 3 attempts: %w", installErr)
	}

	if _, err := conn.ExecContext(ctx, "LOAD delta"); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to load delta extension: %w", err)
	}

	p := &Pool{
		db:        db,
		deltaRoot: cfg.DeltaRoot,
		ready:     true,
	}

	return p, nil
}

// Close closes all connections in the pool
func (p *Pool) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.ready = false
	if p.db != nil {
		return p.db.Close()
	}
	return nil
}

// IsReady returns whether the pool is ready to accept queries
func (p *Pool) IsReady() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.ready
}

// DeltaRoot returns the configured Delta root path
func (p *Pool) DeltaRoot() string {
	return p.deltaRoot
}

// QueryResult holds the result of a Delta table query
type QueryResult struct {
	Columns []string                 `json:"columns"`
	Rows    []map[string]interface{} `json:"data"`
	Total   int                      `json:"total"`
}

// QueryDataset queries a Delta table for a specific dataset with pagination.
// This is the primary method for the Data Viewer and Live Edit read operations.
func (p *Pool) QueryDataset(ctx context.Context, projectID, datasetID int, limit, offset int) (*QueryResult, error) {
	if !p.IsReady() {
		return nil, fmt.Errorf("duckdb pool not ready")
	}

	// Build path to Delta table
	deltaPath := p.getMainPath(projectID, datasetID)

	// Normalize path for DuckDB (forward slashes)
	deltaPath = normalizePath(deltaPath)

	// Check if Delta table exists
	if !p.deltaTableExists(deltaPath) {
		return nil, fmt.Errorf("delta table not found at %s", deltaPath)
	}

	// Build and execute query
	query := fmt.Sprintf(
		"SELECT * FROM delta_scan('%s') LIMIT %d OFFSET %d",
		deltaPath, limit, offset,
	)

	rows, err := p.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	return p.scanRows(rows)
}

// QueryDatasetSQL executes a custom SQL query against a Delta table.
// The tableMappings parameter maps table references to project/dataset IDs.
func (p *Pool) QueryDatasetSQL(ctx context.Context, sqlQuery string, tableMappings map[string]string, limit, offset int) (*QueryResult, error) {
	if !p.IsReady() {
		return nil, fmt.Errorf("duckdb pool not ready")
	}

	// Get a connection from the pool
	conn, err := p.db.Conn(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get connection: %w", err)
	}
	defer conn.Close()

	// Ensure delta extension is loaded on this connection
	if _, err := conn.ExecContext(ctx, "LOAD delta"); err != nil {
		return nil, fmt.Errorf("failed to load delta: %w", err)
	}

	// Register each Delta table as a view
	for tableRef, pathInfo := range tableMappings {
		deltaPath, err := p.resolveDeltaPath(pathInfo)
		if err != nil {
			return nil, fmt.Errorf("failed to resolve path for %s: %w", tableRef, err)
		}

		// Create view for the table reference
		viewName := sanitizeViewName(tableRef)
		createViewSQL := fmt.Sprintf(
			"CREATE OR REPLACE VIEW %s AS SELECT * FROM delta_scan('%s')",
			viewName, deltaPath,
		)

		if _, err := conn.ExecContext(ctx, createViewSQL); err != nil {
			return nil, fmt.Errorf("failed to create view %s: %w", viewName, err)
		}
	}

	// Execute the query with pagination
	paginatedQuery := fmt.Sprintf(
		"SELECT * FROM (%s) AS subquery LIMIT %d OFFSET %d",
		sqlQuery, limit, offset,
	)

	rows, err := conn.QueryContext(ctx, paginatedQuery)
	if err != nil {
		return nil, fmt.Errorf("query execution failed: %w", err)
	}
	defer rows.Close()

	return p.scanRows(rows)
}

// GetDatasetStats returns row count and column count for a dataset
func (p *Pool) GetDatasetStats(ctx context.Context, projectID, datasetID int) (rowCount int, colCount int, err error) {
	if !p.IsReady() {
		return 0, 0, fmt.Errorf("duckdb pool not ready")
	}

	deltaPath := p.getMainPath(projectID, datasetID)
	deltaPath = normalizePath(deltaPath)

	if !p.deltaTableExists(deltaPath) {
		return 0, 0, nil // Empty dataset
	}

	// Get row count
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM delta_scan('%s')", deltaPath)
	row := p.db.QueryRowContext(ctx, countQuery)
	if err := row.Scan(&rowCount); err != nil {
		return 0, 0, fmt.Errorf("failed to get row count: %w", err)
	}

	// Get column count by querying schema
	schemaQuery := fmt.Sprintf("SELECT * FROM delta_scan('%s') LIMIT 1", deltaPath)
	rows, err := p.db.QueryContext(ctx, schemaQuery)
	if err != nil {
		return rowCount, 0, fmt.Errorf("failed to get schema: %w", err)
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return rowCount, 0, fmt.Errorf("failed to get columns: %w", err)
	}
	colCount = len(cols)

	return rowCount, colCount, nil
}

// Helper methods

func (p *Pool) getMainPath(projectID, datasetID int) string {
	return fmt.Sprintf("%s/projects/%d/datasets/%d/main", p.deltaRoot, projectID, datasetID)
}

func (p *Pool) deltaTableExists(path string) bool {
	// Check if _delta_log directory exists
	logPath := path + "/_delta_log"
	info, err := os.Stat(logPath)
	return err == nil && info.IsDir()
}

func (p *Pool) resolveDeltaPath(pathInfo string) (string, error) {
	// pathInfo can be "project_id/dataset_id" or just "dataset_id"
	var projectID, datasetID int

	if _, err := fmt.Sscanf(pathInfo, "%d/%d", &projectID, &datasetID); err == nil {
		// New hierarchical path
		path := p.getMainPath(projectID, datasetID)
		if p.deltaTableExists(normalizePath(path)) {
			return normalizePath(path), nil
		}
	}

	// Try legacy path
	if _, err := fmt.Sscanf(pathInfo, "%d", &datasetID); err == nil {
		legacyPath := fmt.Sprintf("%s/%d", p.deltaRoot, datasetID)
		if p.deltaTableExists(normalizePath(legacyPath)) {
			return normalizePath(legacyPath), nil
		}
	}

	return "", fmt.Errorf("delta table not found for path: %s", pathInfo)
}

func (p *Pool) scanRows(rows *sql.Rows) (*QueryResult, error) {
	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to get columns: %w", err)
	}

	result := &QueryResult{
		Columns: columns,
		Rows:    make([]map[string]interface{}, 0),
	}

	// Create a slice of interface{} to scan into
	values := make([]interface{}, len(columns))
	valuePtrs := make([]interface{}, len(columns))
	for i := range values {
		valuePtrs[i] = &values[i]
	}

	for rows.Next() {
		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		rowMap := make(map[string]interface{})
		for i, col := range columns {
			rowMap[col] = convertValue(values[i])
		}
		result.Rows = append(result.Rows, rowMap)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}

	result.Total = len(result.Rows)
	return result, nil
}

// normalizePath converts Windows paths to forward slashes for DuckDB
func normalizePath(path string) string {
	// Replace backslashes with forward slashes
	result := ""
	for _, c := range path {
		if c == '\\' {
			result += "/"
		} else {
			result += string(c)
		}
	}
	return result
}

// sanitizeViewName converts a table reference to a valid DuckDB view name
func sanitizeViewName(tableRef string) string {
	result := ""
	for _, c := range tableRef {
		if c == '.' || c == '-' || c == ' ' {
			result += "_"
		} else {
			result += string(c)
		}
	}
	return result
}

// convertValue converts database values to JSON-serializable types
func convertValue(v interface{}) interface{} {
	if v == nil {
		return nil
	}

	switch val := v.(type) {
	case []byte:
		return string(val)
	case time.Time:
		return val.Format(time.RFC3339)
	default:
		return val
	}
}
