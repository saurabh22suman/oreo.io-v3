package main

import (
    "net/http/httptest"
    "os"
    "testing"
)

func TestHealthEndpoints(t *testing.T) {
    os.Setenv("DEFAULT_STORAGE_BACKEND", "postgres")
    r := SetupRouter()

    // /healthz
    w := httptest.NewRecorder()
    req := httptest.NewRequest("GET", "/healthz", nil)
    r.ServeHTTP(w, req)
    if w.Code != 200 { t.Fatalf("/healthz => %d", w.Code) }

    // /api/ping
    w = httptest.NewRecorder()
    req = httptest.NewRequest("GET", "/api/ping", nil)
    r.ServeHTTP(w, req)
    if w.Code != 200 { t.Fatalf("/api/ping => %d", w.Code) }

    // /api/storage/backend
    w = httptest.NewRecorder()
    req = httptest.NewRequest("GET", "/api/storage/backend", nil)
    r.ServeHTTP(w, req)
    if w.Code != 200 { t.Fatalf("/api/storage/backend => %d", w.Code) }
}
