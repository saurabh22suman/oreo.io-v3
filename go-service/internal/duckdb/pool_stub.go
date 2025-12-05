//go:build !cgo || windows

// Package duckdb provides stub implementations when CGO is not available.
// This allows the code to compile on Windows or when CGO is disabled.
package duckdb

import (
	"context"
	"errors"
	"time"
)

// ErrNotAvailable is returned when DuckDB is not available (CGO disabled or Windows)
var ErrNotAvailable = errors.New("duckdb: not available (requires CGO, not supported on Windows)")

// Pool is a stub for non-CGO builds
type Pool struct{}

// Config holds DuckDB pool configuration
type Config struct {
	DeltaRoot       string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

// DefaultConfig returns the default configuration
func DefaultConfig() Config {
	return Config{}
}

// GetPool returns an error on non-CGO builds
func GetPool() (*Pool, error) {
	return nil, ErrNotAvailable
}

// NewPool returns an error on non-CGO builds
func NewPool(cfg Config) (*Pool, error) {
	return nil, ErrNotAvailable
}

// Close is a no-op on non-CGO builds
func (p *Pool) Close() error {
	return nil
}

// IsReady always returns false on non-CGO builds
func (p *Pool) IsReady() bool {
	return false
}

// DeltaRoot returns empty string on non-CGO builds
func (p *Pool) DeltaRoot() string {
	return ""
}

// QueryResult holds the result of a Delta table query
type QueryResult struct {
	Columns []string                 `json:"columns"`
	Rows    []map[string]interface{} `json:"data"`
	Total   int                      `json:"total"`
}

// QueryDataset returns an error on non-CGO builds
func (p *Pool) QueryDataset(ctx context.Context, projectID, datasetID int, limit, offset int) (*QueryResult, error) {
	return nil, ErrNotAvailable
}

// QueryDatasetSQL returns an error on non-CGO builds
func (p *Pool) QueryDatasetSQL(ctx context.Context, sqlQuery string, tableMappings map[string]string, limit, offset int) (*QueryResult, error) {
	return nil, ErrNotAvailable
}

// GetDatasetStats returns an error on non-CGO builds
func (p *Pool) GetDatasetStats(ctx context.Context, projectID, datasetID int) (rowCount int, colCount int, err error) {
	return 0, 0, ErrNotAvailable
}

// HealthStatus represents the health of the DuckDB pool
type HealthStatus struct {
	OK           bool          `json:"ok"`
	Message      string        `json:"message"`
	DeltaRoot    string        `json:"delta_root"`
	ResponseTime time.Duration `json:"response_time_ms"`
}

// HealthCheck returns not available status on non-CGO builds
func (p *Pool) HealthCheck(ctx context.Context) HealthStatus {
	return HealthStatus{
		OK:      false,
		Message: "duckdb not available (requires CGO)",
	}
}

// PoolStats returns pool statistics
type PoolStats struct {
	MaxOpenConnections int `json:"max_open_connections"`
	OpenConnections    int `json:"open_connections"`
	InUse              int `json:"in_use"`
	Idle               int `json:"idle"`
}

// Stats returns empty stats on non-CGO builds
func (p *Pool) Stats() PoolStats {
	return PoolStats{}
}
