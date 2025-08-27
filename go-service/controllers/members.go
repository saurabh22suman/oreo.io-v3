package controllers

import (
    "net/http"
    "strconv"

    "github.com/gin-gonic/gin"
    dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
    "github.com/oreo-io/oreo.io-v2/go-service/models"
)

type MemberIn struct {
    Email string `json:"email" binding:"required,email"`
    Role  string `json:"role" binding:"required,oneof=owner editor approver viewer"`
}

// MembersList returns members for a project (any project role can view)
func MembersList(c *gin.Context) {
    gdb := dbpkg.Get(); if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    pid, _ := strconv.Atoi(c.Param("id"))
    if !HasProjectRole(c, uint(pid), "owner", "editor", "approver", "viewer") { c.JSON(403, gin.H{"error":"forbidden"}); return }
    var roles []models.ProjectRole
    if err := gdb.Where("project_id = ?", pid).Find(&roles).Error; err != nil { c.JSON(500, gin.H{"error":"db"}); return }
    type Member struct { ID uint `json:"id"`; Email string `json:"email"`; Role string `json:"role"` }
    out := make([]Member, 0, len(roles))
    for _, pr := range roles {
        var u models.User
        if err := gdb.First(&u, pr.UserID).Error; err == nil {
            out = append(out, Member{ID: u.ID, Email: u.Email, Role: pr.Role})
        }
    }
    c.JSON(200, out)
}

// MembersUpsert adds or updates a member role (owner only)
func MembersUpsert(c *gin.Context) {
    gdb := dbpkg.Get(); if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    pid, _ := strconv.Atoi(c.Param("id"))
    if !HasProjectRole(c, uint(pid), "owner") { c.JSON(403, gin.H{"error":"forbidden"}); return }
    var in MemberIn
    if err := c.ShouldBindJSON(&in); err != nil { c.JSON(400, gin.H{"error":"invalid_payload"}); return }
    // find or create user by email
    var u models.User
    if err := gdb.Where("email = ?", in.Email).First(&u).Error; err != nil {
        // create with empty password placeholder
        u.Email = in.Email
        if err2 := gdb.Create(&u).Error; err2 != nil { c.JSON(500, gin.H{"error":"db"}); return }
    }
    // upsert project role
    var pr models.ProjectRole
    if err := gdb.Where("project_id = ? AND user_id = ?", pid, u.ID).First(&pr).Error; err != nil {
        pr = models.ProjectRole{ProjectID: uint(pid), UserID: u.ID, Role: in.Role}
        if err := gdb.Create(&pr).Error; err != nil { c.JSON(500, gin.H{"error":"db"}); return }
    } else {
        pr.Role = in.Role
        if err := gdb.Save(&pr).Error; err != nil { c.JSON(500, gin.H{"error":"db"}); return }
    }
    c.JSON(200, gin.H{"id": u.ID, "email": u.Email, "role": pr.Role})
}

// MembersDelete removes a member (owner only)
func MembersDelete(c *gin.Context) {
    gdb := dbpkg.Get(); if gdb == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } ; gdb = dbpkg.Get() }
    pid, _ := strconv.Atoi(c.Param("id"))
    if !HasProjectRole(c, uint(pid), "owner") { c.JSON(403, gin.H{"error":"forbidden"}); return }
    uid, _ := strconv.Atoi(c.Param("userId"))
    if err := gdb.Where("project_id = ? AND user_id = ?", pid, uid).Delete(&models.ProjectRole{}).Error; err != nil {
        c.JSON(500, gin.H{"error":"db"}); return
    }
    c.Status(http.StatusNoContent)
}
