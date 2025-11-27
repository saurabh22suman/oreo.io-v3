package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/internal/database"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/config"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/models"
)

// ChangeGet returns a single change request with basic info
func ChangeGet(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pid, _ := strconv.Atoi(c.Param("id"))
	if !HasProjectRole(c, uint(pid), "owner", "contributor", "viewer") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	changeID, _ := strconv.Atoi(c.Param("changeId"))
	var cr models.ChangeRequest
	if err := gdb.Where("project_id = ?", pid).First(&cr, changeID).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}
	// Add reviewer email(s) for display
	var reviewerEmail string
	var reviewerEmails []string
	// Add requester info
	var requestorEmail string
	var requestorName string
	// Enriched reviewer states if available
	var reviewerStates any
	if cr.ReviewerID != 0 {
		var u models.User
		if err := gdb.First(&u, cr.ReviewerID).Error; err == nil {
			reviewerEmail = u.Email
		}
	}
	// Lookup requester
	if cr.UserID != 0 {
		var u models.User
		if err := gdb.First(&u, cr.UserID).Error; err == nil {
			requestorEmail = u.Email
			requestorName = u.Name
		}
	}
	if strings.TrimSpace(cr.Reviewers) != "" {
		// cr.Reviewers stores a JSON array of user IDs
		var ids []uint
		_ = json.Unmarshal([]byte(cr.Reviewers), &ids)
		if len(ids) > 0 {
			var users []models.User
			if err := gdb.Where("id IN ?", ids).Find(&users).Error; err == nil {
				for _, u := range users {
					reviewerEmails = append(reviewerEmails, u.Email)
				}
			}
		}
	}
	if strings.TrimSpace(cr.ReviewerStates) != "" {
		var states []map[string]any
		_ = json.Unmarshal([]byte(cr.ReviewerStates), &states)
		// attach emails for each id
		if len(states) > 0 {
			idSet := []uint{}
			for _, st := range states {
				if idv, ok := st["id"].(float64); ok {
					idSet = append(idSet, uint(idv))
				} else if idu, ok := st["id"].(uint); ok {
					idSet = append(idSet, idu)
				}
			}
			if len(idSet) > 0 {
				var users []models.User
				if err := gdb.Where("id IN ?", idSet).Find(&users).Error; err == nil {
					emailMap := map[uint]string{}
					for _, u := range users {
						emailMap[u.ID] = u.Email
					}
					for _, st := range states {
						if idv, ok := st["id"].(float64); ok {
							st["email"] = emailMap[uint(idv)]
						} else if idu, ok := st["id"].(uint); ok {
							st["email"] = emailMap[idu]
						}
					}
				}
			}
		}
		reviewerStates = states
	}
	c.JSON(200, gin.H{"change": cr, "reviewer_email": reviewerEmail, "reviewer_emails": reviewerEmails, "reviewer_states": reviewerStates, "requestor_email": requestorEmail, "requestor_name": requestorName})
}

