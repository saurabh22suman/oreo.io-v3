package handlers

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// positive check: query must start with SELECT or WITH ... SELECT
var selectRe = regexp.MustCompile(`(?i)^\s*(with\b[\s\S]+select\b|select\b)`)

type QueryExecuteRequest struct {
	SQL       string      `json:"sql"`
	Params    interface{} `json:"params,omitempty"`
	Page      int         `json:"page,omitempty"`
	Limit     int         `json:"limit,omitempty"`
	ProjectID uint        `json:"project_id,omitempty"`
}

type QueryExecuteResponse struct {
	Columns []string        `json:"columns"`
	Rows    [][]interface{} `json:"rows"`
	Total   int64           `json:"total"`
}

// ExecuteQueryHandler returns a gin handler that runs a read-only SELECT query with pagination
func ExecuteQueryHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req QueryExecuteRequest
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}

		if req.SQL == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "empty sql"})
			return
		}

		if !selectRe.MatchString(req.SQL) {
			// Enforce read-only queries with a clear, consistent message
			c.JSON(http.StatusForbidden, gin.H{"error": "append_only", "message": "Modifications are not allowed. Use append flow."})
			return
		}

		if req.Limit <= 0 || req.Limit > 1000 {
			req.Limit = 250
		}
		if req.Page <= 0 {
			req.Page = 1
		}

		// Determine dialect and current database (for Postgres)
		dialect := ""
		if db != nil && db.Dialector != nil {
			dialect = db.Dialector.Name()
		}
		currentDBName := ""
		if dialect == "postgres" {
			// Try querying current_database(); fallback to parsing env if needed
			var name sql.NullString
			if err := db.Raw("select current_database()").Row().Scan(&name); err == nil && name.Valid {
				currentDBName = name.String
			} else {
				// Optional: parse from env DATABASE_URL
				// postgres://user:pass@host:port/dbname?params
				if dsn := getenv("DATABASE_URL"); dsn != "" {
					if i := strings.LastIndex(dsn, "/"); i != -1 {
						rest := dsn[i+1:]
						if j := strings.Index(rest, "?"); j != -1 {
							rest = rest[:j]
						}
						currentDBName = rest
					}
				}
			}
		}

		// Try to resolve three-part identifiers. If they match current DB, rewrite to schema.table.
		rewrittenSQL, execRemote, remoteDSN, remoteDBForMatch, err := planQueryExecution(db, req.SQL, req.ProjectID, currentDBName, dialect)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Choose DB to execute on
		execDB := db
		if execRemote {
			if strings.TrimSpace(remoteDSN) == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Cross-database query requires Target DSN or FDW/dblink. Configure dataset TargetDSN or set up FDW."})
				return
			}
			// For now, create a transient connection. In future, add pooling/cache.
			rdb, err := gorm.Open(postgres.Open(remoteDSN), &gorm.Config{})
			if err != nil {
				c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("failed connecting to remote DB '%s'", remoteDBForMatch)})
				return
			}
			execDB = rdb
			// Also ensure we drop the db prefix for that remote DB (already handled in planQueryExecution).
		}

		pagedSQL := "SELECT * FROM (" + rewrittenSQL + ") AS q LIMIT ? OFFSET ?"

		ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
		defer cancel()

		rows, err := execDB.WithContext(ctx).Raw(pagedSQL, req.Limit, (req.Page-1)*req.Limit).Rows()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed: " + err.Error()})
			return
		}
		defer rows.Close()

		cols, err := rows.Columns()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read columns"})
			return
		}

		res := QueryExecuteResponse{Columns: cols, Rows: [][]interface{}{}, Total: 0}
		vals := make([]interface{}, len(cols))
		ptrs := make([]interface{}, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		for rows.Next() {
			// reuse ptrs but scan into them
			if err := rows.Scan(ptrs...); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to scan row"})
				return
			}
			// copy row values
			rowCopy := make([]interface{}, len(vals))
			for i := range vals {
				// Convert []byte to string for JSON-friendly output (Postgres text/jsonb can scan as []byte)
				if b, ok := vals[i].([]byte); ok {
					rowCopy[i] = string(b)
				} else {
					rowCopy[i] = vals[i]
				}
			}
			res.Rows = append(res.Rows, rowCopy)
		}

		c.JSON(http.StatusOK, res)
	}
}

// SaveQueryHandler saves a query (skeleton)
func SaveQueryHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var sq models.SavedQuery
		if err := c.BindJSON(&sq); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}
		if sq.ProjectID == 0 || sq.UserID == 0 || sq.SQL == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing fields"})
			return
		}
		if err := db.Create(&sq).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
			return
		}
		c.JSON(http.StatusCreated, sq)
	}
}

// HistoryHandler returns project-specific history (skeleton)
func HistoryHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		projectId := c.Param("projectId")
		var hist []models.QueryHistory
		if err := db.Where("project_id = ?", projectId).Order("created_at desc").Limit(100).Find(&hist).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
			return
		}
		c.JSON(http.StatusOK, hist)
	}
}

