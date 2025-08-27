package controllers

import (
    "strconv"

    "github.com/gin-gonic/gin"
    dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
    "github.com/oreo-io/oreo.io-v2/go-service/models"
)

type DatasetIn struct {
    Name   string `json:"name" binding:"required,min=1"`
    Schema string `json:"schema"`
}

// List datasets within a project
func DatasetsList(c *gin.Context) {
    gdb := dbpkg.Get(); if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    pid, _ := strconv.Atoi(c.Param("projectId"))
    var items []models.Dataset
    if err := gdb.Where("project_id = ?", pid).Order("id desc").Find(&items).Error; err != nil { c.JSON(500, gin.H{"error":"db"}); return }
    c.JSON(200, items)
}

func DatasetsCreate(c *gin.Context) {
    gdb := dbpkg.Get(); if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    pid, _ := strconv.Atoi(c.Param("projectId"))
    var in DatasetIn
    if err := c.ShouldBindJSON(&in); err != nil { c.JSON(400, gin.H{"error":"invalid_payload"}); return }
    ds := models.Dataset{ProjectID: uint(pid), Name: in.Name, Schema: in.Schema}
    if err := gdb.Create(&ds).Error; err != nil { c.JSON(409, gin.H{"error":"name_conflict"}); return }
    c.JSON(201, ds)
}

func DatasetsGet(c *gin.Context) {
    gdb := dbpkg.Get(); if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    pid, _ := strconv.Atoi(c.Param("projectId"))
    id, _ := strconv.Atoi(c.Param("datasetId"))
    var ds models.Dataset
    if err := gdb.Where("project_id = ?", pid).First(&ds, id).Error; err != nil { c.JSON(404, gin.H{"error":"not_found"}); return }
    c.JSON(200, ds)
}

func DatasetsUpdate(c *gin.Context) {
    gdb := dbpkg.Get(); if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    pid, _ := strconv.Atoi(c.Param("projectId"))
    id, _ := strconv.Atoi(c.Param("datasetId"))
    var ds models.Dataset
    if err := gdb.Where("project_id = ?", pid).First(&ds, id).Error; err != nil { c.JSON(404, gin.H{"error":"not_found"}); return }
    var in DatasetIn
    if err := c.ShouldBindJSON(&in); err != nil { c.JSON(400, gin.H{"error":"invalid_payload"}); return }
    ds.Name = in.Name
    ds.Schema = in.Schema
    if err := gdb.Save(&ds).Error; err != nil { c.JSON(409, gin.H{"error":"name_conflict"}); return }
    c.JSON(200, ds)
}

func DatasetsDelete(c *gin.Context) {
    gdb := dbpkg.Get(); if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    pid, _ := strconv.Atoi(c.Param("projectId"))
    id, _ := strconv.Atoi(c.Param("datasetId"))
    if err := gdb.Where("project_id = ?", pid).Delete(&models.Dataset{}, id).Error; err != nil { c.JSON(500, gin.H{"error":"db"}); return }
    c.Status(204)
}
