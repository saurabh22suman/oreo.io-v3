package handlers

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
	"unicode"

	"github.com/gin-gonic/gin"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/internal/database"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/config"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/utils"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/models"
	"gorm.io/gorm"
)

const maxUploadBytes = 100 * 1024 * 1024 // 100 MB

// getPythonServiceURL returns the configured Python service URL with a fallback
func getPythonServiceURL() string {
	cfg := config.Get()
	if cfg.PythonServiceURL != "" {
		return cfg.PythonServiceURL
	}
	return "http://python-service:8000"
}

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

// normalizeTargetDSN accepts a DSN in either "schema.table" or "database.schema.table"
// form and returns a trimmed canonical string. This keeps the backend tolerant of
// frontend changes that omit the database segment when targeting a Postgres schema.table.
func normalizeTargetDSN(dsn string) string {
	dsn = strings.TrimSpace(dsn)
	if dsn == "" {
		return ""
	}
	parts := strings.Split(dsn, ".")
	if len(parts) == 2 {
		// schema.table — accept as-is
		return parts[0] + "." + parts[1]
	}
	// for 3+ parts, preserve the original (e.g. database.schema.table)
	return dsn
}

// parseTargetDSN returns database, schema, table parts for common DSN forms:
// - schema.table => "", schema, table
// - database.schema.table => database, schema, table
// - anything else => "", "", original
func parseTargetDSN(dsn string) (string, string, string) {
	dsn = strings.TrimSpace(dsn)
	if dsn == "" {
		return "", "", ""
	}
	parts := strings.Split(dsn, ".")
	if len(parts) == 2 {
		return "", parts[0], parts[1]
	}
	if len(parts) >= 3 {
		// join any extra leading parts as database
		db := strings.Join(parts[:len(parts)-2], ".")
		return db, parts[len(parts)-2], parts[len(parts)-1]
	}
	return "", "", dsn
}

