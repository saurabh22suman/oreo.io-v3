package storage

import "context"

// QueryRequest defines a simple query payload.
type QueryRequest struct {
    // Optional raw SQL for legacy paths
    SQL      string
    // DatasetID maps to physical Delta path (for delta backend)
    DatasetID string
    // Filters is a simple key->value bag interpreted by the backend
    Filters  map[string]interface{}
    // Optional ORDER BY clause (backend interpreted)
    OrderBy string
    // Limit number of rows returned
    Limit   int
}

// QueryResult is a tabular response shape used across adapters.
type QueryResult struct {
    Columns []string
    Rows    [][]interface{}
}

// VersionInfo summarizes a Delta-like version entry.
type VersionInfo struct {
    Version   int
    Timestamp string
    Operation string
}

// StorageAdapter is the swappable data access contract for dataset storage backends.
// Implementations: PostgresAdapter (current), DeltaAdapter (migration target).
type StorageAdapter interface {
    Query(ctx context.Context, req QueryRequest) (QueryResult, error)
    Insert(ctx context.Context, datasetID string, records []map[string]interface{}) error
    Merge(ctx context.Context, datasetID string, stagingPath string, keys []string) error
    Delete(ctx context.Context, datasetID string, filter string) error
    History(ctx context.Context, datasetID string) ([]VersionInfo, error)
    Restore(ctx context.Context, datasetID string, version int) error
}

// NewAdapter returns a StorageAdapter implementation by name.
// Recognized names: "postgres", "delta". Defaults to "postgres".
func NewAdapter(name string) StorageAdapter {
    switch name {
    case "delta":
        return NewDeltaAdapter()
    case "postgres":
        fallthrough
    default:
        return &PostgresAdapter{}
    }
}