// RegisterQueryRoutes mounts query-related routes onto the provided gin engine
func RegisterQueryRoutes(r *gin.Engine, db *gorm.DB) {
	api := r.Group("/api")
	api.POST("/query/execute", ExecuteQueryHandler(db))
	api.GET("/meta/resolve-table", func(c *gin.Context) {
		ident := strings.TrimSpace(c.Query("identifier"))
		projectID := uint(0)
		if v := strings.TrimSpace(c.Query("project_id")); v != "" {
			// naive parse
			var x uint64
			fmt.Sscanf(v, "%d", &x)
			projectID = uint(x)
		}
		dialect := ""
		if db != nil && db.Dialector != nil {
			dialect = db.Dialector.Name()
		}
		currentDBName := ""
		if dialect == "postgres" {
			var name sql.NullString
			_ = db.Raw("select current_database()").Row().Scan(&name)
			if name.Valid {
				currentDBName = name.String
			}
		}
		// Build a faux SQL just to reuse planning on a single identifier
		sqlToPlan := fmt.Sprintf("SELECT * FROM %s", ident)
		_, execRemote, remoteDSN, _, err := planQueryExecution(db, sqlToPlan, projectID, currentDBName, dialect)
		execOn := "local"
		if err != nil {
			execOn = "not_found"
		} else if execRemote {
			if strings.TrimSpace(remoteDSN) == "" {
				execOn = "not_found"
			} else {
				execOn = "remote"
			}
		}
		// Also compute rewrite_to if ident is three-part and db equals currentDB
		rewriteTo := ident
		if dbPart, sch, tbl, ok := splitThreePart(ident); ok {
			if currentDBName != "" && equalIdent(dbPart, currentDBName) {
				rewriteTo = fmt.Sprintf("%s.%s", sch, tbl)
			}
		}
		c.JSON(200, gin.H{
			"exists":    err == nil,
			"requested": ident,
			"resolved": gin.H{
				"execute_on":     execOn,
				"rewrite_to":     rewriteTo,
				"target_dsn_key": nil, // future: if using secret store
			},
			"message": fmt.Sprintf("Resolved to %s", rewriteTo),
		})
	})
	api.POST("/query/python", func(c *gin.Context) {
		c.JSON(http.StatusNotImplemented, gin.H{"error": "python execution not supported server-side"})
	})
	api.POST("/query/save", SaveQueryHandler(db))
	api.GET("/query/history/:projectId", HistoryHandler(db))
}

// --- helpers for identifier planning ---
var threePartRe = regexp.MustCompile(`(?i)(?:\b|\W)("[^"]+"|[a-zA-Z_][\w$]*)\s*\.\s*("[^"]+"|[a-zA-Z_][\w$]*)\s*\.\s*("[^"]+"|[a-zA-Z_][\w$]*)`)

func unquoteIdent(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, `"`) && strings.HasSuffix(s, `"`) && len(s) >= 2 {
		return strings.ReplaceAll(s[1:len(s)-1], `""`, `"`)
	}
	return s
}

func equalIdent(a, b string) bool { return strings.EqualFold(unquoteIdent(a), unquoteIdent(b)) }

func splitThreePart(ident string) (db, schema, table string, ok bool) {
	m := threePartRe.FindStringSubmatch(" " + ident + " ")
	if len(m) == 4 {
		return unquoteIdent(m[1]), unquoteIdent(m[2]), unquoteIdent(m[3]), true
	}
	return "", "", "", false
}

func getenv(k string) string { return strings.TrimSpace(os.Getenv(k)) }

// planQueryExecution returns (rewrittenSQL, execRemote, remoteDSN, remoteDB, error)
func planQueryExecution(db *gorm.DB, sqlText string, projectID uint, currentDBName, dialect string) (string, bool, string, string, error) {
	if sqlText == "" {
		return sqlText, false, "", "", nil
	}
	execRemote := false
	remoteDSN := ""
	remoteDB := ""
	rewritten := threePartRe.ReplaceAllStringFunc(sqlText, func(match string) string {
		// Extract groups again for this match
		mm := threePartRe.FindStringSubmatch(match)
		if len(mm) != 4 {
			return match
		}
		dbPart, sch, tbl := unquoteIdent(mm[1]), unquoteIdent(mm[2]), unquoteIdent(mm[3])
		// If the db equals current DB (for Postgres), drop it
		if currentDBName != "" && strings.EqualFold(dbPart, currentDBName) {
			return fmt.Sprintf("%s.%s", quoteIfNeeded(sch), quoteIfNeeded(tbl))
		}
		// Otherwise attempt to find a dataset mapping and, if TargetDSN exists, plan remote exec
		if projectID != 0 && db != nil {
			var ds models.Dataset
			q := db.Where("project_id = ? AND lower(target_database) = lower(?) AND lower(target_schema) = lower(?) AND lower(target_table) = lower(?)", projectID, dbPart, sch, tbl)
			if err := q.First(&ds).Error; err == nil {
				if strings.TrimSpace(ds.TargetDSN) != "" {
					execRemote = true
					remoteDSN = ds.TargetDSN
					remoteDB = dbPart
					// when executing remotely, drop db prefix as we will connect to that db
					return fmt.Sprintf("%s.%s", quoteIfNeeded(sch), quoteIfNeeded(tbl))
				}
			}
		}
		// No mapping found; keep as-is
		return match
	})

	// If we planned remote without DSN, report error
	if execRemote && strings.TrimSpace(remoteDSN) == "" {
		return rewritten, execRemote, remoteDSN, remoteDB, fmt.Errorf("cross-database query not supported; configure target DSN or FDW/dblink")
	}
	return rewritten, execRemote, remoteDSN, remoteDB, nil
}

func quoteIfNeeded(ident string) string {
	// quote if contains uppercase or special chars
	if ident == "" {
		return ident
	}
	if regexp.MustCompile(`[^a-z0-9_]`).MatchString(strings.ToLower(ident)) || ident != strings.ToLower(ident) {
		// simple double-quote and escape internal quotes
		return `"` + strings.ReplaceAll(ident, `"`, `""`) + `"`
	}
	return ident
}
