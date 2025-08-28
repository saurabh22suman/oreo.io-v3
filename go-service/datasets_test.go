package main

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	sqlite "github.com/glebarez/sqlite"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
	"github.com/oreo-io/oreo.io-v2/go-service/models"
	"gorm.io/gorm"
)

func setupDatasetsTest(t *testing.T) (token string, projectID uint) {
	t.Helper()
	gdb, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("sqlite open: %v", err)
	}
	if err := gdb.AutoMigrate(&models.User{}, &models.Project{}, &models.Dataset{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	dbpkg.Set(gdb)

	r := SetupRouter()
	token = authToken(t, r)

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
	var proj models.Project
	_ = json.Unmarshal(w.Body.Bytes(), &proj)
	return token, proj.ID
}

func TestDatasetsCRUD(t *testing.T) {
	token, pid := setupDatasetsTest(t)
	r := SetupRouter()

	// Create dataset
	body, _ := json.Marshal(map[string]any{"name": "DS1", "schema": "{}"})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/projects/"+itoa(pid)+"/datasets", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("create ds %d %s", w.Code, w.Body.String())
	}

	// List
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/projects/"+itoa(pid)+"/datasets", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("list ds %d %s", w.Code, w.Body.String())
	}

	// Get 1
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/projects/"+itoa(pid)+"/datasets/1", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("get ds %d %s", w.Code, w.Body.String())
	}

	// Update
	body, _ = json.Marshal(map[string]any{"name": "DS1-upd", "schema": "{}\n"})
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPut, "/api/projects/"+itoa(pid)+"/datasets/1", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("update ds %d %s", w.Code, w.Body.String())
	}

	// Delete (owner allowed)
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodDelete, "/api/projects/"+itoa(pid)+"/datasets/1", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusNoContent {
		t.Fatalf("delete ds %d %s", w.Code, w.Body.String())
	}
}

func TestDatasetsRBAC(t *testing.T) {
	// Setup DB with schemas
	gdb, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	_ = gdb.AutoMigrate(&models.User{}, &models.Project{}, &models.ProjectRole{}, &models.Dataset{})
	dbpkg.Set(gdb)
	r := SetupRouter()

	owner := tokenFor(t, r, "owner@test.local")
	viewer := tokenFor(t, r, "viewer@test.local")
	editor := tokenFor(t, r, "editor@test.local")

	// Create project as owner
	body, _ := json.Marshal(map[string]any{"name": "P1"})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+owner)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("create proj %d %s", w.Code, w.Body.String())
	}
	var p models.Project
	_ = json.Unmarshal(w.Body.Bytes(), &p)

	// add roles for viewer and editor (ensure users exist)
	var uView, uEdit models.User
	if err := gdb.Where("email = ?", "viewer@test.local").First(&uView).Error; err != nil {
		t.Fatalf("viewer user not found: %v", err)
	}
	if err := gdb.Where("email = ?", "editor@test.local").First(&uEdit).Error; err != nil {
		t.Fatalf("editor user not found: %v", err)
	}
	_ = gdb.Create(&models.ProjectRole{ProjectID: p.ID, UserID: uView.ID, Role: "viewer"}).Error
	_ = gdb.Create(&models.ProjectRole{ProjectID: p.ID, UserID: uEdit.ID, Role: "editor"}).Error

	// owner creates dataset DS1
	body, _ = json.Marshal(map[string]any{"name": "DS1"})
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/projects/"+itoa(p.ID)+"/datasets", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+owner)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("owner create ds %d %s", w.Code, w.Body.String())
	}

	// viewer can list/get
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/projects/"+itoa(p.ID)+"/datasets", nil)
	req.Header.Set("Authorization", "Bearer "+viewer)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("viewer list %d", w.Code)
	}

	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/projects/"+itoa(p.ID)+"/datasets/1", nil)
	req.Header.Set("Authorization", "Bearer "+viewer)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("viewer get %d", w.Code)
	}

	// viewer cannot create/update/delete
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/projects/"+itoa(p.ID)+"/datasets", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+viewer)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("viewer create expected 403 got %d", w.Code)
	}

	// editor updates dataset 1 to a new unique name
	body, _ = json.Marshal(map[string]any{"name": "DS1-edited"})
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPut, "/api/projects/"+itoa(p.ID)+"/datasets/1", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+viewer)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("viewer update expected 403 got %d", w.Code)
	}

	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodDelete, "/api/projects/"+itoa(p.ID)+"/datasets/1", nil)
	req.Header.Set("Authorization", "Bearer "+viewer)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("viewer delete expected 403 got %d", w.Code)
	}

	// editor can create/update but not delete
	// editor creates DS2 (distinct name to avoid uniqueness conflict with DS1)
	body, _ = json.Marshal(map[string]any{"name": "DS2"})
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/projects/"+itoa(p.ID)+"/datasets", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+editor)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("editor create %d %s", w.Code, w.Body.String())
	}

	// update dataset 1 to a unique name (avoid DS2 which already exists)
	body, _ = json.Marshal(map[string]any{"name": "DS1-edited-by-editor"})
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPut, "/api/projects/"+itoa(p.ID)+"/datasets/1", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+editor)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("editor update %d %s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodDelete, "/api/projects/"+itoa(p.ID)+"/datasets/1", nil)
	req.Header.Set("Authorization", "Bearer "+editor)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("editor delete expected 403 got %d", w.Code)
	}
}

func TestDatasetUpload(t *testing.T) {
	// Fake Python /infer-schema server
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/infer-schema" || r.Method != http.MethodPost {
			t.Fatalf("unexpected call: %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"schema": {"type": "object", "properties": {"a": {"type": "integer"}, "b": {"type": "integer"}}}}`))
	}))
	defer fake.Close()
	os.Setenv("PYTHON_SERVICE_URL", fake.URL)
	defer os.Unsetenv("PYTHON_SERVICE_URL")

	gdb, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	_ = gdb.AutoMigrate(&models.User{}, &models.Project{}, &models.ProjectRole{}, &models.Dataset{})
	dbpkg.Set(gdb)
	r := SetupRouter()

	owner := tokenFor(t, r, "u@test.local")
	// create project
	body, _ := json.Marshal(map[string]any{"name": "P1"})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+owner)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("create proj %d %s", w.Code, w.Body.String())
	}
	var p models.Project
	_ = json.Unmarshal(w.Body.Bytes(), &p)

	// create dataset
	body, _ = json.Marshal(map[string]any{"name": "DS1"})
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/projects/"+itoa(p.ID)+"/datasets", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+owner)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("create ds %d %s", w.Code, w.Body.String())
	}
	var ds models.Dataset
	_ = json.Unmarshal(w.Body.Bytes(), &ds)

	// upload a tiny file
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, _ := mw.CreateFormFile("file", "sample.csv")
	fw.Write([]byte("a,b\n1,2\n"))
	mw.Close()

	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/projects/"+itoa(p.ID)+"/datasets/"+itoa(ds.ID)+"/upload", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+owner)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("upload %d %s", w.Code, w.Body.String())
	}
}

// Small helper to convert uint to string without importing strconv everywhere
func itoa(v uint) string {
	// minimal fast uint to decimal string
	if v == 0 {
		return "0"
	}
	var b [20]byte
	i := len(b)
	for v > 0 {
		i--
		b[i] = byte('0' + v%10)
		v /= 10
	}
	return string(b[i:])
}
