package storage

import (
    "context"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "os"
    "testing"
)

func TestDeltaAdapter_Query_PathMapping(t *testing.T) {
    // Mock python service
    var receivedPath string
    ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.URL.Path != "/delta/query" { w.WriteHeader(404); return }
        var body map[string]interface{}
        json.NewDecoder(r.Body).Decode(&body)
        if p, ok := body["path"].(string); ok { receivedPath = p }
        // respond with minimal structure
        w.Header().Set("Content-Type", "application/json")
        w.Write([]byte(`{"columns":["id"],"rows":[{"id":1}],"count":1}`))
    }))
    defer ts.Close()
    os.Setenv("PYTHON_SERVICE_URL", ts.URL)
    os.Setenv("DELTA_DATA_ROOT", "/delta-root")

    a := NewDeltaAdapter()
    _, err := a.Query(context.Background(), QueryRequest{DatasetID: "customers", Limit: 1})
    if err != nil { t.Fatalf("query failed: %v", err) }
    expected := "/delta-root/customers"
    if receivedPath != expected {
        t.Fatalf("expected path %s, got %s", expected, receivedPath)
    }
}

func TestDeltaAdapter_Query_FilterHandling(t *testing.T) {
    var receivedFilters map[string]interface{}
    ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.URL.Path != "/delta/query" { w.WriteHeader(404); return }
        var body map[string]interface{}
        json.NewDecoder(r.Body).Decode(&body)
        if f, ok := body["filters"].(map[string]interface{}); ok { receivedFilters = f }
        w.Header().Set("Content-Type", "application/json")
        w.Write([]byte(`{"columns":["id"],"rows":[],"count":0}`))
    }))
    defer ts.Close()
    os.Setenv("PYTHON_SERVICE_URL", ts.URL)
    os.Setenv("DELTA_DATA_ROOT", "/delta-root")
    a := NewDeltaAdapter()
    filters := map[string]interface{}{"country": "US", "active": true}
    _, err := a.Query(context.Background(), QueryRequest{DatasetID: "customers", Filters: filters, Limit: 10})
    if err != nil { t.Fatalf("query failed: %v", err) }
    if len(receivedFilters) != 2 || receivedFilters["country"] != "US" || receivedFilters["active"] != true {
        t.Fatalf("filters not transmitted correctly: %#v", receivedFilters)
    }
}
