package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	sqlite "github.com/glebarez/sqlite"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
	"github.com/oreo-io/oreo.io-v2/go-service/models"
	"gorm.io/gorm"
)

func TestRBAC_ProjectRoles(t *testing.T) {
	gdb, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	_ = gdb.AutoMigrate(&models.User{}, &models.Project{}, &models.ProjectRole{})
	dbpkg.Set(gdb)

	r := SetupRouter()

	// user1 (owner)
	tok1 := tokenFor(t, r, "u1@test.local")
	// user2 (viewer)
	tok2 := tokenFor(t, r, "u2@test.local")

	// create project as user1 (grants owner role)
	body, _ := json.Marshal(map[string]any{"name": "P1"})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+tok1)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("create proj %d %s", w.Code, w.Body.String())
	}
	var p models.Project
	_ = json.Unmarshal(w.Body.Bytes(), &p)

	// Manually add viewer role for user2
	var u2 models.User
	if err := gdb.Where("email = ?", "u2@test.local").First(&u2).Error; err != nil {
		t.Fatalf("u2 not found: %v", err)
	}
	_ = gdb.Create(&models.ProjectRole{ProjectID: p.ID, UserID: u2.ID, Role: "viewer"}).Error

	// Viewer can GET but cannot DELETE
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/projects/1", nil)
	req.Header.Set("Authorization", "Bearer "+tok2)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("viewer get %d %s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodDelete, "/api/projects/1", nil)
	req.Header.Set("Authorization", "Bearer "+tok2)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("viewer delete expected 403 got %d", w.Code)
	}

	// Owner can delete
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodDelete, "/api/projects/1", nil)
	req.Header.Set("Authorization", "Bearer "+tok1)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusNoContent {
		t.Fatalf("owner delete %d %s", w.Code, w.Body.String())
	}
}

func tokenFor(t *testing.T, r http.Handler, email string) string {
	t.Helper()
	// register
	body, _ := json.Marshal(map[string]string{"email": email, "password": "p4ss"})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	// login
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("login %d %s", w.Code, w.Body.String())
	}
	var lr struct {
		Token string `json:"token"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &lr)
	return lr.Token
}
