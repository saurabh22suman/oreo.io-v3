package controllers

import (
    "strconv"
    "io"
    "os"
    "path/filepath"
    "bytes"
    "mime/multipart"
    "net/http"
    "encoding/json"
    "time"
    "strings"

    "github.com/gin-gonic/gin"
    dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
    "github.com/oreo-io/oreo.io-v2/go-service/models"
)

type DatasetIn struct {
    Name   string `json:"name" binding:"required,min=1"`
    Schema string `json:"schema"`
    Rules  string `json:"rules"`
}

// List datasets within a project
func DatasetsList(c *gin.Context) {
    gdb := dbpkg.Get(); if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    pidStr := c.Param("projectId")
    if pidStr == "" { pidStr = c.Param("id") }
    pid, _ := strconv.Atoi(pidStr)
    if !HasProjectRole(c, uint(pid), "owner", "editor", "approver", "viewer") { c.JSON(403, gin.H{"error":"forbidden"}); return }
    var items []models.Dataset
    if err := gdb.Where("project_id = ?", pid).Order("id desc").Find(&items).Error; err != nil { c.JSON(500, gin.H{"error":"db"}); return }
    c.JSON(200, items)
}

func DatasetsCreate(c *gin.Context) {
    gdb := dbpkg.Get(); if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    pidStr := c.Param("projectId"); if pidStr == "" { pidStr = c.Param("id") }
    pid, _ := strconv.Atoi(pidStr)
    if !HasProjectRole(c, uint(pid), "owner", "editor") { c.JSON(403, gin.H{"error":"forbidden"}); return }
    var in DatasetIn
    if err := c.ShouldBindJSON(&in); err != nil { c.JSON(400, gin.H{"error":"invalid_payload"}); return }
    ds := models.Dataset{ProjectID: uint(pid), Name: in.Name, Schema: in.Schema}
    if err := gdb.Create(&ds).Error; err != nil { c.JSON(409, gin.H{"error":"name_conflict"}); return }
    c.JSON(201, ds)
}

func DatasetsGet(c *gin.Context) {
    gdb := dbpkg.Get(); if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    pidStr := c.Param("projectId"); if pidStr == "" { pidStr = c.Param("id") }
    pid, _ := strconv.Atoi(pidStr)
    id, _ := strconv.Atoi(c.Param("datasetId"))
    if !HasProjectRole(c, uint(pid), "owner", "editor", "approver", "viewer") { c.JSON(403, gin.H{"error":"forbidden"}); return }
    var ds models.Dataset
    if err := gdb.Where("project_id = ?", pid).First(&ds, id).Error; err != nil { c.JSON(404, gin.H{"error":"not_found"}); return }
    c.JSON(200, ds)
}

func DatasetsUpdate(c *gin.Context) {
    gdb := dbpkg.Get(); if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    pidStr := c.Param("projectId"); if pidStr == "" { pidStr = c.Param("id") }
    pid, _ := strconv.Atoi(pidStr)
    id, _ := strconv.Atoi(c.Param("datasetId"))
    if !HasProjectRole(c, uint(pid), "owner", "editor") { c.JSON(403, gin.H{"error":"forbidden"}); return }
    var ds models.Dataset
    if err := gdb.Where("project_id = ?", pid).First(&ds, id).Error; err != nil { c.JSON(404, gin.H{"error":"not_found"}); return }
    var in DatasetIn
    if err := c.ShouldBindJSON(&in); err != nil { c.JSON(400, gin.H{"error":"invalid_payload"}); return }
    ds.Name = in.Name
    ds.Schema = in.Schema
    if in.Rules != "" {
        ds.Rules = in.Rules
    }
    if err := gdb.Save(&ds).Error; err != nil { c.JSON(409, gin.H{"error":"name_conflict"}); return }
    c.JSON(200, ds)
}

func DatasetsDelete(c *gin.Context) {
    gdb := dbpkg.Get(); if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    pidStr := c.Param("projectId"); if pidStr == "" { pidStr = c.Param("id") }
    pid, _ := strconv.Atoi(pidStr)
    id, _ := strconv.Atoi(c.Param("datasetId"))
    if !HasProjectRole(c, uint(pid), "owner") { c.JSON(403, gin.H{"error":"forbidden"}); return }
    if err := gdb.Where("project_id = ?", pid).Delete(&models.Dataset{}, id).Error; err != nil { c.JSON(500, gin.H{"error":"db"}); return }
    c.Status(204)
}

