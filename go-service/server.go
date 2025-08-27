package main

import (
    "io"
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
    if _, err := dbpkg.Init(); err == nil {
        _ = dbpkg.Get().AutoMigrate(&models.User{})
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
        api.GET("/auth/me", controllers.AuthMiddleware(), func(c *gin.Context) {
            c.JSON(http.StatusOK, gin.H{"ok": true})
        })
    api.POST("/auth/refresh", controllers.AuthMiddleware(), controllers.Refresh)

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
    }

    return r
}
