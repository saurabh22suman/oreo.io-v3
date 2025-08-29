package controllers

import (
	"bytes"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
	"github.com/oreo-io/oreo.io-v2/go-service/models"
	"gorm.io/gorm"
)

const maxUploadBytes = 100 * 1024 * 1024 // 100 MB

func respondTooLarge(c *gin.Context) {
	c.JSON(http.StatusRequestEntityTooLarge, gin.H{
		"error":    "file_too_large",
		"message":  "File too large. Max allowed size is 100 MB.",
		"limit_mb": 100,
	})
}

type DatasetIn struct {
	Name   string `json:"name" binding:"required,min=1"`
	Schema string `json:"schema"`
	Rules  string `json:"rules"`
	Source string `json:"source"`
	Target struct {
		Type string `json:"type"`
		DSN  string `json:"dsn"`
	} `json:"target"`
}

// --- DB storage helpers ---
func dsMainTable(id uint) string            { return fmt.Sprintf("ds_%d", id) }
func dsStagingTable(dsID, crID uint) string { return fmt.Sprintf("ds_%d_stg_%d", dsID, crID) }

func dialect(gdb *gorm.DB) string {
	if gdb == nil {
		return ""
	}
	return gdb.Dialector.Name()
}

// ensureMainTable creates the main table to store JSON rows
func ensureMainTable(gdb *gorm.DB, dsID uint) error {
	name := dsMainTable(dsID)
	if dialect(gdb) == "postgres" {
		return gdb.Exec(fmt.Sprintf("CREATE TABLE IF NOT EXISTS %s (id BIGSERIAL PRIMARY KEY, data JSONB NOT NULL)", name)).Error
	}
	// sqlite or others
	return gdb.Exec(fmt.Sprintf("CREATE TABLE IF NOT EXISTS %s (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL)", name)).Error
}

func ensureStagingTable(gdb *gorm.DB, dsID, crID uint) error {
	name := dsStagingTable(dsID, crID)
	if dialect(gdb) == "postgres" {
		return gdb.Exec(fmt.Sprintf("CREATE TABLE IF NOT EXISTS %s (id BIGSERIAL PRIMARY KEY, data JSONB NOT NULL)", name)).Error
	}
	return gdb.Exec(fmt.Sprintf("CREATE TABLE IF NOT EXISTS %s (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL)", name)).Error
}

func tableExists(gdb *gorm.DB, name string) bool {
	if dialect(gdb) == "postgres" {
		var exists bool
		row := gdb.Raw("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = ?)", name).Row()
		_ = row.Scan(&exists)
		return exists
	}
	// sqlite
	var cnt int
	row := gdb.Raw("SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name=?", name).Row()
	_ = row.Scan(&cnt)
	return cnt > 0
}

// upsertDatasetMeta updates or creates sys.metadata for a dataset based on current main table
func upsertDatasetMeta(gdb *gorm.DB, ds *models.Dataset) {
	if gdb == nil || ds == nil {
		return
	}
	// Count rows
	var rows int64
	if tableExists(gdb, dsMainTable(ds.ID)) {
		_ = gdb.Raw(fmt.Sprintf("SELECT COUNT(*) FROM %s", dsMainTable(ds.ID))).Row().Scan(&rows)
	}
	// Sample one row to infer columns count
	cols := 0
	if rows > 0 {
		if r1, err := gdb.Raw(fmt.Sprintf("SELECT data FROM %s LIMIT 1", dsMainTable(ds.ID))).Rows(); err == nil {
			defer r1.Close()
			if r1.Next() {
				var raw any
				_ = r1.Scan(&raw)
				var obj map[string]any
				switch v := raw.(type) {
				case []byte:
					_ = json.Unmarshal(v, &obj)
				case string:
					_ = json.Unmarshal([]byte(v), &obj)
				default:
					b, _ := json.Marshal(v)
					_ = json.Unmarshal(b, &obj)
				}
				cols = len(obj)
			}
		}
	}
	// Resolve owner name
	ownerName := ""
	var proj models.Project
	if err := gdb.First(&proj, ds.ProjectID).Error; err == nil {
		var user models.User
		if err2 := gdb.First(&user, proj.OwnerID).Error; err2 == nil {
			ownerName = user.Email
		}
	}
	now := time.Now()
	// Compose table location string as <project_name>.upload.<dataset_name>
	// Fallback to ds_<id> if names are unavailable.
	projName := fmt.Sprintf("p_%d", ds.ProjectID)
	if err := gdb.First(&proj, ds.ProjectID).Error; err == nil && strings.TrimSpace(proj.Name) != "" {
		projName = proj.Name
	}
	tableLoc := fmt.Sprintf("%s.upload.%s", projName, ds.Name)
	var meta models.DatasetMeta
	if err := gdb.Where("dataset_id = ?", ds.ID).First(&meta).Error; err != nil {
		meta = models.DatasetMeta{ProjectID: ds.ProjectID, DatasetID: ds.ID, OwnerName: ownerName, RowCount: rows, ColumnCount: cols, LastUpdateAt: now, TableLocation: tableLoc}
		_ = gdb.Create(&meta).Error
	} else {
		meta.OwnerName = ownerName
		meta.RowCount = rows
		meta.ColumnCount = cols
		meta.LastUpdateAt = now
		meta.TableLocation = tableLoc
		_ = gdb.Save(&meta).Error
	}
}

func ingestCSVToTable(gdb *gorm.DB, filePath, table string) error {
	f, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer f.Close()
	r := csv.NewReader(f)
	headers, err := r.Read()
	if err != nil {
		return err
	}
	for {
		rec, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		row := map[string]any{}
		for i := 0; i < len(headers) && i < len(rec); i++ {
			row[headers[i]] = rec[i]
		}
		jb, _ := json.Marshal(row)
		if dialect(gdb) == "postgres" {
			if ex := gdb.Exec(fmt.Sprintf("INSERT INTO %s (data) VALUES (?::jsonb)", table), string(jb)); ex.Error != nil {
				return ex.Error
			}
		} else {
			if ex := gdb.Exec(fmt.Sprintf("INSERT INTO %s (data) VALUES (?)", table), string(jb)); ex.Error != nil {
				return ex.Error
			}
		}
	}
	return nil
}

func ingestJSONToTable(gdb *gorm.DB, filePath, table string) error {
	b, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}
	var arr []map[string]any
	if err := json.Unmarshal(b, &arr); err != nil {
		return err
	}
	for _, obj := range arr {
		jb, _ := json.Marshal(obj)
		if dialect(gdb) == "postgres" {
			if ex := gdb.Exec(fmt.Sprintf("INSERT INTO %s (data) VALUES (?::jsonb)", table), string(jb)); ex.Error != nil {
				return ex.Error
			}
		} else {
			if ex := gdb.Exec(fmt.Sprintf("INSERT INTO %s (data) VALUES (?)", table), string(jb)); ex.Error != nil {
				return ex.Error
			}
		}
	}
	return nil
}