// DatasetUpload streams a file to a temp folder for later processing (schema inference/append)
func DatasetUpload(c *gin.Context) {
    gdb := dbpkg.Get(); if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    pidStr := c.Param("projectId"); if pidStr == "" { pidStr = c.Param("id") }
    pid, _ := strconv.Atoi(pidStr)
    dsid, _ := strconv.Atoi(c.Param("datasetId"))
    if !HasProjectRole(c, uint(pid), "owner", "editor") { c.JSON(403, gin.H{"error":"forbidden"}); return }
    // Ensure dataset exists
    var ds models.Dataset
    if err := gdb.Where("project_id = ?", pid).First(&ds, dsid).Error; err != nil { c.JSON(404, gin.H{"error":"not_found"}); return }

    // Accept multipart/form-data file field "file"
    file, header, err := c.Request.FormFile("file")
    if err != nil { c.JSON(400, gin.H{"error":"missing_file"}); return }
    defer file.Close()

    // Save to temp dir (could be replaced by S3, disk, etc.)
    base := os.TempDir()
    _ = os.MkdirAll(filepath.Join(base, "oreo_uploads"), 0o755)
    dstPath := filepath.Join(base, "oreo_uploads", filepath.Base(header.Filename))
    dst, err := os.Create(dstPath)
    if err != nil { c.JSON(500, gin.H{"error":"store"}); return }
    defer dst.Close()
    if _, err := io.Copy(dst, file); err != nil { c.JSON(500, gin.H{"error":"write"}); return }

    // Record last upload info
    now := time.Now()
    ds.LastUploadPath = dstPath
    ds.LastUploadAt = &now
    _ = gdb.Save(&ds).Error

    // Call Python /infer-schema with the stored file
    pyBase := os.Getenv("PYTHON_SERVICE_URL")
    if pyBase == "" { pyBase = "http://python-service:8000" }
    var buf bytes.Buffer
    mw := multipart.NewWriter(&buf)
    fw, _ := mw.CreateFormFile("file", filepath.Base(dstPath))
    f, _ := os.Open(dstPath)
    io.Copy(fw, f)
    f.Close()
    mw.Close()

    req, _ := http.NewRequest(http.MethodPost, pyBase+"/infer-schema", &buf)
    req.Header.Set("Content-Type", mw.FormDataContentType())
    resp, err := http.DefaultClient.Do(req)
    if err == nil && resp != nil {
        defer resp.Body.Close()
        var result struct{ Schema any `json:"schema"` }
        b, _ := io.ReadAll(resp.Body)
        _ = json.Unmarshal(b, &result)
        if result.Schema != nil {
            // Persist only the schema portion
            if schemaBytes, err := json.Marshal(result.Schema); err == nil {
                ds.Schema = string(schemaBytes)
            }
            _ = gdb.Save(&ds).Error
        }
    }

    c.JSON(201, gin.H{"stored": true, "path": dstPath, "dataset_id": ds.ID})
}

// DatasetSample returns a small preview (first N rows) of the last uploaded file as JSON rows
func DatasetSample(c *gin.Context) {
    gdb := dbpkg.Get(); if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    pidStr := c.Param("projectId"); if pidStr == "" { pidStr = c.Param("id") }
    pid, _ := strconv.Atoi(pidStr)
    dsid, _ := strconv.Atoi(c.Param("datasetId"))
    if !HasProjectRole(c, uint(pid), "owner", "editor", "approver", "viewer") { c.JSON(403, gin.H{"error":"forbidden"}); return }
    var ds models.Dataset
    if err := gdb.Where("project_id = ?", pid).First(&ds, dsid).Error; err != nil { c.JSON(404, gin.H{"error":"not_found"}); return }
    if ds.LastUploadPath == "" { c.JSON(404, gin.H{"error":"no_upload"}); return }

    // Forward file to python /sample (new lightweight endpoint) if available; else simple csv head
    pyBase := os.Getenv("PYTHON_SERVICE_URL"); if pyBase == "" { pyBase = "http://python-service:8000" }
    // Try python reading for robustness
    var buf bytes.Buffer
    mw := multipart.NewWriter(&buf)
    fw, _ := mw.CreateFormFile("file", filepath.Base(ds.LastUploadPath))
    f, err := os.Open(ds.LastUploadPath); if err != nil { c.JSON(500, gin.H{"error":"open"}); return }
    io.Copy(fw, f); f.Close(); mw.Close()
    req, _ := http.NewRequest(http.MethodPost, pyBase+"/sample", &buf)
    req.Header.Set("Content-Type", mw.FormDataContentType())
    resp, err := http.DefaultClient.Do(req)
    if err != nil || resp == nil { c.JSON(502, gin.H{"error":"python_unreachable"}); return }
    defer resp.Body.Close()
    b, _ := io.ReadAll(resp.Body)
    c.Data(resp.StatusCode, "application/json", b)
}

