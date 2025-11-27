package tests

import (
    "context"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "os"
    "testing"

    "github.com/oreo-io/oreo.io-v2/go-service/internal/storage"
)

// These are pseudo end-to-end tests: we mock the Python service but exercise the DeltaAdapter
// path including environment variable resolution and JSON contract. Real container tests would
// be added in CI with docker-compose.

func TestDeltaAdapter_Query_EndToEnd(t *testing.T) {
    ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.URL.Path != "/delta/query" { w.WriteHeader(404); return }
        var body map[string]interface{}
        json.NewDecoder(r.Body).Decode(&body)
        // Simulate a response from Python service
        w.Header().Set("Content-Type", "application/json")
        w.Write([]byte(`{"columns":["id","name"],"rows":[{"id":1,"name":"alice"},{"id":2,"name":"bob"}],"count":2}`))
    }))
    defer ts.Close()
    os.Setenv("PYTHON_SERVICE_URL", ts.URL)
    os.Setenv("DELTA_DATA_ROOT", "/delta-root")

    adapter := storage.NewDeltaAdapter()
    res, err := adapter.Query(context.Background(), storage.QueryRequest{DatasetID: "people", Limit: 10})
    if err != nil { t.Fatalf("query failed: %v", err) }
    if len(res.Columns) != 2 || len(res.Rows) != 2 { t.Fatalf("unexpected result shape: %+v", res) }
    if res.Columns[0] != "id" || res.Columns[1] != "name" { t.Fatalf("unexpected columns: %+v", res.Columns) }
}

func TestDeltaAdapter_Append_EndToEnd(t *testing.T) {
    var received map[string]interface{}
    ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        switch r.URL.Path {
        case "/delta/append":
            json.NewDecoder(r.Body).Decode(&received)
            w.Header().Set("Content-Type", "application/json")
            w.Write([]byte(`{"ok":true}`))
        default:
            w.WriteHeader(404)
        }
    }))
    defer ts.Close()
    os.Setenv("PYTHON_SERVICE_URL", ts.URL)
    adapter := storage.NewDeltaAdapter()
    rows := []map[string]interface{}{{"id": 1, "name": "alice"}}
    if err := adapter.Insert(context.Background(), "people", rows); err != nil { t.Fatalf("insert failed: %v", err) }
    if received == nil || received["rows"] == nil { t.Fatalf("expected rows in python payload, got %#v", received) }
}