// CheckTableExists responds with { exists: boolean, message: string }
func CheckTableExists(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	schema := strings.TrimSpace(c.Query("schema"))
	table := strings.TrimSpace(c.Query("table"))
	if schema == "" || table == "" {
		c.JSON(400, gin.H{"error": "invalid_params", "message": "schema and table are required"})
		return
	}
	// Validate table and schema names to prevent SQL injection
	if err := utils.ValidateTableName(schema); err != nil {
		c.JSON(400, gin.H{"error": "invalid_schema", "message": err.Error()})
		return
	}
	if err := utils.ValidateTableName(table); err != nil {
		c.JSON(400, gin.H{"error": "invalid_table", "message": err.Error()})
		return
	}
	exists := tableExistsInSchema(gdb, schema, table)
	msg := ""
	if exists {
		msg = "Table already exists"
	}
	c.JSON(200, gin.H{"exists": exists, "message": msg})
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

// tableExistsInSchema checks existence by schema and table when available (Postgres)
func tableExistsInSchema(gdb *gorm.DB, schema, name string) bool {
	if gdb == nil {
		return false
	}
	if dialect(gdb) == "postgres" {
		var exists bool
		row := gdb.Raw("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = ?)", schema, name).Row()
		_ = row.Scan(&exists)
		return exists
	}
	// sqlite has no schemas; fallback to simple
	return tableExists(gdb, name)
}

// datasetPhysicalTable resolves the storage table for a dataset: prefer target schema.table when set
func datasetPhysicalTable(ds *models.Dataset) string {
	if ds == nil {
		return ""
	}
	s := strings.TrimSpace(ds.TargetSchema)
	t := strings.TrimSpace(ds.TargetTable)
	if s != "" && t != "" {
		// If using sqlite (dev metadata), emulate schema by joining with underscore
		gdb := dbpkg.Get()
		if gdb != nil && strings.EqualFold(dialect(gdb), "sqlite") {
			return fmt.Sprintf("%s_%s", s, t)
		}
		// For postgres (and others that support schemas), use schema.table
		return fmt.Sprintf("%s.%s", s, t)
	}
	return dsMainTable(ds.ID)
}

// ensureDatasetTable creates the resolved physical table (schema.table or fallback) with JSON storage
func ensureDatasetTable(gdb *gorm.DB, ds *models.Dataset) error {
	if gdb == nil || ds == nil {
		return fmt.Errorf("invalid args")
	}
	tbl := datasetPhysicalTable(ds)
	if tbl == "" {
		return fmt.Errorf("table not resolved")
	}
	if dialect(gdb) == "postgres" {
		// Create schema if needed when using target schema
		if strings.Contains(tbl, ".") {
			parts := strings.SplitN(tbl, ".", 2)
			if len(parts) == 2 {
				_ = gdb.Exec(fmt.Sprintf("CREATE SCHEMA IF NOT EXISTS %s", parts[0])).Error
			}
		}
		return gdb.Exec(fmt.Sprintf("CREATE TABLE IF NOT EXISTS %s (id BIGSERIAL PRIMARY KEY, data JSONB NOT NULL)", tbl)).Error
	}
	return gdb.Exec(fmt.Sprintf("CREATE TABLE IF NOT EXISTS %s (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL)", tbl)).Error
}

// dropDatasetPhysicalAndStaging drops the main physical table and any staging tables for a dataset.
func dropDatasetPhysicalAndStaging(gdb *gorm.DB, ds *models.Dataset) {
	if gdb == nil || ds == nil {
		return
	}
	// Drop main/physical table
	tbl := datasetPhysicalTable(ds)
	if strings.TrimSpace(tbl) != "" {
		_ = gdb.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", tbl)).Error
	}
	// Drop any staging tables for this dataset (pattern: ds_<id>_stg_*)
	likePrefix := fmt.Sprintf("ds_%d_stg_", ds.ID)
	if dialect(gdb) == "postgres" {
		type row struct{ TableName string }
		var rows []row
		// Restrict to non-system schemas; staging are created without explicit schema
		_ = gdb.Raw("SELECT table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') AND table_name LIKE ?", likePrefix+"%").Scan(&rows).Error
		for _, r := range rows {
			_ = gdb.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", r.TableName)).Error
		}
	} else {
		type row struct{ Name string }
		var rows []row
		_ = gdb.Raw("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ?", likePrefix+"%").Scan(&rows).Error
		for _, r := range rows {
			_ = gdb.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", r.Name)).Error
		}
	}
}

// upsertDatasetMeta updates or creates sys.metadata for a dataset based on current main table
func upsertDatasetMeta(gdb *gorm.DB, ds *models.Dataset) {
	if gdb == nil || ds == nil {
		return
	}
	// Count rows
	var rows int64
	tbl := datasetPhysicalTable(ds)
	// For delta backend, try to get stats from Python service
	if strings.EqualFold(ds.StorageBackend, "delta") {
		// Attempt to get Delta table stats from Python service using hierarchical path
		pyBase := getPythonServiceURL()
		url := fmt.Sprintf("%s/delta/table-info?project_id=%d&dataset_id=%d", pyBase, ds.ProjectID, ds.ID)
		resp, err := http.Get(url)
		if err == nil && resp != nil && resp.StatusCode == 200 {
			defer resp.Body.Close()
			var statsResp struct {
				NumRows int64 `json:"num_rows"`
				NumCols int   `json:"num_cols"`
			}
			if json.NewDecoder(resp.Body).Decode(&statsResp) == nil {
				rows = statsResp.NumRows
				// We'll set cols from schema below
			}
		}
	} else if strings.TrimSpace(tbl) != "" {
		_ = gdb.Raw(fmt.Sprintf("SELECT COUNT(*) FROM %s", tbl)).Row().Scan(&rows)
	}
	
	// Infer columns count from schema
	cols := 0
	if strings.TrimSpace(ds.Schema) != "" {
		var schemaObj map[string]any
		if err := json.Unmarshal([]byte(ds.Schema), &schemaObj); err == nil {
			if props, ok := schemaObj["properties"].(map[string]any); ok {
				cols = len(props)
			}
		}
	}
	
	// Fallback: for non-delta, sample one row to infer columns count if schema failed
	if cols == 0 && rows > 0 && !strings.EqualFold(ds.StorageBackend, "delta") {
		if r1, err := gdb.Raw(fmt.Sprintf("SELECT data FROM %s LIMIT 1", tbl)).Rows(); err == nil {
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
	
	// Compose table location string - always show schema.table format
	tableLoc := ""
	s := strings.TrimSpace(ds.TargetSchema)
	t := strings.TrimSpace(ds.TargetTable)
	d := strings.TrimSpace(ds.TargetDatabase)
	
	// Always use schema.table format for user-facing display
	switch {
	case d != "" && s != "" && t != "":
		tableLoc = fmt.Sprintf("%s.%s.%s", d, s, t)
	case s != "" && t != "":
		tableLoc = fmt.Sprintf("%s.%s", s, t)
	default:
		// Fallback to physical table if target fields not set
		tableLoc = datasetPhysicalTable(ds)
	}
	
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

// ensureDeltaTable calls the Python service to create an empty Delta table for this dataset.
func ensureDeltaTable(ds *models.Dataset) error {
	if ds == nil { return fmt.Errorf("nil dataset") }
	pyBase := getPythonServiceURL()
	// Build schema object from ds.Schema if JSON; if empty or invalid use {} to satisfy pydantic Dict expectation
	var schemaObj any
	s := strings.TrimSpace(ds.Schema)
	if s != "" {
		if err := json.Unmarshal([]byte(s), &schemaObj); err != nil {
			// fall back to empty map if unmarshalling fails
			schemaObj = map[string]any{}
		}
	} else {
		schemaObj = map[string]any{}
	}
	payload := map[string]any{
		"table":  fmt.Sprintf("%d", ds.ID),
		"schema": schemaObj,
	}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest(http.MethodPost, pyBase+"/delta/ensure", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil || resp == nil { return fmt.Errorf("python_unreachable") }
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// Attempt to read error body for diagnostic surface
		b, _ := io.ReadAll(resp.Body)
		msg := strings.TrimSpace(string(b))
		if msg == "" { msg = resp.Status }
		return fmt.Errorf("ensure_failed: %s", msg)
	}
	return nil
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
	pid, ok := ResolveProjectID(pidStr)
	if !ok {
		c.JSON(404, gin.H{"error": "project_not_found"})
		return
	}
	if !HasProjectRole(c, pid, "owner", "contributor") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	var in DatasetIn
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(400, gin.H{"error": "invalid_payload"})
		return
	}
	// Capture default storage backend (env driven) for dataset row
	cfg := config.Get(); backend := strings.ToLower(strings.TrimSpace(cfg.DefaultStorageBackend))
	if backend == "" {
		backend = "postgres"
	}
	
	// Generate unique PublicID
	var publicID string
	for i := 0; i < 10; i++ {
		publicID = utils.GeneratePublicID()
		var count int64
		if err := gdb.Model(&models.Dataset{}).Where("public_id = ?", publicID).Count(&count).Error; err == nil && count == 0 {
			break
		}
		if i == 9 {
			c.JSON(500, gin.H{"error": "failed_to_generate_id"})
			return
		}
	}
	
	ds := models.Dataset{
		ProjectID:      pid,
		PublicID:       publicID,
		Name:           in.Name,
		Schema:         in.Schema,
		StorageBackend: backend,
	}
	if err := gdb.Create(&ds).Error; err != nil {
		c.JSON(409, gin.H{"error": "name_conflict"})
		return
	}
	// Backend-specific ensure logic
	if strings.EqualFold(ds.StorageBackend, "delta") {
		// Call python /delta/ensure to create empty delta table (using dataset ID as table name)
		if err := ensureDeltaTable(&ds); err != nil {
			// Surface failure to client; delete the just-created dataset row to avoid dangling metadata
			_ = gdb.Delete(&models.Dataset{}, ds.ID).Error
			c.JSON(500, gin.H{"error": "delta_ensure_failed", "message": err.Error()})
			return
		}
	} else {
		// Legacy SQL path
		_ = ensureDatasetTable(gdb, &ds)
	}
	// Initialize metadata row with zero counts
	upsertDatasetMeta(gdb, &ds)
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
		ProjectID   uint   `json:"project_id" binding:"required"`
		Name        string `json:"name"`
		DatasetName string `json:"dataset_name"`
		Source      string `json:"source"`
		// DB mapping (schema.table) support
		Schema string `json:"schema"`
		Table  string `json:"table"`
		Target struct {
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

	// Resolve dataset name (accept alias dataset_name)
	dsName := strings.TrimSpace(body.Name)
	if dsName == "" {
		dsName = strings.TrimSpace(body.DatasetName)
	}
	if dsName == "" {
		c.JSON(400, gin.H{"error": "invalid_dataset_name", "message": "Dataset name cannot be empty"})
		return
	}

	// Helper validator: allow only letters, digits, underscore
	isValidIdent := func(s string) bool {
		if strings.TrimSpace(s) == "" {
			return false
		}
		for _, ch := range s {
			if !(unicode.IsLetter(ch) || unicode.IsDigit(ch) || ch == '_') {
				return false
			}
		}
		return true
	}

	// Prefer explicit schema/table if provided; else parse DSN
	schemaName := strings.TrimSpace(body.Schema)
	tableName := strings.TrimSpace(body.Table)
	var norm string
	var dbName string
	if schemaName != "" && tableName != "" {
		// validate table
		if !isValidIdent(tableName) {
			c.JSON(400, gin.H{"error": "invalid_table", "message": "Table name must contain only letters, numbers, and underscores"})
			return
		}
		// normalize case for table: lowercase as conventional
		tableName = strings.ToLower(tableName)
		norm = schemaName + "." + tableName
	} else {
		norm = normalizeTargetDSN(body.Target.DSN)
		dbName2, schema2, table2 := parseTargetDSN(body.Target.DSN)
		dbName = dbName2
		if schemaName == "" {
			schemaName = schema2
		}
		if tableName == "" {
			tableName = table2
		}
		// If a table is parsed, validate
		if tableName != "" && !isValidIdent(tableName) {
			c.JSON(400, gin.H{"error": "invalid_table", "message": "Table name must contain only letters, numbers, and underscores"})
			return
		}
	}

	// Idempotency: if schema+table resolved, ensure not already used within the project
	if gdb != nil && schemaName != "" && tableName != "" {
		var existing models.Dataset
		err := gdb.Where("project_id = ? AND LOWER(target_schema) = ? AND LOWER(target_table) = ?", body.ProjectID, strings.ToLower(schemaName), strings.ToLower(tableName)).First(&existing).Error
		if err == nil {
			c.JSON(409, gin.H{"error": "dataset_exists", "message": "A dataset for this schema.table already exists."})
			return
		}
	}
	cfg := config.Get(); backend := strings.ToLower(strings.TrimSpace(cfg.DefaultStorageBackend))
	if backend == "" { backend = "postgres" }
	ds := models.Dataset{
		ProjectID:      body.ProjectID,
		Name:           dsName,
		Source:         body.Source,
		TargetType:     body.Target.Type,
		TargetDSN:      norm,
		TargetDatabase: dbName,
		TargetSchema:   schemaName,
		TargetTable:    tableName,
		StorageBackend: backend,
	}
	if err := gdb.Create(&ds).Error; err != nil {
		c.JSON(409, gin.H{"error": "name_conflict"})
		return
	}
	// Ensure physical storage depending on backend
	if strings.EqualFold(ds.StorageBackend, "delta") {
		if err := ensureDeltaTable(&ds); err != nil {
			_ = gdb.Delete(&models.Dataset{}, ds.ID).Error
			c.JSON(500, gin.H{"error": "delta_ensure_failed", "message": err.Error()})
			return
		}
	} else {
		_ = ensureDatasetTable(gdb, &ds)
	}
	upsertDatasetMeta(gdb, &ds)
	c.JSON(201, ds)
}

// DatasetsPrepare performs an atomic dataset creation with an optional file upload and validation.
// It accepts multipart/form-data with fields: project_id, name (or dataset_name), schema, table, source, and file.
// If any step fails, it deletes the newly created dataset to avoid dangling rows.
func DatasetsPrepare(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	// Parse multipart
	if err := c.Request.ParseMultipartForm(int64(maxUploadBytes) + (10 << 20)); err != nil {
		c.JSON(400, gin.H{"error": "invalid_multipart"})
		return
	}
	pidStr := strings.TrimSpace(c.PostForm("project_id"))
	pid, _ := strconv.Atoi(pidStr)
	if pid == 0 {
		c.JSON(400, gin.H{"error": "project_required"})
		return
	}
	if !HasProjectRole(c, uint(pid), "owner", "contributor") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	name := strings.TrimSpace(c.PostForm("name"))
	if name == "" {
		name = strings.TrimSpace(c.PostForm("dataset_name"))
	}
	if name == "" {
		c.JSON(400, gin.H{"error": "invalid_dataset_name", "message": "Dataset name cannot be empty"})
		return
	}
	schemaName := strings.TrimSpace(c.PostForm("schema"))
	tableName := strings.ToLower(strings.TrimSpace(c.PostForm("table")))
	source := strings.TrimSpace(c.PostForm("source"))
	// Prevent duplicates if schema.table provided
	if schemaName != "" && tableName != "" {
		var existing models.Dataset
		if err := gdb.Where("project_id = ? AND LOWER(target_schema) = ? AND LOWER(target_table) = ?", pid, strings.ToLower(schemaName), tableName).First(&existing).Error; err == nil {
			c.JSON(409, gin.H{"error": "dataset_exists", "message": "A dataset for this schema.table already exists."})
			return
		}
	}
	cfg := config.Get(); backend := strings.ToLower(strings.TrimSpace(cfg.DefaultStorageBackend))
	if backend == "" { backend = "postgres" }
	ds := models.Dataset{ProjectID: uint(pid), Name: name, Source: source, TargetSchema: schemaName, TargetTable: tableName, StorageBackend: backend}
	if err := gdb.Create(&ds).Error; err != nil {
		c.JSON(409, gin.H{"error": "name_conflict"})
		return
	}
	created := true
	// If a file is present, allow a one-time initial ingest into the main table during dataset creation.
	// After creation, all further data additions must use the append approval flow.
	file, header, err := c.Request.FormFile("file")
	if err == nil && file != nil && header != nil {
		defer file.Close()
		if header.Size > maxUploadBytes {
			_ = gdb.Delete(&models.Dataset{}, ds.ID).Error
			respondTooLarge(c)
			return
		}
		// Read full content once for schema inference + ingest reuse
		contentBytes, rerr := io.ReadAll(file)
		if rerr != nil {
			_ = gdb.Delete(&models.Dataset{}, ds.ID).Error
			c.JSON(400, gin.H{"error": "invalid_file"})
			return
		}
		// Ensure physical table or delta path, with schema inference via Python service if delta
		if strings.EqualFold(ds.StorageBackend, "delta") {
			if strings.TrimSpace(ds.Schema) == "" {
				// Call python /infer-schema
				pyBase := getPythonServiceURL()
				var mpBuf bytes.Buffer
				mw := multipart.NewWriter(&mpBuf)
				fw, _ := mw.CreateFormFile("file", header.Filename)
				fw.Write(contentBytes)
				mw.Close()

				req, _ := http.NewRequest(http.MethodPost, pyBase+"/infer-schema", &mpBuf)
				req.Header.Set("Content-Type", mw.FormDataContentType())
				resp, err := http.DefaultClient.Do(req)
				if err == nil && resp != nil && resp.StatusCode == 200 {
					defer resp.Body.Close()
					var result struct {
						Schema any `json:"schema"`
					}
					if err := json.NewDecoder(resp.Body).Decode(&result); err == nil && result.Schema != nil {
						bSchema, _ := json.Marshal(result.Schema)
						ds.Schema = string(bSchema)
						_ = gdb.Model(&ds).Update("schema", ds.Schema).Error
					}
				} else {
					// Log warning but proceed (will use empty schema)
					if resp != nil {
						resp.Body.Close()
					}
				}
			}
			if err := ensureDeltaTable(&ds); err != nil {
				_ = gdb.Delete(&models.Dataset{}, ds.ID).Error
				c.JSON(500, gin.H{"error": "delta_ensure_failed", "message": err.Error()})
				return
			}
		} else {
			if err := ensureDatasetTable(gdb, &ds); err != nil {
				_ = gdb.Delete(&models.Dataset{}, ds.ID).Error
				c.JSON(500, gin.H{"error": "table_create_failed"})
				return
			}
		}
		// Sanity: ensure main table is empty so this is truly the first ingest
		var existing int64
		tbl := datasetPhysicalTable(&ds)
		if strings.TrimSpace(tbl) != "" {
			_ = gdb.Raw(fmt.Sprintf("SELECT COUNT(*) FROM %s", tbl)).Row().Scan(&existing)
		}
		if existing > 0 {
			_ = gdb.Delete(&models.Dataset{}, ds.ID).Error
			c.JSON(403, gin.H{"error": "append_only", "message": "Modifications are not allowed. Use append flow."})
			return
		}
		// Perform initial ingest
		if strings.EqualFold(ds.StorageBackend, "delta") {
			pyBase := getPythonServiceURL()
			var mpBuf bytes.Buffer
			mw := multipart.NewWriter(&mpBuf)
			// Send project_id and dataset_id for hierarchical path structure
			_ = mw.WriteField("project_id", fmt.Sprintf("%d", ds.ProjectID))
			_ = mw.WriteField("dataset_id", fmt.Sprintf("%d", ds.ID))
			fw, _ := mw.CreateFormFile("file", header.Filename)
			_, _ = fw.Write(contentBytes)
			mw.Close()
			req, _ := http.NewRequest(http.MethodPost, pyBase+"/delta/append-file", &mpBuf)
			req.Header.Set("Content-Type", mw.FormDataContentType())
			resp, perr := http.DefaultClient.Do(req)
			if perr != nil || resp == nil {
				_ = gdb.Delete(&models.Dataset{}, ds.ID).Error
				c.JSON(502, gin.H{"error": "python_unreachable"})
				return
			}
			defer resp.Body.Close()
			if resp.StatusCode < 200 || resp.StatusCode >= 300 {
				b, _ := io.ReadAll(resp.Body)
				msg := strings.TrimSpace(string(b))
				if msg == "" { msg = resp.Status }
				_ = gdb.Delete(&models.Dataset{}, ds.ID).Error
				c.JSON(500, gin.H{"error": "ingest_failed", "message": msg})
				return
			}
		} else {
			if err2 := ingestBytesToTable(gdb, contentBytes, header.Filename, tbl); err2 != nil {
				_ = gdb.Delete(&models.Dataset{}, ds.ID).Error
				if err2.Error() == "unsupported_format" {
					c.JSON(400, gin.H{"error": "unsupported_format", "message": "Only .csv and .json are supported."})
				} else {
					c.JSON(500, gin.H{"error": "ingest_failed"})
				}
				return
			}
		}
		// Update metadata after initial ingest
		upsertDatasetMeta(gdb, &ds)
		c.JSON(201, gin.H{"id": ds.ID, "project_id": ds.ProjectID, "name": ds.Name})
		return
	} else if err != nil && err != http.ErrMissingFile {
		// unexpected error reading file part
		if created {
			_ = gdb.Delete(&models.Dataset{}, ds.ID).Error
		}
		c.JSON(400, gin.H{"error": "invalid_file"})
		return
	}
	// No file provided; dataset prepared as empty
	c.JSON(201, gin.H{"id": ds.ID, "project_id": ds.ProjectID, "name": ds.Name})
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
	// If schema exists, return it.
	if strings.TrimSpace(ds.Schema) != "" {
		c.JSON(200, gin.H{"schema": ds.Schema})
		return
	}

	// Defensive: attempt to infer schema from last uploaded file if available.
	if ds.LastUploadPath != "" {
		gdb := dbpkg.Get()
		if gdb == nil {
			if _, err := dbpkg.Init(); err == nil {
				gdb = dbpkg.Get()
			}
		}
		pyBase := getPythonServiceURL()
		if pyBase == "" {
			pyBase = "http://python-service:8000"
		}
		// Build multipart request with the stored file
		var mpBuf bytes.Buffer
		mw := multipart.NewWriter(&mpBuf)
		fw, _ := mw.CreateFormFile("file", filepath.Base(ds.LastUploadPath))
		f, ferr := os.Open(ds.LastUploadPath)
		if ferr == nil {
			io.Copy(fw, f)
			f.Close()
		}
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
				if schemaBytes, err := json.Marshal(result.Schema); err == nil {
					ds.Schema = string(schemaBytes)
					_ = gdb.Save(ds).Error
					c.JSON(200, gin.H{"schema": ds.Schema})
					return
				}
			}
		}
	}
	// Nothing to infer now — respond with no schema (frontend may poll)
	c.JSON(200, gin.H{"schema": nil})
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

// DatasetAppendValidateTop validates a file for a dataset by delegating to AppendUpload validation logic without opening a change.
// For now, reuse the existing two-step in frontends that first call /data/append/validate and then /data/append/open.
// This handler simply proxies to the project-scoped validate by mapping context params.
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
	
	// Handle Delta storage backend
	if strings.EqualFold(ds.StorageBackend, "delta") {
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
		
		// Get the table location from metadata
		gdb := dbpkg.Get()
		if gdb == nil {
			if _, err := dbpkg.Init(); err == nil {
				gdb = dbpkg.Get()
			}
		}
		
		var meta models.DatasetMeta
		if err := gdb.Where("dataset_id = ?", ds.ID).First(&meta).Error; err != nil {
			c.JSON(500, gin.H{"error": "metadata_not_found"})
			return
		}
		
		tableLocation := meta.TableLocation
		if tableLocation == "" {
			// Fallback to dataset physical table
			tableLocation = datasetPhysicalTable(ds)
		}
		
		// Query Delta table via Python service
		pyBase := getPythonServiceURL()
		if pyBase == "" {
			pyBase = "http://python-service:8000"
		}
		
		// Build query request
		queryReq := map[string]any{
			"sql": fmt.Sprintf("SELECT * FROM %s", tableLocation),
			"table_mappings": map[string]string{
				tableLocation: fmt.Sprintf("%d/%d", ds.ProjectID, ds.ID),
			},
			"limit":  n,
			"offset": off,
		}
		
		body, _ := json.Marshal(queryReq)
		req, _ := http.NewRequest(http.MethodPost, pyBase+"/delta/query", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		
		resp, err := http.DefaultClient.Do(req)
		if err != nil || resp == nil {
			c.JSON(502, gin.H{"error": "python_unreachable"})
			return
		}
		defer resp.Body.Close()
		
		if resp.StatusCode != 200 {
			b, _ := io.ReadAll(resp.Body)
			c.JSON(resp.StatusCode, gin.H{"error": "delta_query_failed", "details": string(b)})
			return
		}
		
		// Parse Python service response
		var deltaResp struct {
			Columns []string        `json:"columns"`
			Rows    [][]interface{} `json:"rows"`
			Total   int             `json:"total"`
		}
		
		if err := json.NewDecoder(resp.Body).Decode(&deltaResp); err != nil {
			c.JSON(500, gin.H{"error": "invalid_response"})
			return
		}
		
		// Convert rows to map format expected by frontend
		dataRows := make([]map[string]interface{}, 0, len(deltaResp.Rows))
		for _, row := range deltaResp.Rows {
			rowMap := make(map[string]interface{})
			for i, col := range deltaResp.Columns {
				if i < len(row) {
					rowMap[col] = row[i]
				}
			}
			dataRows = append(dataRows, rowMap)
		}
		
		c.JSON(200, gin.H{
			"data":    dataRows,
			"columns": deltaResp.Columns,
		})
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
	pyBase := getPythonServiceURL()
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
		// For delta backend, try to refresh metadata
		if strings.EqualFold(ds.StorageBackend, "delta") {
			fmt.Printf("DEBUG DatasetStats: row_count is 0 for Delta dataset, refreshing metadata\n")
			upsertDatasetMeta(gdb, ds)
			// Re-fetch metadata after update
			_ = gdb.Where("dataset_id = ?", ds.ID).First(&meta).Error
			stats["row_count"] = meta.RowCount
			stats["column_count"] = meta.ColumnCount
		} else {
			var total int64
			// Attempt to count directly from the dataset's physical table (schema.table or ds_<id>)
			_ = gdb.Raw(fmt.Sprintf("SELECT COUNT(*) FROM %s", datasetPhysicalTable(ds))).Row().Scan(&total)
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
	// Ensure the resolved physical table exists (schema.table or fallback ds_<id>)
	if !tableExists(gdb, datasetPhysicalTable(ds)) {
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
			rows, err = gdb.Raw(fmt.Sprintf("SELECT data FROM %s WHERE data @> ?::jsonb LIMIT ? OFFSET ?", datasetPhysicalTable(ds)), string(jb), body.Limit, body.Offset).Rows()
		} else {
			// naive filter for sqlite: match as substring
			rows, err = gdb.Raw(fmt.Sprintf("SELECT data FROM %s WHERE data LIKE ? LIMIT ? OFFSET ?", datasetPhysicalTable(ds)), "%"+string(jb)+"%", body.Limit, body.Offset).Rows()
		}
	} else {
		rows, err = gdb.Raw(fmt.Sprintf("SELECT data FROM %s LIMIT ? OFFSET ?", datasetPhysicalTable(ds)), body.Limit, body.Offset).Rows()
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
	// If a target DSN was provided in the payload, parse and store structured fields
	if strings.TrimSpace(in.Target.DSN) != "" {
		norm := normalizeTargetDSN(in.Target.DSN)
		dbName, schemaName, tableName := parseTargetDSN(in.Target.DSN)
		ds.TargetDSN = norm
		ds.TargetDatabase = dbName
		ds.TargetSchema = schemaName
		ds.TargetTable = tableName
	}
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

	// Load dataset to check emptiness if needed
	var ds models.Dataset
	if err := gdb.Where("project_id = ?", pid).First(&ds, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}

	// Owners can always delete
	if !HasProjectRole(c, uint(pid), "owner") {
		// Contributors may delete only if the dataset is effectively empty (no uploads, no schema/rules)
		if HasProjectRole(c, uint(pid), "contributor") {
			var cnt int64
			if err := gdb.Model(&models.DatasetUpload{}).Where("project_id = ? AND dataset_id = ?", pid, ds.ID).Count(&cnt).Error; err != nil {
				c.JSON(500, gin.H{"error": "db"})
				return
			}
			isEmpty := cnt == 0 && strings.TrimSpace(ds.Schema) == "" && strings.TrimSpace(ds.Rules) == "" && strings.TrimSpace(ds.LastUploadPath) == ""
			if !isEmpty {
				c.JSON(403, gin.H{"error": "forbidden"})
				return
			}
		} else {
			c.JSON(403, gin.H{"error": "forbidden"})
			return
		}
	}

	// Perform cascading delete in a transaction: child rows, metadata, and physical tables
	if err := gdb.Transaction(func(tx *gorm.DB) error {
		// Delete change comments linked to change requests of this dataset
		if err := tx.Exec("DELETE FROM change_comments WHERE project_id = ? AND change_request_id IN (SELECT id FROM change_requests WHERE project_id = ? AND dataset_id = ?)", pid, pid, ds.ID).Error; err != nil {
			return err
		}
		// Delete data quality results linked via uploads
		if err := tx.Exec("DELETE FROM data_quality_results WHERE upload_id IN (SELECT id FROM dataset_uploads WHERE project_id = ? AND dataset_id = ?)", pid, ds.ID).Error; err != nil {
			return err
		}
		// Delete uploads
		if err := tx.Where("project_id = ? AND dataset_id = ?", pid, ds.ID).Delete(&models.DatasetUpload{}).Error; err != nil {
			return err
		}
		// Delete change requests
		if err := tx.Where("project_id = ? AND dataset_id = ?", pid, ds.ID).Delete(&models.ChangeRequest{}).Error; err != nil {
			return err
		}
		// Delete dataset versions
		if err := tx.Where("dataset_id = ?", ds.ID).Delete(&models.DatasetVersion{}).Error; err != nil {
			return err
		}
		// Delete data quality rules
		if err := tx.Where("dataset_id = ?", ds.ID).Delete(&models.DataQualityRule{}).Error; err != nil {
			return err
		}
		// Delete metadata
		if err := tx.Where("dataset_id = ?", ds.ID).Delete(&models.DatasetMeta{}).Error; err != nil {
			return err
		}
		// Drop physical and staging tables for dataset
		dropDatasetPhysicalAndStaging(tx, &ds)
		// Finally delete dataset row
		if err := tx.Where("project_id = ?", pid).Delete(&models.Dataset{}, id).Error; err != nil {
			return err
		}
		return nil
	}); err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	c.Status(204)
}

// DatasetUpload streams a file to a temp folder for later processing (schema inference/append)
func DatasetUpload(c *gin.Context) {
	// Append-only policy: direct uploads are disabled. Use the append flow (validate -> open -> approve).
	c.JSON(403, gin.H{"error": "append_only", "message": "Modifications are not allowed. Use append flow."})
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
	if !HasProjectRole(c, uint(pid), "owner", "contributor", "viewer") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	var ds models.Dataset
	if err := gdb.Where("project_id = ?", pid).First(&ds, dsid).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}
	// If DB table exists, return sample from it
	if tableExists(gdb, datasetPhysicalTable(&ds)) {
		nStr := c.DefaultQuery("n", "50")
		n, _ := strconv.Atoi(nStr)
		if n <= 0 {
			n = 50
		}
		rows, err := gdb.Raw(fmt.Sprintf("SELECT data FROM %s LIMIT ?", datasetPhysicalTable(&ds)), n).Rows()
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
	pyBase := getPythonServiceURL()
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
	// Reviewer must be a project member (any role) now that 'approver' role is removed
	var pr models.ProjectRole
	if err := gdb.Where("project_id = ? AND user_id = ?", pid, reviewerID).First(&pr).Error; err != nil {
		c.JSON(400, gin.H{"error": "reviewer_not_member"})
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
	pyBase := getPythonServiceURL()
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
		switch v := uid.(type) {
		case float64:
			cr.UserID = uint(v)
		case int:
			cr.UserID = uint(v)
		case uint:
			cr.UserID = v
		}
	}
	if err := gdb.Create(&cr).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	// Create staging table and ingest upload content
	_ = ensureStagingTable(gdb, ds.ID, cr.ID)
	_ = ingestBytesToTable(gdb, up.Content, up.Filename, dsStagingTable(ds.ID, cr.ID))
	// Notify reviewer if present
	if reviewerID != 0 {
		_ = AddNotification(reviewerID, "You were requested to review a change", models.JSONB{"type": "reviewer_assigned", "project_id": uint(pid), "dataset_id": ds.ID, "change_request_id": cr.ID, "title": "Append data"})
	}
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
	pyBase := getPythonServiceURL()
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

	pyBase := getPythonServiceURL()
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
		switch v := uid.(type) {
		case float64:
			cr.UserID = uint(v)
		case int:
			cr.UserID = uint(v)
		case uint:
			cr.UserID = v
		}
	}
	if err := gdb.Create(&cr).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	_ = ensureStagingTable(gdb, ds.ID, cr.ID)
	_ = ingestBytesToTable(gdb, up.Content, up.Filename, dsStagingTable(ds.ID, cr.ID))
	// Notify reviewers
	reviewers := []uint{}
	if firstReviewer != 0 {
		reviewers = append(reviewers, firstReviewer)
	}
	if len(cleaned) > 0 {
		reviewers = cleaned
	}
	_ = AddNotificationsBulk(reviewers, "You were requested to review a change", models.JSONB{"type": "reviewer_assigned", "project_id": uint(pid), "dataset_id": ds.ID, "change_request_id": cr.ID, "title": title})
	// Optional: initial comment
	if strings.TrimSpace(body.Comment) != "" {
		cc := models.ChangeComment{ProjectID: uint(pid), ChangeRequestID: cr.ID, Body: strings.TrimSpace(body.Comment)}
		if uid, exists := c.Get("user_id"); exists {
			switch v := uid.(type) {
			case float64:
				cc.UserID = uint(v)
			case int:
				cc.UserID = uint(v)
			case uint:
				cc.UserID = v
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
	pyBase := getPythonServiceURL()
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
	// Notify reviewers for edited-rows path
	reviewers := []uint{}
	if firstReviewer != 0 {
		reviewers = append(reviewers, firstReviewer)
	}
	if len(reviewersAll) > 0 {
		reviewers = reviewersAll
	}
	_ = AddNotificationsBulk(reviewers, "You were requested to review a change", models.JSONB{"type": "reviewer_assigned", "project_id": uint(pid), "dataset_id": ds.ID, "change_request_id": cr.ID, "title": "Append data (edited)"})
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
	pyBase := getPythonServiceURL()
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
