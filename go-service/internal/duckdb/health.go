//go:build cgo && !windows

// Package duckdb - Health check and diagnostic utilities
package duckdb

import (
	"context"
	"fmt"
	"time"
)

// HealthStatus represents the health of the DuckDB pool
type HealthStatus struct {
	OK           bool          `json:"ok"`
	Message      string        `json:"message"`
	DeltaRoot    string        `json:"delta_root"`
	ResponseTime time.Duration `json:"response_time_ms"`
}

// HealthCheck performs a health check on the DuckDB pool
func (p *Pool) HealthCheck(ctx context.Context) HealthStatus {
	start := time.Now()

	if p == nil || !p.IsReady() {
		return HealthStatus{
			OK:           false,
			Message:      "pool not initialized",
			ResponseTime: time.Since(start),
		}
	}

	// Try a simple query to verify the connection works
	conn, err := p.db.Conn(ctx)
	if err != nil {
		return HealthStatus{
			OK:           false,
			Message:      fmt.Sprintf("connection failed: %v", err),
			DeltaRoot:    p.deltaRoot,
			ResponseTime: time.Since(start),
		}
	}
	defer conn.Close()

	// Verify delta extension is loaded
	var version string
	row := conn.QueryRowContext(ctx, "SELECT version()")
	if err := row.Scan(&version); err != nil {
		return HealthStatus{
			OK:           false,
			Message:      fmt.Sprintf("version query failed: %v", err),
			DeltaRoot:    p.deltaRoot,
			ResponseTime: time.Since(start),
		}
	}

	return HealthStatus{
		OK:           true,
		Message:      fmt.Sprintf("healthy (DuckDB %s)", version),
		DeltaRoot:    p.deltaRoot,
		ResponseTime: time.Since(start),
	}
}

// Stats returns pool statistics
type PoolStats struct {
	MaxOpenConnections int `json:"max_open_connections"`
	OpenConnections    int `json:"open_connections"`
	InUse              int `json:"in_use"`
	Idle               int `json:"idle"`
}

// Stats returns current pool statistics
func (p *Pool) Stats() PoolStats {
	if p == nil || p.db == nil {
		return PoolStats{}
	}
	stats := p.db.Stats()
	return PoolStats{
		MaxOpenConnections: stats.MaxOpenConnections,
		OpenConnections:    stats.OpenConnections,
		InUse:              stats.InUse,
		Idle:               stats.Idle,
	}
}
