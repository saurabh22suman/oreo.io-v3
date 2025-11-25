package handlers

import (
	"io"
	"mime/multipart"
	"net/http"
	"strings"

	"time"

	"github.com/gin-gonic/gin"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/config"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/internal/database"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/models"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/service"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/storage"
)

// SetupRouter configures the Gin engine. Exposed for tests.
func SetupRouter() *gin.Engine {
	r := gin.Default()
	// Allow multipart parsing up to ~110 MiB (slightly above our 100 MB limit) before spilling to disk
	r.MaxMultipartMemory = 110 << 20
	// Simple CORS for dev
	r.Use(func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		// Simple allowlist: allow frontend dev origin and localhost
		allowed := map[string]bool{
			"http://localhost:5173": true,
			"http://127.0.0.1:5173": true,
			"http://localhost:3000": true,
		}
		if origin != "" && allowed[origin] {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			// fallback to request host if no origin matched
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		}
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(200)
			return
		}
		c.Next()
	})

	// Initialize storage adapter (DEFAULT_STORAGE_BACKEND="delta" or "postgres") once and inject into context
	cfg := config.Get()
	backendName := strings.ToLower(strings.TrimSpace(cfg.DefaultStorageBackend))
	if backendName == "" { backendName = "postgres" }
	adapter := storage.NewAdapter(backendName)
	r.Use(func(c *gin.Context) { c.Set("storage_adapter", adapter); c.Next() })
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err == nil {
			gdb = dbpkg.Get()
		}
	}
	if gdb != nil {
		// Detect Postgres by DATABASE_URL env
		if strings.HasPrefix(strings.ToLower(cfg.DatabaseURL), "postgres://") || strings.HasPrefix(strings.ToLower(cfg.DatabaseURL), "postgresql://") {
			_ = gdb.Exec("CREATE SCHEMA IF NOT EXISTS sys").Error
		}
		_ = gdb.AutoMigrate(
			&models.User{},
			&models.Project{},
			&models.Dataset{},
			&models.ProjectRole{},
			&models.ChangeRequest{},
			&models.ChangeComment{},
			&models.DatasetUpload{},
			&models.DatasetMeta{},
			&models.DatasetVersion{},
			&models.SavedQuery{},
			&models.QueryHistory{},
			// Ensure supporting tables exist in dev/test
			&models.Notification{},
			&models.ProjectActivity{},
			&models.DataQualityRule{},
			&models.DataQualityResult{},
			&models.AuditEvent{},
		)

		// Only migrate jobs table and start worker when using Postgres (skip for sqlite tests)
		if gdb.Dialector != nil && strings.EqualFold(gdb.Dialector.Name(), "postgres") {
			_ = gdb.AutoMigrate(&models.Job{})
			if !cfg.DisableWorker {
				// Start background worker for dev (poll every 2s)
				services.StartWorker(2 * time.Second)
			}
		}
	}
	// Static UI for quick auth testing
	r.Static("/ui", "./static")

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := r.Group("/api")
	{
		api.GET("/ping", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "pong"})
		})

		// Introspection: report active storage backend (used in tests & ops diagnostics)
		api.GET("/storage/backend", func(c *gin.Context) {
			a, _ := c.Get("storage_adapter")
			name := "unknown"
			switch a.(type) {
			case *storage.DeltaAdapter:
				name = "delta"
			case *storage.PostgresAdapter:
				name = "postgres"
			}
			c.JSON(http.StatusOK, gin.H{"backend": name})
		})

		// Adapter-backed query endpoint (minimal example for T001)
		api.POST("/query/adapter", func(c *gin.Context) {
			var payload struct {
				SQL   string `json:"sql"`
				Limit int    `json:"limit"`
			}
			if err := c.ShouldBindJSON(&payload); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid json"})
				return
			}
			a := storage.GetAdapter(c)
			res, err := a.Query(c.Request.Context(), storage.QueryRequest{SQL: payload.SQL, Limit: payload.Limit})
			if err != nil {
				c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"columns": res.Columns, "rows": res.Rows})
		})

		// Auth
		api.POST("/auth/register", Register)
		api.POST("/auth/login", Login)
		api.POST("/auth/google", GoogleLogin)
		api.POST("/auth/logout", Logout)
		api.GET("/auth/me", AuthMiddleware(), func(c *gin.Context) {
			uid, _ := c.Get("user_id")
			email, _ := c.Get("user_email")
			role, _ := c.Get("user_role")
			c.JSON(http.StatusOK, gin.H{"ok": true, "id": uid, "email": email, "role": role})
		})

		// User settings (profile & preferences)
		me := api.Group("/me", AuthMiddleware())
		{
			me.GET("/profile", MeProfile)
			me.PUT("/profile", MeProfileUpdate)
			me.GET("/preferences", MePreferencesGet)
			me.PUT("/preferences", MePreferencesUpdate)
		}
		api.POST("/auth/refresh", AuthMiddleware(), Refresh)

		// Admin (static password header)
		admin := api.Group("/admin", AdminMiddleware())
		{
			admin.GET("/users", AdminUsersList)
			admin.POST("/users", AdminUsersCreate)
			admin.PUT("/users/:userId", AdminUsersUpdate)
			admin.DELETE("/users/:userId", AdminUsersDelete)
			// Delta maintenance utilities
			admin.GET("/delta/ls", AdminDeltaList)
		}

		// Utility: check if a physical table exists
		api.GET("/check_table_exists", CheckTableExists)

		// Projects (protected)
		proj := api.Group("/projects", AuthMiddleware())
		{
			proj.GET("", ProjectsList)
			proj.POST("", ProjectsCreate)
			proj.GET("/:id", ProjectsGet)
			proj.PUT("/:id", ProjectsUpdate)
			proj.DELETE("/:id", ProjectsDelete)

			// Members (RBAC)
			mem := proj.Group("/:id/members")
			{
				mem.GET("", MembersList)
				mem.GET("/me", MemberMyRole)
				mem.POST("", MembersUpsert)
				mem.DELETE("/:userId", MembersDelete)
			}

			// Datasets nested under a project (use same wildcard name to avoid Gin conflicts)
			ds := proj.Group("/:id/datasets")
			{
				ds.GET("", DatasetsList)
				ds.POST("", DatasetsCreate)
				ds.GET("/:datasetId", DatasetsGet)
				ds.PUT("/:datasetId", DatasetsUpdate)
				ds.DELETE("/:datasetId", DatasetsDelete)

				// File uploads for append or schema inference
				ds.POST(":datasetId/upload", DatasetUpload)
				ds.POST(":datasetId/append", AppendUpload)
				// New: validate first, then open change with reviewer
				ds.POST(":datasetId/append/validate", AppendValidate)
				ds.POST(":datasetId/append/open", AppendOpen)
				// Live preview of file being appended (without storing), and JSON-based append for edited rows
				ds.POST("/:datasetId/append/preview", AppendPreview)
				ds.POST("/:datasetId/append/json", AppendJSON)
				// New: validate edited JSON first, returns upload_id
				ds.POST("/:datasetId/append/json/validate", AppendJSONValidate)
				// Preview sample from last upload
				ds.GET("/:datasetId/sample", DatasetSample)
				// Change Requests (approvals workflow)
				chg := proj.Group("/:id/changes")
				{
					chg.GET("", ChangesList)
					chg.POST("/:changeId/approve", ChangeApprove)
					chg.POST("/:changeId/reject", ChangeReject)
					chg.POST("/:changeId/withdraw", ChangeWithdraw)
					chg.GET("/:changeId", ChangeGet)
					chg.GET("/:changeId/preview", ChangePreview)
					chg.GET("/:changeId/comments", ChangeCommentsList)
					chg.POST("/:changeId/comments", ChangeCommentsCreate)
				}
			}
		}

		// Query APIs (project-agnostic endpoints)
		RegisterQueryRoutes(r, gdb)

		// Security & governance routes
		RegisterSecurityRoutes(r)
		// Jobs (background tasks)
		RegisterJobsRoutes(r)
		// Audit routes (dataset timeline & event details)
		RegisterAuditRoutes(r)

		// Note: Datasets APIs are currently nested under projects routes.

		// Top-level dataset endpoints
		dsTop := api.Group("/datasets", AuthMiddleware())
		{
			dsTop.POST("", DatasetsCreateTop)
			dsTop.POST("/prepare", DatasetsPrepare)
			// Staged upload flow (two-step creation)
			dsTop.POST("/stage-upload", DatasetsStageUpload)
			dsTop.POST("/finalize", DatasetsFinalize)
			dsTop.DELETE("/staging/:staging_id", DatasetsStageDelete)
			dsTop.GET(":id/schema", DatasetSchemaGet)
			dsTop.POST(":id/schema", DatasetSchemaSet)
			dsTop.POST(":id/rules", DatasetRulesSet)
			dsTop.POST(":id/data/append", DatasetAppendTop)
			// New top-level mappings for validate/open
			dsTop.POST(":id/data/append/validate", DatasetAppendValidateTop)
			dsTop.POST(":id/data/append/open", DatasetAppendOpenTop)
			dsTop.GET(":id/data", DatasetDataGet)
			dsTop.GET(":id/stats", DatasetStats)
			// Dataset-level approvals listing (filterable by status)
			dsTop.GET(":id/approvals", DatasetApprovalsListTop)
			dsTop.POST(":id/query", DatasetQuery)
			// Validate edited JSON (validate-first) and return upload_id
			dsTop.POST(":id/data/append/json/validate", DatasetAppendJSONValidateTop)
		}

		// Reverse proxy to Python service for data validation
		api.POST("/data/validate", func(c *gin.Context) {
			base := cfg.PythonServiceURL
			if strings.TrimSpace(base) == "" {
				base = "http://python-service:8000"
			}
			target := base + "/validate"

			body, err := io.ReadAll(c.Request.Body)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
				return
			}
			req, err := http.NewRequest(http.MethodPost, target, strings.NewReader(string(body)))
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "request build failed"})
				return
			}
			req.Header.Set("Content-Type", "application/json")
			client := &http.Client{}
			resp, err := client.Do(req)
			if err != nil {
				c.JSON(http.StatusBadGateway, gin.H{"error": "python service unreachable"})
				return
			}
			defer resp.Body.Close()
			respBody, _ := io.ReadAll(resp.Body)
			c.Data(resp.StatusCode, "application/json", respBody)
		})

		// Proxy: /data/transform -> python /transform
		api.POST("/data/transform", func(c *gin.Context) {
			base := cfg.PythonServiceURL
			if strings.TrimSpace(base) == "" {
				base = "http://python-service:8000"
			}
			forwardJSON(c, base+"/transform")
		})

		// Proxy: /data/export -> python /export
		api.POST("/data/export", func(c *gin.Context) {
			base := cfg.PythonServiceURL
			if strings.TrimSpace(base) == "" {
				base = "http://python-service:8000"
			}
			forwardJSON(c, base+"/export")
		})

		// Proxy: /data/infer-schema -> python /infer-schema (multipart expected)
		api.POST("/data/infer-schema", func(c *gin.Context) {
			base := cfg.PythonServiceURL
			if strings.TrimSpace(base) == "" {
				base = "http://python-service:8000"
			}
			proxyMultipart(c, base+"/infer-schema")
		})
		// Proxy: /data/rules/validate -> python /rules/validate
		api.POST("/data/rules/validate", func(c *gin.Context) {
			base := cfg.PythonServiceURL
			if strings.TrimSpace(base) == "" {
				base = "http://python-service:8000"
			}
			forwardJSON(c, base+"/rules/validate")
		})
	}

	return r
}

