package storage

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "path/filepath"
    "strings"
    "time"

    "github.com/oreo-io/oreo.io-v2/go-service/internal/config"
)

// DeltaAdapter proxies dataset operations to the Python FastAPI /delta endpoints.
type DeltaAdapter struct {
    baseURL string
    client  *http.Client
}

func NewDeltaAdapter() *DeltaAdapter {
    cfg := config.Get(); base := cfg.PythonServiceURL
    if base == "" {
        base = "http://python-service:8000"
    }
    return &DeltaAdapter{
        baseURL: base,
        client:  &http.Client{Timeout: 15 * time.Second},
    }
}

// helper to POST JSON and decode JSON response
func (d *DeltaAdapter) postJSON(ctx context.Context, path string, body any, out any) error {
    b, err := json.Marshal(body)
    if err != nil {
        return err
    }
    req, err := http.NewRequestWithContext(ctx, http.MethodPost, d.baseURL+path, bytes.NewReader(b))
    if err != nil {
        return err
    }
    req.Header.Set("Content-Type", "application/json")
    resp, err := d.client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    if resp.StatusCode < 200 || resp.StatusCode >= 300 {
        return fmt.Errorf("delta proxy status %d", resp.StatusCode)
    }
    if out != nil {
        dec := json.NewDecoder(resp.Body)
        return dec.Decode(out)
    }
    return nil
}

func (d *DeltaAdapter) Query(ctx context.Context, req QueryRequest) (QueryResult, error) {
    // Map DatasetID to physical delta path
    cfg := config.Get(); root := strings.TrimRight(cfg.DeltaDataRoot, "/\\")
    if root == "" { root = "/data/delta" }
    var fullPath string
    if strings.TrimSpace(req.DatasetID) != "" {
        // Use filepath.Join to normalize separators; FastAPI expects posix-like paths but will handle windows mounts
        fullPath = filepath.ToSlash(filepath.Join(root, req.DatasetID))
    }
    // Build payload for Python /delta/query
    payload := map[string]any{
        "path":    fullPath,
        "filters": req.Filters,
        "limit":   req.Limit,
    }
    if strings.TrimSpace(req.OrderBy) != "" {
        payload["order_by"] = req.OrderBy
    }
    if strings.TrimSpace(req.SQL) != "" {
        // Provide raw SQL for back-compat when delta endpoint supports it
        payload["sql"] = req.SQL
    }
    var out struct{
        Columns []string        `json:"columns"`
        Rows    []map[string]any `json:"rows"`
        Count   int             `json:"count"`
    }
    if err := d.postJSON(ctx, "/delta/query", payload, &out); err != nil {
        return QueryResult{}, err
    }
    // Convert rows map to [][]interface{} for a uniform result shape
    matrix := make([][]interface{}, 0, len(out.Rows))
    for _, r := range out.Rows {
        row := make([]interface{}, 0, len(out.Columns))
        for _, c := range out.Columns {
            row = append(row, r[c])
        }
        matrix = append(matrix, row)
    }
    return QueryResult{Columns: out.Columns, Rows: matrix}, nil
}

func (d *DeltaAdapter) Insert(ctx context.Context, datasetID string, records []map[string]interface{}) error {
    payload := map[string]any{
        "table":   datasetID,
        "rows":    records,
    }
    // Python currently returns { ok: true } on /delta/append
    var resp map[string]any
    return d.postJSON(ctx, "/delta/append", payload, &resp)
}

func (d *DeltaAdapter) Merge(ctx context.Context, datasetID string, stagingPath string, keys []string) error {
    payload := map[string]any{
        "target_path": datasetID,
        "staging_path": stagingPath,
        "keys": keys,
    }
    var resp map[string]any
    // Endpoint may not be implemented yet; keep contract in place
    return d.postJSON(ctx, "/delta/merge", payload, &resp)
}

func (d *DeltaAdapter) Delete(ctx context.Context, datasetID string, filter string) error {
    // Not exposed yet; no-op for now
    return nil
}

func (d *DeltaAdapter) History(ctx context.Context, datasetID string) ([]VersionInfo, error) {
    // Use POST for simplicity with current python implementation
    payload := map[string]any{"table": datasetID}
    var out struct{ History []map[string]any `json:"history"` }
    if err := d.postJSON(ctx, "/delta/history/"+datasetID, payload, &out); err != nil {
        // Fall back to GET signature if POST fails in future
        return []VersionInfo{}, err
    }
    result := make([]VersionInfo, 0, len(out.History))
    for _, h := range out.History {
        vi := VersionInfo{}
        if v, ok := h["version"].(float64); ok { vi.Version = int(v) }
        if ts, ok := h["timestamp"].(string); ok { vi.Timestamp = ts }
        if op, ok := h["operation"].(string); ok { vi.Operation = op }
        result = append(result, vi)
    }
    return result, nil
}

func (d *DeltaAdapter) Restore(ctx context.Context, datasetID string, version int) error {
    payload := map[string]any{"table": datasetID, "version": version}
    var resp map[string]any
    return d.postJSON(ctx, "/delta/restore/"+datasetID+fmt.Sprintf("/%d", version), payload, &resp)
}
