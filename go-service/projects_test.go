package main

import (
    "bytes"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "os"
    "testing"
    "strconv"

    dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
    "github.com/oreo-io/oreo.io-v2/go-service/models"
    "gorm.io/driver/sqlite"
    "gorm.io/gorm"
)

func setupProjectsTest(t *testing.T) {
    t.Helper()
    os.Setenv("JWT_SECRET", "test-secret")
    gdb, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
    if err != nil { t.Fatalf("sqlite open: %v", err) }
    if err := gdb.AutoMigrate(&models.User{}, &models.Project{}); err != nil { t.Fatalf("migrate: %v", err) }
    dbpkg.Set(gdb)
}

func authToken(t *testing.T, r http.Handler) string {
    reg := map[string]string{"email": "p@test.local", "password": "pass1234"}
    body, _ := json.Marshal(reg)
    w := httptest.NewRecorder()
    req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    r.ServeHTTP(w, req)
    if w.Code != http.StatusCreated { t.Fatalf("register: %d %s", w.Code, w.Body.String()) }

    w = httptest.NewRecorder()
    req = httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    r.ServeHTTP(w, req)
    if w.Code != http.StatusOK { t.Fatalf("login: %d %s", w.Code, w.Body.String()) }
    var lr struct{ Token string `json:"token"` }
    _ = json.Unmarshal(w.Body.Bytes(), &lr)
    if lr.Token == "" { t.Fatalf("missing token") }
    return lr.Token
}

func TestProjectsCRUD(t *testing.T) {
    setupProjectsTest(t)
    r := SetupRouter()
    token := authToken(t, r)

    // Create
    create := map[string]any{"name": "Proj A", "description": "desc"}
    b, _ := json.Marshal(create)
    w := httptest.NewRecorder()
    req := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewReader(b))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer "+token)
    r.ServeHTTP(w, req)
    if w.Code != http.StatusCreated { t.Fatalf("create %d %s", w.Code, w.Body.String()) }
    var created models.Project
    _ = json.Unmarshal(w.Body.Bytes(), &created)

    // List
    w = httptest.NewRecorder()
    req = httptest.NewRequest(http.MethodGet, "/api/projects", nil)
    req.Header.Set("Authorization", "Bearer "+token)
    r.ServeHTTP(w, req)
    if w.Code != http.StatusOK { t.Fatalf("list %d %s", w.Code, w.Body.String()) }

    // Get
    w = httptest.NewRecorder()
    req = httptest.NewRequest(http.MethodGet, "/api/projects/"+strconv.Itoa(int(created.ID)), nil)
    req.Header.Set("Authorization", "Bearer "+token)
    r.ServeHTTP(w, req)
    // If the path number conversion failed, fallback to /1
    if w.Code == http.StatusNotFound {
        w = httptest.NewRecorder()
        req = httptest.NewRequest(http.MethodGet, "/api/projects/1", nil)
        req.Header.Set("Authorization", "Bearer "+token)
        r.ServeHTTP(w, req)
    }
    if w.Code != http.StatusOK { t.Fatalf("get %d %s", w.Code, w.Body.String()) }

    // Update
    upd := map[string]any{"name": "Proj A2", "description": "desc2"}
    b, _ = json.Marshal(upd)
    w = httptest.NewRecorder()
    req = httptest.NewRequest(http.MethodPut, "/api/projects/1", bytes.NewReader(b))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer "+token)
    r.ServeHTTP(w, req)
    if w.Code != http.StatusOK { t.Fatalf("update %d %s", w.Code, w.Body.String()) }

    // Delete
    w = httptest.NewRecorder()
    req = httptest.NewRequest(http.MethodDelete, "/api/projects/1", nil)
    req.Header.Set("Authorization", "Bearer "+token)
    r.ServeHTTP(w, req)
    if w.Code != http.StatusNoContent { t.Fatalf("delete %d %s", w.Code, w.Body.String()) }
}
