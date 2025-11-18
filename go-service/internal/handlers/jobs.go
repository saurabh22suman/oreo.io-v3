package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/internal/database"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/models"
)

// RegisterJobsRoutes attaches job endpoints to the router
func RegisterJobsRoutes(r *gin.Engine) {
	api := r.Group("/api", AuthMiddleware())
	jobs := api.Group("/jobs")
	{
		jobs.POST("", createJob)
		jobs.GET(":id", getJob)
		jobs.PUT(":id", updateJob)
	}
}

func createJob(c *gin.Context) {
	var j models.Job
	if err := c.ShouldBindJSON(&j); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	if err := gdb.Create(&j).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db_create"})
		return
	}
	c.JSON(http.StatusCreated, j)
}

func getJob(c *gin.Context) {
	id := c.Param("id")
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	var j models.Job
	if err := gdb.First(&j, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}
	c.JSON(http.StatusOK, j)
}

func updateJob(c *gin.Context) {
	id := c.Param("id")
	var patch struct {
		Status string      `json:"status"`
		Result interface{} `json:"result"`
	}
	if err := c.ShouldBindJSON(&patch); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	var j models.Job
	if err := gdb.First(&j, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}
	if patch.Status != "" {
		j.Status = patch.Status
	}
	if patch.Result != nil {
		if rb, err := json.Marshal(patch.Result); err == nil {
			var m map[string]interface{}
			if err2 := json.Unmarshal(rb, &m); err2 == nil {
				j.Result = models.JSONB(m)
			}
		}
	}
	if err := gdb.Save(&j).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db_update"})
		return
	}
	c.JSON(http.StatusOK, j)
}