func ingestBytesToTable(gdb *gorm.DB, content []byte, filename, table string) error {
	ext := strings.ToLower(filepath.Ext(filename))
	tmp := filepath.Join(os.TempDir(), fmt.Sprintf("ing_%d%s", time.Now().UnixNano(), ext))
	if err := os.WriteFile(tmp, content, 0o644); err != nil {
		return err
	}
	defer os.Remove(tmp)
	switch ext {
	case ".json":
		return ingestJSONToTable(gdb, tmp, table)
	case ".csv":
		return ingestCSVToTable(gdb, tmp, table)
	default:
		return fmt.Errorf("unsupported_format")
	}
}

// List datasets within a project
func DatasetsList(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pidStr := c.Param("projectId")
	if pidStr == "" {
		pidStr = c.Param("id")
	}
	pid, _ := strconv.Atoi(pidStr)
	if !HasProjectRole(c, uint(pid), "owner", "contributor", "viewer") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	var items []models.Dataset
	if err := gdb.Where("project_id = ?", pid).Order("id desc").Find(&items).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	c.JSON(200, items)
}

func DatasetsCreate(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pidStr := c.Param("projectId")
	if pidStr == "" {
		pidStr = c.Param("id")
	}
	pid, _ := strconv.Atoi(pidStr)
	if !HasProjectRole(c, uint(pid), "owner", "contributor") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	var in DatasetIn
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(400, gin.H{"error": "invalid_payload"})
		return
	}
	ds := models.Dataset{ProjectID: uint(pid), Name: in.Name, Schema: in.Schema}
	if err := gdb.Create(&ds).Error; err != nil {
		c.JSON(409, gin.H{"error": "name_conflict"})
		return
	}
	c.JSON(201, ds)
}

// ---- Top-level dataset endpoints ----

// Create dataset given project_id in body
func DatasetsCreateTop(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	var body struct {
		ProjectID uint   `json:"project_id" binding:"required"`
		Name      string `json:"name" binding:"required"`
		Source    string `json:"source"`
		Target    struct {
			Type string `json:"type"`
			DSN  string `json:"dsn"`
		} `json:"target"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(400, gin.H{"error": "invalid_payload"})
		return
	}
	if !HasProjectRole(c, body.ProjectID, "owner", "contributor") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	ds := models.Dataset{ProjectID: body.ProjectID, Name: body.Name, Source: body.Source, TargetType: body.Target.Type, TargetDSN: body.Target.DSN}
	if err := gdb.Create(&ds).Error; err != nil {
		c.JSON(409, gin.H{"error": "name_conflict"})
		return
	}
	c.JSON(201, ds)
}

// Helper to load dataset and check project-scoped permission
func datasetWithAccess(c *gin.Context, id uint, roles ...string) (*models.Dataset, bool) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			return nil, false
		}
		gdb = dbpkg.Get()
	}
	var ds models.Dataset
	if err := gdb.First(&ds, id).Error; err != nil {
		return nil, false
	}
	if !HasProjectRole(c, ds.ProjectID, roles...) {
		return nil, false
	}
	return &ds, true
}

func DatasetSchemaGet(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	ds, ok := datasetWithAccess(c, uint(id), "owner", "contributor", "viewer")
	if !ok {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	c.JSON(200, gin.H{"schema": ds.Schema})
}
func DatasetSchemaSet(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	id, _ := strconv.Atoi(c.Param("id"))
	ds, ok := datasetWithAccess(c, uint(id), "owner", "contributor")
	if !ok {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	var body struct {
		Schema string `json:"schema"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(400, gin.H{"error": "invalid_payload"})
		return
	}
	ds.Schema = body.Schema
	if err := gdb.Save(ds).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}
