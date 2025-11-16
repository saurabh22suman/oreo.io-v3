package main

import (
    "net/http/httptest"
    "os"
    "testing"
)

// Test that DEFAULT_STORAGE_BACKEND env influences /api/storage/backend introspection route.
func TestStorageBackendIntrospectionDelta(t *testing.T) {
    os.Setenv("DEFAULT_STORAGE_BACKEND", "delta")
    r := SetupRouter()
    req := httptest.NewRequest("GET", "/api/storage/backend", nil)
    w := httptest.NewRecorder()
    r.ServeHTTP(w, req)
    if w.Code != 200 || !contains(w.Body.String(), "\"delta\"") {
        t.Fatalf("expected backend delta, code=%d body=%s", w.Code, w.Body.String())
    }
}

func TestStorageBackendIntrospectionPostgres(t *testing.T) {
    os.Setenv("DEFAULT_STORAGE_BACKEND", "postgres")
    r := SetupRouter()
    req := httptest.NewRequest("GET", "/api/storage/backend", nil)
    w := httptest.NewRecorder()
    r.ServeHTTP(w, req)
    if w.Code != 200 || !contains(w.Body.String(), "\"postgres\"") {
        t.Fatalf("expected backend postgres, code=%d body=%s", w.Code, w.Body.String())
    }
}

// contains is a tiny helper to avoid pulling in extra deps.
func contains(s, sub string) bool { return len(s) >= len(sub) && (stringIndex(s, sub) >= 0) }

func stringIndex(s, sub string) int {
    // naive search
    for i := 0; i+len(sub) <= len(s); i++ {
        if s[i:i+len(sub)] == sub { return i }
    }
    return -1
}
