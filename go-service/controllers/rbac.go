package controllers

import (
    "strings"

    "github.com/gin-gonic/gin"
    dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
    "github.com/oreo-io/oreo.io-v2/go-service/models"
)

// HasProjectRole checks if the current user has any of the roles for the given project id.
func HasProjectRole(c *gin.Context, projectID uint, roles ...string) bool {
    uidVal, ok := c.Get("user_id")
    if !ok { return false }
    var uid uint
    switch v := uidVal.(type) { case float64: uid = uint(v); case int: uid = uint(v); case uint: uid = v }
    if uid == 0 { return false }
    gdb := dbpkg.Get(); if gdb == nil { if _, err := dbpkg.Init(); err != nil { return false } ; gdb = dbpkg.Get() }
    var pr models.ProjectRole
    if err := gdb.Where("project_id = ? AND user_id = ?", projectID, uid).First(&pr).Error; err != nil { return false }
    if len(roles) == 0 { return true }
    r := strings.ToLower(pr.Role)
    for _, want := range roles {
        if r == strings.ToLower(want) { return true }
    }
    return false
}
