package controllers

import (
    "net/http"
    "strconv"
    "time"

    "github.com/gin-gonic/gin"
    dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
    "github.com/oreo-io/oreo.io-v2/go-service/models"
)

// ChangesList lists change requests for a project
func ChangesList(c *gin.Context) {
    gdb := dbpkg.Get(); if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    pidStr := c.Param("id"); if pidStr == "" { pidStr = c.Param("projectId") }
    pid, _ := strconv.Atoi(pidStr)
    if !HasProjectRole(c, uint(pid), "owner", "editor", "approver", "viewer") { c.JSON(http.StatusForbidden, gin.H{"error":"forbidden"}); return }
    var items []models.ChangeRequest
    if err := gdb.Where("project_id = ?", pid).Order("id desc").Find(&items).Error; err != nil { c.JSON(500, gin.H{"error":"db"}); return }
    c.JSON(200, items)
}

// ChangeApprove approves a pending change request and applies it
func ChangeApprove(c *gin.Context) {
    gdb := dbpkg.Get(); if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    pidStr := c.Param("id"); if pidStr == "" { pidStr = c.Param("projectId") }
    pid, _ := strconv.Atoi(pidStr)
    if !HasProjectRole(c, uint(pid), "owner", "approver") { c.JSON(http.StatusForbidden, gin.H{"error":"forbidden"}); return }
    changeID, _ := strconv.Atoi(c.Param("changeId"))

    var cr models.ChangeRequest
    if err := gdb.Where("project_id = ?", pid).First(&cr, changeID).Error; err != nil { c.JSON(404, gin.H{"error":"not_found"}); return }
    if cr.Status != "pending" { c.JSON(409, gin.H{"error":"not_pending"}); return }

    // Apply according to type. For append, we set dataset's last upload to the payload path.
    if cr.Type == "append" {
        var ds models.Dataset
        if err := gdb.Where("project_id = ?", pid).First(&ds, cr.DatasetID).Error; err != nil { c.JSON(404, gin.H{"error":"dataset_not_found"}); return }
        now := time.Now()
        ds.LastUploadPath = cr.Payload
        ds.LastUploadAt = &now
        if err := gdb.Save(&ds).Error; err != nil { c.JSON(500, gin.H{"error":"db"}); return }
        cr.Status = "approved"
        cr.Summary = "Applied append at " + now.Format(time.RFC3339)
        if err := gdb.Save(&cr).Error; err != nil { c.JSON(500, gin.H{"error":"db"}); return }
        c.JSON(200, gin.H{"ok": true, "change_request": cr})
        return
    }

    // Unknown type: mark approved without side effects for now
    cr.Status = "approved"
    if err := gdb.Save(&cr).Error; err != nil { c.JSON(500, gin.H{"error":"db"}); return }
    c.JSON(200, gin.H{"ok": true, "change_request": cr})
}

// ChangeReject rejects a pending change request
func ChangeReject(c *gin.Context) {
    gdb := dbpkg.Get(); if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    pidStr := c.Param("id"); if pidStr == "" { pidStr = c.Param("projectId") }
    pid, _ := strconv.Atoi(pidStr)
    if !HasProjectRole(c, uint(pid), "owner", "approver") { c.JSON(http.StatusForbidden, gin.H{"error":"forbidden"}); return }
    changeID, _ := strconv.Atoi(c.Param("changeId"))
    var cr models.ChangeRequest
    if err := gdb.Where("project_id = ?", pid).First(&cr, changeID).Error; err != nil { c.JSON(404, gin.H{"error":"not_found"}); return }
    if cr.Status != "pending" { c.JSON(409, gin.H{"error":"not_pending"}); return }
    cr.Status = "rejected"
    if err := gdb.Save(&cr).Error; err != nil { c.JSON(500, gin.H{"error":"db"}); return }
    c.JSON(200, gin.H{"ok": true, "change_request": cr})
}