func DatasetRulesSet(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	id, _ := strconv.Atoi(c.Param("id"))
	ds, ok := datasetWithAccess(c, uint(id), "owner", "contributor")
	if !ok {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	var body struct {
		Rules string `json:"rules"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(400, gin.H{"error": "invalid_payload"})
		return
	}
	ds.Rules = body.Rules
	if err := gdb.Save(ds).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}
func DatasetAppendTop(c *gin.Context) {
	// Reuse AppendUpload by mapping to project route context
	c.Params = append(c.Params, gin.Param{Key: "id", Value: ""}, gin.Param{Key: "datasetId", Value: c.Param("id")})
	// To set project id, we need to look up dataset
	id, _ := strconv.Atoi(c.Param("id"))
	ds, ok := datasetWithAccess(c, uint(id), "owner", "contributor")
	if !ok {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	// inject project id
	c.Params = replaceParam(c.Params, "id", strconv.Itoa(int(ds.ProjectID)))
	AppendUpload(c)
}
func replaceParam(params gin.Params, key, val string) gin.Params {
	for i := range params {
		if params[i].Key == key {
			params[i].Value = val
			return params
		}
	}
	return append(params, gin.Param{Key: key, Value: val})
}
func DatasetDataGet(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	ds, ok := datasetWithAccess(c, uint(id), "owner", "contributor", "viewer")
	if !ok {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err == nil {
			gdb = dbpkg.Get()
		}
	}
	if gdb != nil && tableExists(gdb, dsMainTable(ds.ID)) {
		nStr := c.Query("limit")
		if nStr == "" {
			nStr = "50"
		}
		offStr := c.Query("offset")
		if offStr == "" {
			offStr = "0"
		}
		n, _ := strconv.Atoi(nStr)
		off, _ := strconv.Atoi(offStr)
		rows, err := gdb.Raw(fmt.Sprintf("SELECT data FROM %s LIMIT ? OFFSET ?", dsMainTable(ds.ID)), n, off).Rows()
		if err == nil {
			defer rows.Close()
			out := struct {
				Data    []map[string]any `json:"data"`
				Columns []string         `json:"columns"`
			}{Data: []map[string]any{}, Columns: []string{}}
			colsSet := map[string]struct{}{}
			for rows.Next() {
				var raw any
				if err := rows.Scan(&raw); err == nil {
					var obj map[string]any
					switch v := raw.(type) {
					case []byte:
						_ = json.Unmarshal(v, &obj)
					case string:
						_ = json.Unmarshal([]byte(v), &obj)
					default:
						b, _ := json.Marshal(v)
						_ = json.Unmarshal(b, &obj)
					}
					if obj != nil {
						out.Data = append(out.Data, obj)
						for k := range obj {
							colsSet[k] = struct{}{}
						}
					}
				}
			}
			for k := range colsSet {
				out.Columns = append(out.Columns, k)
			}
			c.JSON(200, out)
			return
		}
	}
	if ds.LastUploadPath == "" {
		c.JSON(200, gin.H{"data": []any{}, "rows": 0, "total_rows": 0, "columns": []string{}})
		return
	}
	nStr := c.Query("limit")
	if nStr == "" {
		nStr = "50"
	}
	offStr := c.Query("offset")
	if offStr == "" {
		offStr = "0"
	}
	n, _ := strconv.Atoi(nStr)
	off, _ := strconv.Atoi(offStr)
	pyBase := os.Getenv("PYTHON_SERVICE_URL")
	if pyBase == "" {
		pyBase = "http://python-service:8000"
	}
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, _ := mw.CreateFormFile("file", filepath.Base(ds.LastUploadPath))
	f, err := os.Open(ds.LastUploadPath)
	if err != nil {
		c.JSON(404, gin.H{"error": "file_missing"})
		return
	}
	io.Copy(fw, f)
	f.Close()
	mw.Close()
	req, _ := http.NewRequest(http.MethodPost, pyBase+"/sample?n="+strconv.Itoa(n)+"&offset="+strconv.Itoa(off), &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	resp, err := http.DefaultClient.Do(req)
	if err != nil || resp == nil {
		c.JSON(502, gin.H{"error": "python_unreachable"})
		return
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", b)
}
func DatasetStats(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	id, _ := strconv.Atoi(c.Param("id"))
	ds, ok := datasetWithAccess(c, uint(id), "owner", "contributor", "viewer")
	if !ok {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	var meta models.DatasetMeta
	_ = gdb.Where("dataset_id = ?", ds.ID).First(&meta).Error
	stats := gin.H{
		"last_upload_at": ds.LastUploadAt,
		"owner_name":     meta.OwnerName,
		"row_count":      meta.RowCount,
		"column_count":   meta.ColumnCount,
		"last_update_at": meta.LastUpdateAt,
		"table_location": meta.TableLocation,
	}
	if stats["row_count"] == nil || stats["row_count"] == int64(0) {
		if tableExists(gdb, dsMainTable(ds.ID)) {
			var total int64
			_ = gdb.Raw(fmt.Sprintf("SELECT COUNT(*) FROM %s", dsMainTable(ds.ID))).Row().Scan(&total)
			stats["row_count"] = total
		}
	}
	var pending int64
	_ = gdb.Model(&models.ChangeRequest{}).Where("dataset_id = ? AND status = ?", ds.ID, "pending").Count(&pending)
	stats["pending_approvals"] = pending
	c.JSON(200, stats)
}

// DatasetQuery executes a simple query over the dataset table.
// Body: { where?: object (JSON contains filter), limit?: number, offset?: number }
func DatasetQuery(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	id, _ := strconv.Atoi(c.Param("id"))
	ds, ok := datasetWithAccess(c, uint(id), "owner", "contributor", "viewer")
	if !ok {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	if !tableExists(gdb, dsMainTable(ds.ID)) {
		c.JSON(404, gin.H{"error": "no_data"})
		return
	}
	var body struct {
		Where  map[string]any `json:"where"`
		Limit  int            `json:"limit"`
		Offset int            `json:"offset"`
	}
	_ = c.ShouldBindJSON(&body)
	if body.Limit <= 0 || body.Limit > 1000 {
		body.Limit = 100
	}
	if body.Offset < 0 {
		body.Offset = 0
	}
	// Build simple JSON contains filter when provided
	var rows *sql.Rows
	var err error
	if len(body.Where) > 0 {
		jb, _ := json.Marshal(body.Where)
		if dialect(gdb) == "postgres" {
			rows, err = gdb.Raw(fmt.Sprintf("SELECT data FROM %s WHERE data @> ?::jsonb LIMIT ? OFFSET ?", dsMainTable(ds.ID)), string(jb), body.Limit, body.Offset).Rows()
		} else {
			// naive filter for sqlite: match as substring
			rows, err = gdb.Raw(fmt.Sprintf("SELECT data FROM %s WHERE data LIKE ? LIMIT ? OFFSET ?", dsMainTable(ds.ID)), "%"+string(jb)+"%", body.Limit, body.Offset).Rows()
		}
	} else {
		rows, err = gdb.Raw(fmt.Sprintf("SELECT data FROM %s LIMIT ? OFFSET ?", dsMainTable(ds.ID)), body.Limit, body.Offset).Rows()
	}
	if err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	defer rows.Close()
	out := struct {
		Data    []map[string]any `json:"data"`
		Columns []string         `json:"columns"`
	}{Data: []map[string]any{}, Columns: []string{}}
	colsSet := map[string]struct{}{}
	for rows.Next() {
		var raw any
		if err := rows.Scan(&raw); err == nil {
			var obj map[string]any
			switch v := raw.(type) {
			case []byte:
				_ = json.Unmarshal(v, &obj)
			case string:
				_ = json.Unmarshal([]byte(v), &obj)
			default:
				b, _ := json.Marshal(v)
				_ = json.Unmarshal(b, &obj)
			}
			if obj != nil {
				out.Data = append(out.Data, obj)
				for k := range obj {
					colsSet[k] = struct{}{}
				}
			}
		}
	}
	for k := range colsSet {
		out.Columns = append(out.Columns, k)
	}
	c.JSON(200, out)
}

func DatasetsGet(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pidStr := c.Param("projectId")
	if pidStr == "" {
		pidStr = c.Param("id")
	}
	pid, _ := strconv.Atoi(pidStr)
	id, _ := strconv.Atoi(c.Param("datasetId"))
	if !HasProjectRole(c, uint(pid), "owner", "contributor", "viewer") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	var ds models.Dataset
	if err := gdb.Where("project_id = ?", pid).First(&ds, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}
	c.JSON(200, ds)
}

func DatasetsUpdate(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pidStr := c.Param("projectId")
	if pidStr == "" {
		pidStr = c.Param("id")
	}
	pid, _ := strconv.Atoi(pidStr)
	id, _ := strconv.Atoi(c.Param("datasetId"))
	if !HasProjectRole(c, uint(pid), "owner", "contributor") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	var ds models.Dataset
	if err := gdb.Where("project_id = ?", pid).First(&ds, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}
	var in DatasetIn
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(400, gin.H{"error": "invalid_payload"})
		return
	}
	ds.Name = in.Name
	ds.Schema = in.Schema
	if in.Rules != "" {
		ds.Rules = in.Rules
	}
	if err := gdb.Save(&ds).Error; err != nil {
		c.JSON(409, gin.H{"error": "name_conflict"})
		return
	}
	c.JSON(200, ds)
}

func DatasetsDelete(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pidStr := c.Param("projectId")
	if pidStr == "" {
		pidStr = c.Param("id")
	}
	pid, _ := strconv.Atoi(pidStr)
	id, _ := strconv.Atoi(c.Param("datasetId"))
	if !HasProjectRole(c, uint(pid), "owner") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	if err := gdb.Where("project_id = ?", pid).Delete(&models.Dataset{}, id).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	c.Status(204)
}

// DatasetUpload streams a file to a temp folder for later processing (schema inference/append)
func DatasetUpload(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pidStr := c.Param("projectId")
	if pidStr == "" {
		pidStr = c.Param("id")
	}
	pid, _ := strconv.Atoi(pidStr)
	dsid, _ := strconv.Atoi(c.Param("datasetId"))
	// Only owner can perform direct uploads to a dataset
	if !HasProjectRole(c, uint(pid), "owner") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	// Ensure dataset exists
	var ds models.Dataset
	if err := gdb.Where("project_id = ?", pid).First(&ds, dsid).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}

	// Accept multipart/form-data file field "file"
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(400, gin.H{"error": "missing_file"})
		return
	}
	defer file.Close()

	// Enforce size limit using header size if provided
	if header != nil && header.Size > maxUploadBytes {
		respondTooLarge(c)
		return
	}

	// Save to temp dir (could be replaced by S3, disk, etc.)
	base := os.TempDir()
	dir := filepath.Join(base, "oreo_uploads")
	_ = os.MkdirAll(dir, 0o755)
	uniqueName := fmt.Sprintf("ds_%d_%d_%s", ds.ID, time.Now().UnixNano(), filepath.Base(header.Filename))
	dstPath := filepath.Join(dir, uniqueName)
	dst, err := os.Create(dstPath)
	if err != nil {
		c.JSON(500, gin.H{"error": "store"})
		return
	}
	defer dst.Close()
	// Guard actual bytes copied against limit
	var limited int64 = 0
	chunkBuf := make([]byte, 32*1024)
	for {
		n, rerr := file.Read(chunkBuf)
		if n > 0 {
			limited += int64(n)
			if limited > maxUploadBytes {
				_ = dst.Close()
				_ = os.Remove(dstPath)
				respondTooLarge(c)
				return
			}
			if _, werr := dst.Write(chunkBuf[:n]); werr != nil {
				c.JSON(500, gin.H{"error": "write"})
				return
			}
		}
		if rerr == io.EOF {
			break
		}
		if rerr != nil {
			c.JSON(500, gin.H{"error": "write"})
			return
		}
	}

	// Record last upload info
	now := time.Now()
	ds.LastUploadPath = dstPath
	ds.LastUploadAt = &now
	_ = gdb.Save(&ds).Error

	// Ingest into main table (overwrite contents)
	_ = ensureMainTable(gdb, ds.ID)
	_ = gdb.Exec(fmt.Sprintf("DELETE FROM %s", dsMainTable(ds.ID))).Error
	ext := strings.ToLower(filepath.Ext(header.Filename))
	switch ext {
	case ".csv":
		_ = ingestCSVToTable(gdb, dstPath, dsMainTable(ds.ID))
	case ".json":
		_ = ingestJSONToTable(gdb, dstPath, dsMainTable(ds.ID))
	}

	// Update metadata
	upsertDatasetMeta(gdb, &ds)

	// Call Python /infer-schema with the stored file
	pyBase := os.Getenv("PYTHON_SERVICE_URL")
	if pyBase == "" {
		pyBase = "http://python-service:8000"
	}
	var mpBuf bytes.Buffer
	mw := multipart.NewWriter(&mpBuf)
	fw, _ := mw.CreateFormFile("file", filepath.Base(dstPath))
	f, _ := os.Open(dstPath)
	io.Copy(fw, f)
	f.Close()
	mw.Close()

	req, _ := http.NewRequest(http.MethodPost, pyBase+"/infer-schema", &mpBuf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	resp, err := http.DefaultClient.Do(req)
	if err == nil && resp != nil {
		defer resp.Body.Close()
		var result struct {
			Schema any `json:"schema"`
		}
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
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pidStr := c.Param("projectId")
	if pidStr == "" {
		pidStr = c.Param("id")
	}
	pid, _ := strconv.Atoi(pidStr)
	dsid, _ := strconv.Atoi(c.Param("datasetId"))
	if !HasProjectRole(c, uint(pid), "owner", "contributor", "approver", "viewer") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	var ds models.Dataset
	if err := gdb.Where("project_id = ?", pid).First(&ds, dsid).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}
	// If DB table exists, return sample from it
	if tableExists(gdb, dsMainTable(ds.ID)) {
		nStr := c.DefaultQuery("n", "50")
		n, _ := strconv.Atoi(nStr)
		if n <= 0 {
			n = 50
		}
		rows, err := gdb.Raw(fmt.Sprintf("SELECT data FROM %s LIMIT ?", dsMainTable(ds.ID)), n).Rows()
		if err == nil {
			defer rows.Close()
			out := struct {
				Data    []map[string]any `json:"data"`
				Columns []string         `json:"columns"`
			}{Data: []map[string]any{}, Columns: []string{}}
			colsSet := map[string]struct{}{}
			for rows.Next() {
				var raw any
				if err := rows.Scan(&raw); err == nil {
					var obj map[string]any
					switch v := raw.(type) {
					case []byte:
						_ = json.Unmarshal(v, &obj)
					case string:
						_ = json.Unmarshal([]byte(v), &obj)
					default:
						b, _ := json.Marshal(v)
						_ = json.Unmarshal(b, &obj)
					}
					if obj != nil {
						out.Data = append(out.Data, obj)
						for k := range obj {
							colsSet[k] = struct{}{}
						}
					}
				}
			}
			for k := range colsSet {
				out.Columns = append(out.Columns, k)
			}
			c.JSON(200, out)
			return
		}
	}
	if ds.LastUploadPath == "" {
		c.JSON(404, gin.H{"error": "no_upload"})
		return
	}

	// Forward file to python /sample (new lightweight endpoint) if available; else simple csv head
	pyBase := os.Getenv("PYTHON_SERVICE_URL")
	if pyBase == "" {
		pyBase = "http://python-service:8000"
	}
	// Try python reading for robustness
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, _ := mw.CreateFormFile("file", filepath.Base(ds.LastUploadPath))
	f, err := os.Open(ds.LastUploadPath)
	if err != nil {
		// File on disk is missing or unreadable. Provide a readable error for the UI.
		c.JSON(404, gin.H{"error": "file_missing", "message": "The last uploaded file cannot be accessed. It may have been moved or deleted. Please re-upload the data file."})
		return
	}
	io.Copy(fw, f)
	f.Close()
	mw.Close()
	req, _ := http.NewRequest(http.MethodPost, pyBase+"/sample", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	resp, err := http.DefaultClient.Do(req)
	if err != nil || resp == nil {
		c.JSON(502, gin.H{"error": "python_unreachable", "message": "The data processing service is temporarily unavailable. Please try again in a moment."})
		return
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", b)
}

// AppendUpload handles new data append: stores file, runs validations, and opens a change request
func AppendUpload(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pidStr := c.Param("projectId")
	if pidStr == "" {
		pidStr = c.Param("id")
	}
	pid, _ := strconv.Atoi(pidStr)
	dsid, _ := strconv.Atoi(c.Param("datasetId"))
	if !HasProjectRole(c, uint(pid), "owner", "contributor") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}

	var ds models.Dataset
	if err := gdb.Where("project_id = ?", pid).First(&ds, dsid).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(400, gin.H{"error": "missing_file"})
		return
	}
	// Reviewer selection (required): form field reviewer_id
	var reviewerID uint
	if rv := c.PostForm("reviewer_id"); strings.TrimSpace(rv) != "" {
		if n, convErr := strconv.Atoi(rv); convErr == nil && n > 0 {
			reviewerID = uint(n)
		}
	}
	if reviewerID == 0 {
		c.JSON(400, gin.H{"error": "reviewer_required"})
		return
	}
	// Reviewer must be a project member with role 'approver'
	var pr models.ProjectRole
	if err := gdb.Where("project_id = ? AND user_id = ?", pid, reviewerID).First(&pr).Error; err != nil {
		c.JSON(400, gin.H{"error": "reviewer_not_member"})
		return
	}
	if normalizeRole(pr.Role) != "approver" {
		c.JSON(400, gin.H{"error": "reviewer_not_approver"})
		return
	}
	defer file.Close()
	if header != nil && header.Size > maxUploadBytes {
		respondTooLarge(c)
		return
	}
	// Read file into memory (small/medium files). For large files, stream to object store in future.
	var fileBuf bytes.Buffer
	if _, err := io.CopyN(&fileBuf, file, int64(maxUploadBytes)+1); err != nil && err != io.EOF {
		c.JSON(500, gin.H{"error": "read_file"})
		return
	}
	if fileBuf.Len() > maxUploadBytes {
		respondTooLarge(c)
		return
	}
	// Persist upload into DB as bytea/blob for audit and preview.
	up := models.DatasetUpload{ProjectID: uint(pid), DatasetID: ds.ID, Filename: header.Filename, Content: fileBuf.Bytes()}
	if err := gdb.Create(&up).Error; err != nil {
		c.JSON(500, gin.H{"error": "db_store_upload"})
		return
	}

	// Prepare payload for python validate-rules endpoint
	pyBase := os.Getenv("PYTHON_SERVICE_URL")
	if pyBase == "" {
		pyBase = "http://python-service:8000"
	}

	// 1) Schema validation: if ds.Schema exists, validate sample of rows
	var schemaObj any
	if strings.TrimSpace(ds.Schema) != "" {
		_ = json.Unmarshal([]byte(ds.Schema), &schemaObj)
	}

	// build multipart with file to get sample rows in python (shared logic)
	var smBuf bytes.Buffer
	smw := multipart.NewWriter(&smBuf)
	sff, _ := smw.CreateFormFile("file", filepath.Base(header.Filename))
	io.Copy(sff, bytes.NewReader(up.Content))
	smw.Close()
	sreq, _ := http.NewRequest(http.MethodPost, pyBase+"/sample", &smBuf)
	sreq.Header.Set("Content-Type", smw.FormDataContentType())
	sresp, sErr := http.DefaultClient.Do(sreq)
	if sErr != nil || sresp == nil {
		c.JSON(502, gin.H{"error": "python_unreachable"})
		return
	}
	defer sresp.Body.Close()
	var sampleResp struct {
		Data []map[string]any `json:"data"`
	}
	sb, _ := io.ReadAll(sresp.Body)
	_ = json.Unmarshal(sb, &sampleResp)

	// schema validate via python /validate
	var schemaErrors any
	if schemaObj != nil {
		body, _ := json.Marshal(gin.H{"json_schema": schemaObj, "data": sampleResp.Data})
		vreq, _ := http.NewRequest(http.MethodPost, pyBase+"/validate", bytes.NewReader(body))
		vreq.Header.Set("Content-Type", "application/json")
		vresp, vErr := http.DefaultClient.Do(vreq)
		if vErr == nil && vresp != nil {
			defer vresp.Body.Close()
			vb, _ := io.ReadAll(vresp.Body)
			var vr any
			_ = json.Unmarshal(vb, &vr)
			schemaErrors = vr
		}
	}

	// 2) Rules validation (via python /rules/validate)
	var rulesObj any
	if strings.TrimSpace(ds.Rules) != "" {
		_ = json.Unmarshal([]byte(ds.Rules), &rulesObj)
	}
	var rulesErrors any
	if rulesObj != nil {
		body, _ := json.Marshal(gin.H{"rules": rulesObj, "data": sampleResp.Data})
		rreq, _ := http.NewRequest(http.MethodPost, pyBase+"/rules/validate", bytes.NewReader(body))
		rreq.Header.Set("Content-Type", "application/json")
		rresp, rErr := http.DefaultClient.Do(rreq)
		if rErr == nil && rresp != nil {
			defer rresp.Body.Close()
			rb, _ := io.ReadAll(rresp.Body)
			var rr any
			_ = json.Unmarshal(rb, &rr)
			rulesErrors = rr
		}
	}

	// If any errors, return them to allow live fixes pre-submit
	ok := (schemaErrors == nil || getBool(schemaErrors, "valid", true)) && (rulesErrors == nil || getBool(rulesErrors, "valid", true))
	if !ok {
		c.JSON(200, gin.H{"ok": false, "schema": schemaErrors, "rules": rulesErrors})
		return
	}

	// Create change request (pending)
	// Store payload as a small JSON with reference to upload id and filename
	payloadObj := map[string]any{"upload_id": up.ID, "filename": up.Filename}
	pb, _ := json.Marshal(payloadObj)
	// Initialize reviewer state for single reviewer path
	rs := []map[string]any{}
	if reviewerID != 0 {
		rs = append(rs, map[string]any{"id": reviewerID, "status": "pending", "decided_at": nil})
	}
	rsJSON, _ := json.Marshal(rs)
	cr := models.ChangeRequest{ProjectID: uint(pid), DatasetID: ds.ID, Type: "append", Status: "pending", Title: "Append data", Payload: string(pb), ReviewerID: reviewerID, ReviewerStates: string(rsJSON)}
	if uid, exists := c.Get("user_id"); exists {
		if u, ok := uid.(uint); ok {
			cr.UserID = u
		}
	}
	if err := gdb.Create(&cr).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	// Create staging table and ingest upload content
	_ = ensureStagingTable(gdb, ds.ID, cr.ID)
	_ = ingestBytesToTable(gdb, up.Content, up.Filename, dsStagingTable(ds.ID, cr.ID))
	c.JSON(201, gin.H{"ok": true, "change_request": cr})
}

func getBool(v any, key string, def bool) bool {
	m, ok := v.(map[string]any)
	if !ok {
		return def
	}
	if b, ok := m[key].(bool); ok {
		return b
	}
	return def
}

// AppendPreview returns a paginated preview of a file the client is about to append (without storing it yet).
// Accepts multipart/form-data field "file" and forwards to the python /sample endpoint.
// Query params: limit (n), offset.
func AppendPreview(c *gin.Context) {
	// RBAC check against dataset's project
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pidStr := c.Param("projectId")
	if pidStr == "" {
		pidStr = c.Param("id")
	}
	pid, _ := strconv.Atoi(pidStr)
	dsid, _ := strconv.Atoi(c.Param("datasetId"))
	if !HasProjectRole(c, uint(pid), "owner", "contributor", "viewer") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	var ds models.Dataset
	if err := gdb.Where("project_id = ?", pid).First(&ds, dsid).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(400, gin.H{"error": "missing_file"})
		return
	}
	defer file.Close()
	if header != nil && header.Size > maxUploadBytes {
		respondTooLarge(c)
		return
	}

	// Build multipart to python /sample
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, _ := mw.CreateFormFile("file", filepath.Base(header.Filename))
	if _, err := io.CopyN(fw, file, int64(maxUploadBytes)+1); err != nil && err != io.EOF {
		c.JSON(500, gin.H{"error": "read_file"})
		return
	}
	if buf.Len() > int(maxUploadBytes) {
		respondTooLarge(c)
		return
	}
	mw.Close()
	n := c.DefaultQuery("limit", "500")
	off := c.DefaultQuery("offset", "0")
	pyBase := os.Getenv("PYTHON_SERVICE_URL")
	if pyBase == "" {
		pyBase = "http://python-service:8000"
	}
	req, _ := http.NewRequest(http.MethodPost, pyBase+"/sample?n="+n+"&offset="+off, &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	resp, perr := http.DefaultClient.Do(req)
	if perr != nil || resp == nil {
		c.JSON(502, gin.H{"error": "python_unreachable"})
		return
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", b)
}

// AppendValidate stores the file as an upload and runs schema/rules validation only (no Change Request yet)
func AppendValidate(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pidStr := c.Param("projectId")
	if pidStr == "" {
		pidStr = c.Param("id")
	}
	pid, _ := strconv.Atoi(pidStr)
	dsid, _ := strconv.Atoi(c.Param("datasetId"))
	if !HasProjectRole(c, uint(pid), "owner", "contributor") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	var ds models.Dataset
	if err := gdb.Where("project_id = ?", pid).First(&ds, dsid).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(400, gin.H{"error": "missing_file"})
		return
	}
	defer file.Close()
	if header != nil && header.Size > maxUploadBytes {
		respondTooLarge(c)
		return
	}
	var buf bytes.Buffer
	if _, err := io.CopyN(&buf, file, int64(maxUploadBytes)+1); err != nil && err != io.EOF {
		c.JSON(500, gin.H{"error": "read_file"})
		return
	}
	if buf.Len() > maxUploadBytes {
		respondTooLarge(c)
		return
	}
	up := models.DatasetUpload{ProjectID: uint(pid), DatasetID: ds.ID, Filename: header.Filename, Content: buf.Bytes()}
	if err := gdb.Create(&up).Error; err != nil {
		c.JSON(500, gin.H{"error": "db_store_upload"})
		return
	}

	pyBase := os.Getenv("PYTHON_SERVICE_URL")
	if pyBase == "" {
		pyBase = "http://python-service:8000"
	}
	// Sample rows for validation
	var smBuf bytes.Buffer
	smw := multipart.NewWriter(&smBuf)
	sff, _ := smw.CreateFormFile("file", filepath.Base(header.Filename))
	io.Copy(sff, bytes.NewReader(up.Content))
	smw.Close()
	sreq, _ := http.NewRequest(http.MethodPost, pyBase+"/sample", &smBuf)
	sreq.Header.Set("Content-Type", smw.FormDataContentType())
	sresp, sErr := http.DefaultClient.Do(sreq)
	if sErr != nil || sresp == nil {
		c.JSON(502, gin.H{"error": "python_unreachable"})
		return
	}
	defer sresp.Body.Close()
	var sampleResp struct {
		Data []map[string]any `json:"data"`
	}
	sb, _ := io.ReadAll(sresp.Body)
	_ = json.Unmarshal(sb, &sampleResp)

	// Validate against schema and rules if present
	var schemaObj any
	if strings.TrimSpace(ds.Schema) != "" {
		_ = json.Unmarshal([]byte(ds.Schema), &schemaObj)
	}
	var rulesObj any
	if strings.TrimSpace(ds.Rules) != "" {
		_ = json.Unmarshal([]byte(ds.Rules), &rulesObj)
	}
	var schemaErrors any
	var rulesErrors any
	if schemaObj != nil {
		body, _ := json.Marshal(gin.H{"json_schema": schemaObj, "data": sampleResp.Data})
		vreq, _ := http.NewRequest(http.MethodPost, pyBase+"/validate", bytes.NewReader(body))
		vreq.Header.Set("Content-Type", "application/json")
		if vresp, vErr := http.DefaultClient.Do(vreq); vErr == nil && vresp != nil {
			defer vresp.Body.Close()
			vb, _ := io.ReadAll(vresp.Body)
			var vr any
			_ = json.Unmarshal(vb, &vr)
			schemaErrors = vr
		}
	}
	if rulesObj != nil {
		body, _ := json.Marshal(gin.H{"rules": rulesObj, "data": sampleResp.Data})
		rreq, _ := http.NewRequest(http.MethodPost, pyBase+"/rules/validate", bytes.NewReader(body))
		rreq.Header.Set("Content-Type", "application/json")
		if rresp, rErr := http.DefaultClient.Do(rreq); rErr == nil && rresp != nil {
			defer rresp.Body.Close()
			rb, _ := io.ReadAll(rresp.Body)
			var rr any
			_ = json.Unmarshal(rb, &rr)
			rulesErrors = rr
		}
	}
	ok := (schemaErrors == nil || getBool(schemaErrors, "valid", true)) && (rulesErrors == nil || getBool(rulesErrors, "valid", true))
	c.JSON(200, gin.H{"ok": ok, "upload_id": up.ID, "schema": schemaErrors, "rules": rulesErrors})
}

// AppendOpen creates a Change Request from a previously validated upload and selected reviewer
func AppendOpen(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pidStr := c.Param("projectId")
	if pidStr == "" {
		pidStr = c.Param("id")
	}
	pid, _ := strconv.Atoi(pidStr)
	dsid, _ := strconv.Atoi(c.Param("datasetId"))
	if !HasProjectRole(c, uint(pid), "owner", "contributor") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	var ds models.Dataset
	if err := gdb.Where("project_id = ?", pid).First(&ds, dsid).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}
	var body struct {
		UploadID    uint   `json:"upload_id"`
		ReviewerID  uint   `json:"reviewer_id"`
		ReviewerIDs []uint `json:"reviewer_ids"`
		Title       string `json:"title"`
		Comment     string `json:"comment"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(400, gin.H{"error": "invalid_payload"})
		return
	}
	if body.UploadID == 0 {
		c.JSON(400, gin.H{"error": "upload_required"})
		return
	}
	if body.ReviewerID == 0 && len(body.ReviewerIDs) == 0 {
		c.JSON(400, gin.H{"error": "reviewer_required"})
		return
	}
	// Reviewer must be any project member (role agnostic)
	var reviewerIDs []uint
	if body.ReviewerID != 0 {
		reviewerIDs = append(reviewerIDs, body.ReviewerID)
	}
	if len(body.ReviewerIDs) > 0 {
		reviewerIDs = append(reviewerIDs, body.ReviewerIDs...)
	}
	// de-dup and validate all reviewers are members
	uniq := map[uint]struct{}{}
	cleaned := make([]uint, 0, len(reviewerIDs))
	for _, rid := range reviewerIDs {
		if rid != 0 {
			if _, ok := uniq[rid]; !ok {
				uniq[rid] = struct{}{}
				cleaned = append(cleaned, rid)
			}
		}
	}
	if len(cleaned) == 0 {
		c.JSON(400, gin.H{"error": "reviewer_required"})
		return
	}
	var count int64
	if err := gdb.Model(&models.ProjectRole{}).Where("project_id = ? AND user_id IN ?", pid, cleaned).Count(&count).Error; err != nil || count != int64(len(cleaned)) {
		c.JSON(400, gin.H{"error": "reviewer_not_member"})
		return
	}
	var up models.DatasetUpload
	if err := gdb.Where("project_id = ? AND dataset_id = ?", pid, ds.ID).First(&up, body.UploadID).Error; err != nil {
		c.JSON(404, gin.H{"error": "upload_not_found"})
		return
	}
	// Create change request and staging ingest
	payloadObj := map[string]any{"upload_id": up.ID, "filename": up.Filename}
	pb, _ := json.Marshal(payloadObj)
	reviewersJSON, _ := json.Marshal(cleaned)
	// Initialize reviewer states (pending)
	reviewerStates := make([]map[string]any, 0, len(cleaned))
	for _, rid := range cleaned {
		reviewerStates = append(reviewerStates, map[string]any{
			"id":         rid,
			"status":     "pending",
			"decided_at": nil,
		})
	}
	reviewerStatesJSON, _ := json.Marshal(reviewerStates)
	firstReviewer := uint(0)
	if len(cleaned) > 0 {
		firstReviewer = cleaned[0]
	}
	title := strings.TrimSpace(body.Title)
	if title == "" {
		title = "Append data"
	}
	cr := models.ChangeRequest{ProjectID: uint(pid), DatasetID: ds.ID, Type: "append", Status: "pending", Title: title, Payload: string(pb), ReviewerID: firstReviewer, Reviewers: string(reviewersJSON), ReviewerStates: string(reviewerStatesJSON)}
	if uid, exists := c.Get("user_id"); exists {
		if u, ok := uid.(uint); ok {
			cr.UserID = u
		}
	}
	if err := gdb.Create(&cr).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	_ = ensureStagingTable(gdb, ds.ID, cr.ID)
	_ = ingestBytesToTable(gdb, up.Content, up.Filename, dsStagingTable(ds.ID, cr.ID))
	// Optional: initial comment
	if strings.TrimSpace(body.Comment) != "" {
		cc := models.ChangeComment{ProjectID: uint(pid), ChangeRequestID: cr.ID, Body: strings.TrimSpace(body.Comment)}
		if uid, exists := c.Get("user_id"); exists {
			if u, ok := uid.(uint); ok {
				cc.UserID = u
			}
		}
		_ = gdb.Create(&cc).Error
	}
	c.JSON(201, gin.H{"ok": true, "change_request": cr})
}

// Top-level mappings
func DatasetAppendValidateTop(c *gin.Context) {
	// map to project/dataset context
	// find dataset to inject project id
	id, _ := strconv.Atoi(c.Param("id"))
	ds, ok := datasetWithAccess(c, uint(id), "owner", "contributor")
	if !ok {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	c.Params = replaceParam(c.Params, "id", strconv.Itoa(int(ds.ProjectID)))
	c.Params = append(c.Params, gin.Param{Key: "datasetId", Value: strconv.Itoa(int(ds.ID))})
	AppendValidate(c)
}
func DatasetAppendOpenTop(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	ds, ok := datasetWithAccess(c, uint(id), "owner", "contributor")
	if !ok {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	c.Params = replaceParam(c.Params, "id", strconv.Itoa(int(ds.ProjectID)))
	c.Params = append(c.Params, gin.Param{Key: "datasetId", Value: strconv.Itoa(int(ds.ID))})
	AppendOpen(c)
}

// Top-level mapping: validate edited JSON
func DatasetAppendJSONValidateTop(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	ds, ok := datasetWithAccess(c, uint(id), "owner", "contributor")
	if !ok {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	c.Params = replaceParam(c.Params, "id", strconv.Itoa(int(ds.ProjectID)))
	c.Params = append(c.Params, gin.Param{Key: "datasetId", Value: strconv.Itoa(int(ds.ID))})
	AppendJSONValidate(c)
}

// AppendJSON allows submitting edited rows (JSON) for append. Stores the JSON bytes as an upload for audit,
// validates against schema & rules, and opens a change request on success.
func AppendJSON(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pidStr := c.Param("projectId")
	if pidStr == "" {
		pidStr = c.Param("id")
	}
	pid, _ := strconv.Atoi(pidStr)
	dsid, _ := strconv.Atoi(c.Param("datasetId"))
	if !HasProjectRole(c, uint(pid), "owner", "contributor") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	var ds models.Dataset
	if err := gdb.Where("project_id = ?", pid).First(&ds, dsid).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}
	var body struct {
		Rows        []map[string]any `json:"rows"`
		Filename    string           `json:"filename"`
		ReviewerID  uint             `json:"reviewer_id"`
		ReviewerIDs []uint           `json:"reviewer_ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(400, gin.H{"error": "invalid_payload"})
		return
	}
	// Reviewer(s) are selected on validate-first flow via AppendJSONValidate; keep legacy support when provided
	var reviewersAll []uint
	if body.ReviewerID != 0 {
		reviewersAll = append(reviewersAll, body.ReviewerID)
	}
	if len(body.ReviewerIDs) > 0 {
		reviewersAll = append(reviewersAll, body.ReviewerIDs...)
	}
	if len(reviewersAll) > 0 {
		// ensure they are members (any role)
		uniq := map[uint]struct{}{}
		cleaned := make([]uint, 0, len(reviewersAll))
		for _, rid := range reviewersAll {
			if rid != 0 {
				if _, ok := uniq[rid]; !ok {
					uniq[rid] = struct{}{}
					cleaned = append(cleaned, rid)
				}
			}
		}
		var count int64
		if err := gdb.Model(&models.ProjectRole{}).Where("project_id = ? AND user_id IN ?", pid, cleaned).Count(&count).Error; err != nil || count != int64(len(cleaned)) {
			c.JSON(400, gin.H{"error": "reviewer_not_member"})
			return
		}
		reviewersAll = cleaned
	}
	if len(body.Rows) == 0 {
		c.JSON(400, gin.H{"error": "empty_rows"})
		return
	}

	// Validate via python using schema/rules if present
	pyBase := os.Getenv("PYTHON_SERVICE_URL")
	if pyBase == "" {
		pyBase = "http://python-service:8000"
	}
	var schemaObj any
	if strings.TrimSpace(ds.Schema) != "" {
		_ = json.Unmarshal([]byte(ds.Schema), &schemaObj)
	}
	var rulesObj any
	if strings.TrimSpace(ds.Rules) != "" {
		_ = json.Unmarshal([]byte(ds.Rules), &rulesObj)
	}
	ok := true
	if schemaObj != nil {
		sb, _ := json.Marshal(gin.H{"json_schema": schemaObj, "data": body.Rows})
		r, err := http.Post(pyBase+"/validate", "application/json", bytes.NewReader(sb))
		if err != nil || r == nil {
			c.JSON(502, gin.H{"error": "python_unreachable"})
			return
		}
		defer r.Body.Close()
		var vr map[string]any
		bb, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(bb, &vr)
		if v, _ := vr["valid"].(bool); !v {
			ok = false
			c.JSON(200, gin.H{"ok": false, "schema": vr})
			return
		}
	}
	if rulesObj != nil {
		rb, _ := json.Marshal(gin.H{"rules": rulesObj, "data": body.Rows})
		r, err := http.Post(pyBase+"/rules/validate", "application/json", bytes.NewReader(rb))
		if err != nil || r == nil {
			c.JSON(502, gin.H{"error": "python_unreachable"})
			return
		}
		defer r.Body.Close()
		var rr map[string]any
		bb, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(bb, &rr)
		if v, _ := rr["valid"].(bool); !v {
			ok = false
			c.JSON(200, gin.H{"ok": false, "rules": rr})
			return
		}
	}
	if !ok {
		return
	}

	// Store JSON rows as upload content for audit/preview
	fname := body.Filename
	if strings.TrimSpace(fname) == "" {
		fname = "edited.json"
	}
	jb, _ := json.Marshal(body.Rows)
	if len(jb) > maxUploadBytes {
		respondTooLarge(c)
		return
	}
	up := models.DatasetUpload{ProjectID: uint(pid), DatasetID: ds.ID, Filename: fname, Content: jb}
	if err := gdb.Create(&up).Error; err != nil {
		c.JSON(500, gin.H{"error": "db_store_upload"})
		return
	}

	payloadObj := map[string]any{"upload_id": up.ID, "filename": up.Filename}
	pb, _ := json.Marshal(payloadObj)
	reviewersJSON, _ := json.Marshal(reviewersAll)
	firstReviewer := uint(0)
	if len(reviewersAll) > 0 {
		firstReviewer = reviewersAll[0]
	}
	// Initialize reviewer states for edited-rows path
	reviewerStates2 := make([]map[string]any, 0, len(reviewersAll))
	for _, rid := range reviewersAll {
		reviewerStates2 = append(reviewerStates2, map[string]any{
			"id":         rid,
			"status":     "pending",
			"decided_at": nil,
		})
	}
	reviewerStatesJSON2, _ := json.Marshal(reviewerStates2)
	cr := models.ChangeRequest{ProjectID: uint(pid), DatasetID: ds.ID, Type: "append", Status: "pending", Title: "Append data (edited)", Payload: string(pb), ReviewerID: firstReviewer, Reviewers: string(reviewersJSON), ReviewerStates: string(reviewerStatesJSON2)}
	if uid, exists := c.Get("user_id"); exists {
		if u, ok := uid.(uint); ok {
			cr.UserID = u
		}
	}
	if err := gdb.Create(&cr).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	// Create staging table and ingest JSON rows
	_ = ensureStagingTable(gdb, ds.ID, cr.ID)
	_ = ingestBytesToTable(gdb, jb, fname, dsStagingTable(ds.ID, cr.ID))
	c.JSON(201, gin.H{"ok": true, "change_request": cr})
}

// AppendJSONValidate validates edited rows and stores them as an upload, returning an upload_id for later change opening
func AppendJSONValidate(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pidStr := c.Param("projectId")
	if pidStr == "" {
		pidStr = c.Param("id")
	}
	pid, _ := strconv.Atoi(pidStr)
	dsid, _ := strconv.Atoi(c.Param("datasetId"))
	if !HasProjectRole(c, uint(pid), "owner", "contributor") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	var ds models.Dataset
	if err := gdb.Where("project_id = ?", pid).First(&ds, dsid).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}
	var body struct {
		Rows     []map[string]any `json:"rows"`
		Filename string           `json:"filename"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || len(body.Rows) == 0 {
		c.JSON(400, gin.H{"error": "invalid_payload"})
		return
	}
	// Validate via python
	pyBase := os.Getenv("PYTHON_SERVICE_URL")
	if pyBase == "" {
		pyBase = "http://python-service:8000"
	}
	var schemaObj any
	if strings.TrimSpace(ds.Schema) != "" {
		_ = json.Unmarshal([]byte(ds.Schema), &schemaObj)
	}
	var rulesObj any
	if strings.TrimSpace(ds.Rules) != "" {
		_ = json.Unmarshal([]byte(ds.Rules), &rulesObj)
	}
	if schemaObj != nil {
		sb, _ := json.Marshal(gin.H{"json_schema": schemaObj, "data": body.Rows})
		r, err := http.Post(pyBase+"/validate", "application/json", bytes.NewReader(sb))
		if err != nil || r == nil {
			c.JSON(502, gin.H{"error": "python_unreachable"})
			return
		}
		defer r.Body.Close()
		var vr map[string]any
		bb, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(bb, &vr)
		if v, _ := vr["valid"].(bool); !v {
			c.JSON(200, gin.H{"ok": false, "schema": vr})
			return
		}
	}
	if rulesObj != nil {
		rb, _ := json.Marshal(gin.H{"rules": rulesObj, "data": body.Rows})
		r, err := http.Post(pyBase+"/rules/validate", "application/json", bytes.NewReader(rb))
		if err != nil || r == nil {
			c.JSON(502, gin.H{"error": "python_unreachable"})
			return
		}
		defer r.Body.Close()
		var rr map[string]any
		bb, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(bb, &rr)
		if v, _ := rr["valid"].(bool); !v {
			c.JSON(200, gin.H{"ok": false, "rules": rr})
			return
		}
	}
	// Store upload
	fname := body.Filename
	if strings.TrimSpace(fname) == "" {
		fname = "edited.json"
	}
	jb, _ := json.Marshal(body.Rows)
	if len(jb) > maxUploadBytes {
		respondTooLarge(c)
		return
	}
	up := models.DatasetUpload{ProjectID: uint(pid), DatasetID: ds.ID, Filename: fname, Content: jb}
	if err := gdb.Create(&up).Error; err != nil {
		c.JSON(500, gin.H{"error": "db_store_upload"})
		return
	}
	c.JSON(200, gin.H{"ok": true, "upload_id": up.ID})
}
