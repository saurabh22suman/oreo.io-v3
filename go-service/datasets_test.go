package main

import (
    "bytes"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
    "github.com/oreo-io/oreo.io-v2/go-service/models"
    "gorm.io/driver/sqlite"
    "gorm.io/gorm"
)

func setupDatasetsTest(t *testing.T) (token string, projectID uint) {
    t.Helper()
    gdb, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
    if err != nil { t.Fatalf("sqlite open: %v", err) }
    if err := gdb.AutoMigrate(&models.User{}, &models.Project{}, &models.Dataset{}); err != nil { t.Fatalf("migrate: %v", err) }
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
    if w.Code != http.StatusCreated { t.Fatalf("project create %d %s", w.Code, w.Body.String()) }
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
    if w.Code != http.StatusCreated { t.Fatalf("create ds %d %s", w.Code, w.Body.String()) }
}

// Small helper to convert uint to string without importing strconv everywhere
func itoa(v uint) string {
    // minimal fast uint to decimal string
    if v == 0 { return "0" }
    var b [20]byte
    i := len(b)
    for v > 0 {
        i--
        b[i] = byte('0' + v%10)
        v /= 10
    }
    return string(b[i:])
}