// ChangePreview streams a JSON preview for append-type change using stored payload path
func ChangePreview(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pid, _ := strconv.Atoi(c.Param("id"))
	if !HasProjectRole(c, uint(pid), "owner", "contributor", "viewer") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	changeID, _ := strconv.Atoi(c.Param("changeId"))
	var cr models.ChangeRequest
	if err := gdb.Where("project_id = ?", pid).First(&cr, changeID).Error; err != nil {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}
	if cr.Type != "append" || cr.Payload == "" {
		c.JSON(400, gin.H{"error": "no_preview"})
		return
	}
	// Load upload bytes from DB
	var payload struct {
		UploadID uint   `json:"upload_id"`
		Filename string `json:"filename"`
	}
	_ = json.Unmarshal([]byte(cr.Payload), &payload)
	if payload.UploadID == 0 {
		c.JSON(400, gin.H{"error": "no_upload_ref"})
		return
	}
	var up models.DatasetUpload
	if err := gdb.Where("project_id = ? AND id = ?", pid, payload.UploadID).First(&up).Error; err != nil {
		c.JSON(404, gin.H{"error": "upload_not_found"})
		return
	}
	filename := payload.Filename
	if filename == "" {
		filename = "upload.csv"
	}
	// If upload is JSON, parse locally for preview (python /sample handles CSV/XLSX only)
	lower := strings.ToLower(filepath.Ext(filename))
	if lower == ".json" || (len(up.Content) > 0 && (up.Content[0] == '{' || up.Content[0] == '[')) {
		// Try to unmarshal into array of objects
		var arr []map[string]any
		if err := json.Unmarshal(up.Content, &arr); err == nil {
			// Build columns set
			colsSet := map[string]struct{}{}
			for _, obj := range arr {
				for k := range obj {
					colsSet[k] = struct{}{}
				}
			}
			cols := make([]string, 0, len(colsSet))
			for k := range colsSet {
				cols = append(cols, k)
			}
			// Limit rows for preview
			max := 500
			if len(arr) > max {
				arr = arr[:max]
			}
			c.JSON(200, gin.H{"data": arr, "columns": cols, "rows": len(arr), "total_rows": len(arr)})
			return
		}
		// Fallback to empty preview on JSON parse failure
		c.JSON(200, gin.H{"data": []any{}, "columns": []string{}, "rows": 0, "total_rows": 0})
		return
	}
	// Otherwise, forward to python /sample for CSV/XLSX
	cfg := config.Get(); base := cfg.PythonServiceURL
	if base == "" {
		base = "http://python-service:8000"
	}
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, _ := mw.CreateFormFile("file", filepath.Base(filename))
	io.Copy(fw, bytes.NewReader(up.Content))
	mw.Close()
	req, _ := http.NewRequest(http.MethodPost, base+"/sample", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	resp, err := http.DefaultClient.Do(req)
	if err != nil || resp == nil {
		c.JSON(502, gin.H{"error": "python_unreachable"})
		return
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", b)
}

// ChangeCommentsList lists comments for a change
func ChangeCommentsList(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pid, _ := strconv.Atoi(c.Param("id"))
	if !HasProjectRole(c, uint(pid), "owner", "contributor", "viewer") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	changeID, _ := strconv.Atoi(c.Param("changeId"))
	var items []models.ChangeComment
	if err := gdb.Where("project_id = ? AND change_request_id = ?", pid, changeID).Order("id asc").Find(&items).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	// Attach user emails and names
	idSet := make([]uint, 0, len(items))
	m := map[uint]bool{}
	for _, it := range items {
		if it.UserID != 0 && !m[it.UserID] {
			idSet = append(idSet, it.UserID)
			m[it.UserID] = true
		}
	}
	emailMap := map[uint]string{}
	nameMap := map[uint]string{}
	if len(idSet) > 0 {
		var users []models.User
		if err := gdb.Where("id IN ?", idSet).Find(&users).Error; err == nil {
			for _, u := range users {
				emailMap[u.ID] = u.Email
				nameMap[u.ID] = u.Name
			}
		}
	}
	out := make([]gin.H, 0, len(items))
	for _, it := range items {
		out = append(out, gin.H{
			"id":                it.ID,
			"project_id":        it.ProjectID,
			"change_request_id": it.ChangeRequestID,
			"user_id":           it.UserID,
			"user_email":        emailMap[it.UserID],
			"user_name":         nameMap[it.UserID],
			"body":              it.Body,
			"created_at":        it.CreatedAt,
		})
	}
	c.JSON(200, out)
}

// ChangeCommentsCreate adds a new comment
func ChangeCommentsCreate(c *gin.Context) {
	gdb := dbpkg.Get()
	if gdb == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
		gdb = dbpkg.Get()
	}
	pid, _ := strconv.Atoi(c.Param("id"))
	if !HasProjectRole(c, uint(pid), "owner", "contributor", "viewer") {
		c.JSON(403, gin.H{"error": "forbidden"})
		return
	}
	changeID, _ := strconv.Atoi(c.Param("changeId"))
	var body struct {
		Body string `json:"body"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Body) == "" {
		c.JSON(400, gin.H{"error": "invalid"})
		return
	}
	cc := models.ChangeComment{ProjectID: uint(pid), ChangeRequestID: uint(changeID), Body: body.Body}
	if uid, ok := c.Get("user_id"); ok {
		switch v := uid.(type) {
		case float64:
			cc.UserID = uint(v)
		case int:
			cc.UserID = uint(v)
		case uint:
			cc.UserID = v
		}
	}
	if err := gdb.Create(&cc).Error; err != nil {
		c.JSON(500, gin.H{"error": "db"})
		return
	}
	// include user_email and user_name in response
	var email, name string
	if cc.UserID != 0 {
		var u models.User
		if err := gdb.First(&u, cc.UserID).Error; err == nil {
			email = u.Email
			name = u.Name
		}
	}
	c.JSON(201, gin.H{"id": cc.ID, "project_id": cc.ProjectID, "change_request_id": cc.ChangeRequestID, "user_id": cc.UserID, "user_email": email, "user_name": name, "body": cc.Body, "created_at": cc.CreatedAt})
}
