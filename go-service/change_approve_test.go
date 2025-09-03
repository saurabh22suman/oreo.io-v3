package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	sqlite "github.com/glebarez/sqlite"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
	"github.com/oreo-io/oreo.io-v2/go-service/models"
	"gorm.io/gorm"
)

// TestApproveAppendAppliesAndUpdatesStats validates that approving an append change moves data
// from staging to the main table and updates stats row_count accordingly.
func TestApproveAppendAppliesAndUpdatesStats(t *testing.T) {
	// Fake python service for validate endpoints
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/validate" || r.URL.Path == "/rules/validate" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"valid": true}`))
			return
		}
		http.NotFound(w, r)
	}))
	defer fake.Close()
	os.Setenv("PYTHON_SERVICE_URL", fake.URL)
	defer os.Unsetenv("PYTHON_SERVICE_URL")

	// In-memory DB
	gdb, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	_ = gdb.AutoMigrate(&models.User{}, &models.Project{}, &models.ProjectRole{}, &models.Dataset{}, &models.DatasetUpload{}, &models.ChangeRequest{}, &models.DatasetMeta{}, &models.ChangeComment{}, &models.DatasetVersion{}, &models.Notification{})
	dbpkg.Set(gdb)

	r := SetupRouter()
	token := tokenFor(t, r, "owner@test.local")

	// Create project
	body, _ := json.Marshal(map[string]any{"name": "P1"})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("project create %d %s", w.Code, w.Body.String())
	}
	var p models.Project
	_ = json.Unmarshal(w.Body.Bytes(), &p)

	// Create dataset
	body, _ = json.Marshal(map[string]any{"name": "DS1"})
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/projects/"+itoa(p.ID)+"/datasets", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("create ds %d %s", w.Code, w.Body.String())
	}

	// Validate edited JSON (top-level) -> get upload_id
	rows := []map[string]any{{"id": 1, "name": "Alice"}}
	vbody, _ := json.Marshal(map[string]any{"rows": rows, "filename": "edited.json"})
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/datasets/1/data/append/json/validate", bytes.NewReader(vbody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("json validate %d %s", w.Code, w.Body.String())
	}
	var vr struct {
		Ok       bool `json:"ok"`
		UploadID uint `json:"upload_id"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &vr)
	if !vr.Ok || vr.UploadID == 0 {
		t.Fatalf("unexpected validate resp: %s", w.Body.String())
	}

	// Open change assigned to self
	openBody := map[string]any{"upload_id": vr.UploadID, "reviewer_ids": []uint{1}, "title": "Append data"}
	ob, _ := json.Marshal(openBody)
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/datasets/1/data/append/open", bytes.NewReader(ob))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated && w.Code != http.StatusOK {
		t.Fatalf("open change %d %s", w.Code, w.Body.String())
	}
	var openResp struct {
		Ok     bool `json:"ok"`
		Change struct {
			ID uint `json:"id"`
		} `json:"change_request"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &openResp)
	if !openResp.Ok || openResp.Change.ID == 0 {
		t.Fatalf("unexpected open resp: %s", w.Body.String())
	}

	// Approve change
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/projects/"+itoa(p.ID)+"/changes/"+itoa(openResp.Change.ID)+"/approve", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("approve %d %s", w.Code, w.Body.String())
	}

	// Stats should show row_count = 1
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/datasets/1/stats", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("stats %d %s", w.Code, w.Body.String())
	}
	var stats map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &stats)
	if rc, ok := stats["row_count"].(float64); !ok || int(rc) != 1 {
		t.Fatalf("expected row_count 1, got %v in %v", stats["row_count"], w.Body.String())
	}
}
