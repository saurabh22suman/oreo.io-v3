package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
	"github.com/oreo-io/oreo.io-v2/go-service/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) {
	t.Helper()
	gdb, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("sqlite open: %v", err)
	}
	if err := gdb.AutoMigrate(&models.User{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	dbpkg.Set(gdb)
}

func TestAuthFlow(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret")
	defer os.Unsetenv("JWT_SECRET")
	setupTestDB(t)
	r := SetupRouter()

	// Register
	reg := map[string]string{"email": "user@test.local", "password": "pass1234"}
	body, _ := json.Marshal(reg)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("register expected 201, got %d: %s", w.Code, w.Body.String())
	}

	// Login
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("login expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var lr struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &lr); err != nil || lr.Token == "" {
		t.Fatalf("login token missing: %v %s", err, w.Body.String())
	}

	// Refresh
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/auth/refresh", nil)
	req.Header.Set("Authorization", "Bearer "+lr.Token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("refresh expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var rr struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &rr); err != nil || rr.Token == "" {
		t.Fatalf("refresh token missing: %v %s", err, w.Body.String())
	}

	// Me (protected)
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+rr.Token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("me expected 200, got %d: %s", w.Code, w.Body.String())
	}
}
