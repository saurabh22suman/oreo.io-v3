package main
import "github.com/oreo-io/oreo.io-v2/go-service/internal/handlers"

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestHealthz(t *testing.T) {
	r := handlers.SetupRouter()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestPing(t *testing.T) {
	r := handlers.SetupRouter()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/ping", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestProxyValidate(t *testing.T) {
	// Fake Python service
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/validate" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"valid": true, "errors": []}`))
	}))
	defer fake.Close()

	os.Setenv("PYTHON_SERVICE_URL", fake.URL)
	defer os.Unsetenv("PYTHON_SERVICE_URL")

	r := handlers.SetupRouter()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/data/validate", bytes.NewBufferString(`{"data": [], "json_schema": {}}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}