// AppendUpload handles new data append: stores file, runs validations, and opens a change request
func AppendUpload(c *gin.Context) {
    gdb := dbpkg.Get(); if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    pidStr := c.Param("projectId"); if pidStr == "" { pidStr = c.Param("id") }
    pid, _ := strconv.Atoi(pidStr)
    dsid, _ := strconv.Atoi(c.Param("datasetId"))
    if !HasProjectRole(c, uint(pid), "owner", "editor") { c.JSON(403, gin.H{"error":"forbidden"}); return }

    var ds models.Dataset
    if err := gdb.Where("project_id = ?", pid).First(&ds, dsid).Error; err != nil { c.JSON(404, gin.H{"error":"not_found"}); return }

    file, header, err := c.Request.FormFile("file"); if err != nil { c.JSON(400, gin.H{"error":"missing_file"}); return }
    defer file.Close()
    base := os.TempDir(); _ = os.MkdirAll(filepath.Join(base, "oreo_appends"), 0o755)
    dstPath := filepath.Join(base, "oreo_appends", filepath.Base(header.Filename))
    dst, err := os.Create(dstPath); if err != nil { c.JSON(500, gin.H{"error":"store"}); return }
    defer dst.Close(); if _, err := io.Copy(dst, file); err != nil { c.JSON(500, gin.H{"error":"write"}); return }

    // Prepare payload for python validate-rules endpoint
    pyBase := os.Getenv("PYTHON_SERVICE_URL"); if pyBase == "" { pyBase = "http://python-service:8000" }

    // 1) Schema validation: if ds.Schema exists, validate sample of rows
    var schemaObj any
    if strings.TrimSpace(ds.Schema) != "" {
        _ = json.Unmarshal([]byte(ds.Schema), &schemaObj)
    }

    // build multipart with file to get sample rows in python (shared logic)
    var smBuf bytes.Buffer
    smw := multipart.NewWriter(&smBuf)
    sff, _ := smw.CreateFormFile("file", filepath.Base(dstPath))
    f, _ := os.Open(dstPath); io.Copy(sff, f); f.Close(); smw.Close()
    sreq, _ := http.NewRequest(http.MethodPost, pyBase+"/sample", &smBuf)
    sreq.Header.Set("Content-Type", smw.FormDataContentType())
    sresp, sErr := http.DefaultClient.Do(sreq)
    if sErr != nil || sresp == nil { c.JSON(502, gin.H{"error":"python_unreachable"}); return }
    defer sresp.Body.Close()
    var sampleResp struct{ Data []map[string]any `json:"data"` }
    sb, _ := io.ReadAll(sresp.Body); _ = json.Unmarshal(sb, &sampleResp)

    // schema validate via python /validate
    var schemaErrors any
    if schemaObj != nil {
        body, _ := json.Marshal(gin.H{"json_schema": schemaObj, "data": sampleResp.Data})
        vreq, _ := http.NewRequest(http.MethodPost, pyBase+"/validate", bytes.NewReader(body))
        vreq.Header.Set("Content-Type", "application/json")
        vresp, vErr := http.DefaultClient.Do(vreq)
        if vErr == nil && vresp != nil { defer vresp.Body.Close(); vb, _ := io.ReadAll(vresp.Body); var vr any; _ = json.Unmarshal(vb, &vr); schemaErrors = vr }
    }

    // 2) Rules validation (via python /rules/validate)
    var rulesObj any
    if strings.TrimSpace(ds.Rules) != "" { _ = json.Unmarshal([]byte(ds.Rules), &rulesObj) }
    var rulesErrors any
    if rulesObj != nil {
        body, _ := json.Marshal(gin.H{"rules": rulesObj, "data": sampleResp.Data})
        rreq, _ := http.NewRequest(http.MethodPost, pyBase+"/rules/validate", bytes.NewReader(body))
        rreq.Header.Set("Content-Type", "application/json")
        rresp, rErr := http.DefaultClient.Do(rreq)
        if rErr == nil && rresp != nil { defer rresp.Body.Close(); rb, _ := io.ReadAll(rresp.Body); var rr any; _ = json.Unmarshal(rb, &rr); rulesErrors = rr }
    }

    // If any errors, return them to allow live fixes pre-submit
    ok := (schemaErrors == nil || getBool(schemaErrors, "valid", true)) && (rulesErrors == nil || getBool(rulesErrors, "valid", true))
    if !ok {
        c.JSON(200, gin.H{"ok": false, "schema": schemaErrors, "rules": rulesErrors})
        return
    }

    // Create change request (pending)
    cr := models.ChangeRequest{ ProjectID: uint(pid), DatasetID: ds.ID, Type: "append", Status: "pending", Title: "Append data", Payload: dstPath }
    if uid, exists := c.Get("user_id"); exists { if u, ok := uid.(uint); ok { cr.UserID = u } }
    if err := gdb.Create(&cr).Error; err != nil { c.JSON(500, gin.H{"error":"db"}); return }
    c.JSON(201, gin.H{"ok": true, "change_request": cr})
}

func getBool(v any, key string, def bool) bool {
    m, ok := v.(map[string]any); if !ok { return def }
    if b, ok := m[key].(bool); ok { return b }
    return def
}
