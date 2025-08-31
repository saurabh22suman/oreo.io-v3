package main

import (
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/oreo-io/oreo.io-v2/go-service/controllers"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
	"github.com/oreo-io/oreo.io-v2/go-service/models"
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
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err == nil {
			gdb = dbpkg.Get()
		}
	}
	if gdb != nil {
		// Detect Postgres by DATABASE_URL env
		if strings.HasPrefix(strings.ToLower(os.Getenv("DATABASE_URL")), "postgres://") || strings.HasPrefix(strings.ToLower(os.Getenv("DATABASE_URL")), "postgresql://") {
			_ = gdb.Exec("CREATE SCHEMA IF NOT EXISTS sys").Error
		}
		_ = gdb.AutoMigrate(&models.User{}, &models.Project{}, &models.Dataset{}, &models.ProjectRole{}, &models.ChangeRequest{}, &models.ChangeComment{}, &models.DatasetUpload{}, &models.DatasetMeta{}, &models.DatasetVersion{})
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

		// Auth
		api.POST("/auth/register", controllers.Register)
		api.POST("/auth/login", controllers.Login)
		api.POST("/auth/google", controllers.GoogleLogin)
		api.POST("/auth/logout", controllers.Logout)
		api.GET("/auth/me", controllers.AuthMiddleware(), func(c *gin.Context) {
			uid, _ := c.Get("user_id")
			email, _ := c.Get("user_email")
			role, _ := c.Get("user_role")
			c.JSON(http.StatusOK, gin.H{"ok": true, "id": uid, "email": email, "role": role})
		})
		api.POST("/auth/refresh", controllers.AuthMiddleware(), controllers.Refresh)

		// Admin (static password header)
		admin := api.Group("/admin", controllers.AdminMiddleware())
		{
			admin.GET("/users", controllers.AdminUsersList)
			admin.POST("/users", controllers.AdminUsersCreate)
			admin.PUT("/users/:userId", controllers.AdminUsersUpdate)
			admin.DELETE("/users/:userId", controllers.AdminUsersDelete)
		}

		// Projects (protected)
		proj := api.Group("/projects", controllers.AuthMiddleware())
		{
			proj.GET("", controllers.ProjectsList)
			proj.POST("", controllers.ProjectsCreate)
			proj.GET("/:id", controllers.ProjectsGet)
			proj.PUT("/:id", controllers.ProjectsUpdate)
			proj.DELETE("/:id", controllers.ProjectsDelete)

			// Members (RBAC)
			mem := proj.Group("/:id/members")
			{
				mem.GET("", controllers.MembersList)
				mem.GET("/me", controllers.MemberMyRole)
				mem.POST("", controllers.MembersUpsert)
				mem.DELETE("/:userId", controllers.MembersDelete)
			}

			// Datasets nested under a project (use same wildcard name to avoid Gin conflicts)
			ds := proj.Group("/:id/datasets")
			{
				ds.GET("", controllers.DatasetsList)
				ds.POST("", controllers.DatasetsCreate)
				ds.GET("/:datasetId", controllers.DatasetsGet)
				ds.PUT("/:datasetId", controllers.DatasetsUpdate)
				ds.DELETE("/:datasetId", controllers.DatasetsDelete)

				// File uploads for append or schema inference
				ds.POST(":datasetId/upload", controllers.DatasetUpload)
				ds.POST(":datasetId/append", controllers.AppendUpload)
				// New: validate first, then open change with reviewer
				ds.POST(":datasetId/append/validate", controllers.AppendValidate)
				ds.POST(":datasetId/append/open", controllers.AppendOpen)
				// Live preview of file being appended (without storing), and JSON-based append for edited rows
				ds.POST("/:datasetId/append/preview", controllers.AppendPreview)
				ds.POST("/:datasetId/append/json", controllers.AppendJSON)
				// New: validate edited JSON first, returns upload_id
				ds.POST("/:datasetId/append/json/validate", controllers.AppendJSONValidate)
				// Preview sample from last upload
				ds.GET("/:datasetId/sample", controllers.DatasetSample)
				// Change Requests (approvals workflow)
				chg := proj.Group("/:id/changes")
				{
					chg.GET("", controllers.ChangesList)
					chg.POST("/:changeId/approve", controllers.ChangeApprove)
					chg.POST("/:changeId/reject", controllers.ChangeReject)
					chg.POST("/:changeId/withdraw", controllers.ChangeWithdraw)
					chg.GET("/:changeId", controllers.ChangeGet)
					chg.GET("/:changeId/preview", controllers.ChangePreview)
					chg.GET("/:changeId/comments", controllers.ChangeCommentsList)
					chg.POST("/:changeId/comments", controllers.ChangeCommentsCreate)
				}
			}
		}

		// Note: Datasets APIs are currently nested under projects routes.

		// Top-level dataset endpoints
		dsTop := api.Group("/datasets", controllers.AuthMiddleware())
		{
			dsTop.POST("", controllers.DatasetsCreateTop)
			dsTop.GET(":id/schema", controllers.DatasetSchemaGet)
			dsTop.POST(":id/schema", controllers.DatasetSchemaSet)
			dsTop.POST(":id/rules", controllers.DatasetRulesSet)
			dsTop.POST(":id/data/append", controllers.DatasetAppendTop)
			// New top-level mappings for validate/open
			dsTop.POST(":id/data/append/validate", controllers.DatasetAppendValidateTop)
			dsTop.POST(":id/data/append/open", controllers.DatasetAppendOpenTop)
			dsTop.GET(":id/data", controllers.DatasetDataGet)
			dsTop.GET(":id/stats", controllers.DatasetStats)
			dsTop.POST(":id/query", controllers.DatasetQuery)
			// Validate edited JSON (validate-first) and return upload_id
			dsTop.POST(":id/data/append/json/validate", controllers.DatasetAppendJSONValidateTop)
		}

		// Reverse proxy to Python service for data validation
		api.POST("/data/validate", func(c *gin.Context) {
			base := os.Getenv("PYTHON_SERVICE_URL")
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
			base := os.Getenv("PYTHON_SERVICE_URL")
			if strings.TrimSpace(base) == "" {
				base = "http://python-service:8000"
			}
			forwardJSON(c, base+"/transform")
		})

		// Proxy: /data/export -> python /export
		api.POST("/data/export", func(c *gin.Context) {
			base := os.Getenv("PYTHON_SERVICE_URL")
			if strings.TrimSpace(base) == "" {
				base = "http://python-service:8000"
			}
			forwardJSON(c, base+"/export")
		})

		// Proxy: /data/infer-schema -> python /infer-schema (multipart expected)
		api.POST("/data/infer-schema", func(c *gin.Context) {
			base := os.Getenv("PYTHON_SERVICE_URL")
			if strings.TrimSpace(base) == "" {
				base = "http://python-service:8000"
			}
			proxyMultipart(c, base+"/infer-schema")
		})
		// Proxy: /data/rules/validate -> python /rules/validate
		api.POST("/data/rules/validate", func(c *gin.Context) {
			base := os.Getenv("PYTHON_SERVICE_URL")
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