// forwardJSON sends the incoming JSON body to target and streams back the JSON response
func forwardJSON(c *gin.Context, target string) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	req, err := http.NewRequest(http.MethodPost, target, strings.NewReader(string(body)))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "request build failed"})
		return
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "python service unreachable"})
		return
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", respBody)
}

// proxyMultipart forwards a multipart/form-data request body to target and streams the JSON response back
func proxyMultipart(c *gin.Context, target string) {
	// gin already parsed multipart in memory/disk as needed; we need to rebuild the body for forwarding
	// Simpler: read the raw request body as-is and forward with same content type
	// However, Gin may have consumed it; use c.Request.Body directly (it still contains the form stream for single pass)
	// To be safe, we reparse the uploaded file(s) and rebuild the multipart body.
	mr, err := c.Request.MultipartReader()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid multipart"})
		return
	}
	// Rebuild multipart
	pr, pw := io.Pipe()
	mw := multipart.NewWriter(pw)
	go func() {
		defer pw.Close()
		for {
			part, perr := mr.NextPart()
			if perr == io.EOF {
				break
			}
			if perr != nil {
				_ = mw.Close()
				return
			}
			if part.FileName() != "" {
				fw, _ := mw.CreateFormFile(part.FormName(), part.FileName())
				io.Copy(fw, part)
			} else {
				fw, _ := mw.CreateFormField(part.FormName())
				io.Copy(fw, part)
			}
			part.Close()
		}
		_ = mw.Close()
	}()
	req, err := http.NewRequest(http.MethodPost, target, pr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "request build failed"})
		return
	}
	req.Header.Set("Content-Type", mw.FormDataContentType())
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "python service unreachable"})
		return
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", respBody)
}
