package controllers

import (
    "strconv"

    "github.com/gin-gonic/gin"
    dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
    "github.com/oreo-io/oreo.io-v2/go-service/models"
)

type ProjectIn struct {
    Name        string `json:"name" binding:"required,min=1"`
    Description string `json:"description"`
}

func ProjectsList(c *gin.Context) {
    gdb := dbpkg.Get()
    if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    var items []models.Project
    // Optionally filter by owner
    if uid, ok := c.Get("user_id"); ok { gdb = gdb.Where("owner_id = ?", uid) }
    if err := gdb.Order("id desc").Find(&items).Error; err != nil { c.JSON(500, gin.H{"error":"db"}); return }
    c.JSON(200, items)
}

func ProjectsCreate(c *gin.Context) {
    gdb := dbpkg.Get()
    if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    var in ProjectIn
    if err := c.ShouldBindJSON(&in); err != nil { c.JSON(400, gin.H{"error":"invalid_payload"}); return }
    var ownerID uint = 0
    if uid, ok := c.Get("user_id"); ok {
        switch v := uid.(type) {
        case float64: ownerID = uint(v)
        case int: ownerID = uint(v)
        case uint: ownerID = v
        }
    }
    p := models.Project{Name: in.Name, Description: in.Description, OwnerID: ownerID}
    if err := gdb.Create(&p).Error; err != nil { c.JSON(409, gin.H{"error":"name_conflict"}); return }
    c.JSON(201, p)
}

func ProjectsGet(c *gin.Context) {
    gdb := dbpkg.Get()
    if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    idStr := c.Param("id")
    id, _ := strconv.Atoi(idStr)
    var p models.Project
    q := gdb
    if uid, ok := c.Get("user_id"); ok { q = q.Where("owner_id = ?", uid) }
    if err := q.First(&p, id).Error; err != nil { c.JSON(404, gin.H{"error":"not_found"}); return }
    c.JSON(200, p)
}

func ProjectsUpdate(c *gin.Context) {
    gdb := dbpkg.Get()
    if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    idStr := c.Param("id")
    id, _ := strconv.Atoi(idStr)
    var p models.Project
    q := gdb
    if uid, ok := c.Get("user_id"); ok { q = q.Where("owner_id = ?", uid) }
    if err := q.First(&p, id).Error; err != nil { c.JSON(404, gin.H{"error":"not_found"}); return }
    var in ProjectIn
    if err := c.ShouldBindJSON(&in); err != nil { c.JSON(400, gin.H{"error":"invalid_payload"}); return }
    p.Name = in.Name
    p.Description = in.Description
    if err := gdb.Save(&p).Error; err != nil { c.JSON(409, gin.H{"error":"name_conflict"}); return }
    c.JSON(200, p)
}

func ProjectsDelete(c *gin.Context) {
    gdb := dbpkg.Get()
    if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    idStr := c.Param("id")
    id, _ := strconv.Atoi(idStr)
    q := gdb.Model(&models.Project{})
    if uid, ok := c.Get("user_id"); ok { q = q.Where("owner_id = ?", uid) }
    if err := q.Where("id = ?", id).Delete(&models.Project{}).Error; err != nil { c.JSON(500, gin.H{"error":"db"}); return }
    c.Status(204)
}
