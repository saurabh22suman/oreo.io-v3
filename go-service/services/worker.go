package services

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"time"

	"github.com/oreo-io/oreo.io-v2/go-service/db"
	"github.com/oreo-io/oreo.io-v2/go-service/models"
	"gorm.io/gorm"
)

// StartWorker launches a background goroutine that polls the jobs table and
// processes pending jobs. It's simple and intended for development; a real
// production worker would use a separate process and robust locking.
func StartWorker(pollInterval time.Duration) {
	go func() {
		for {
			processOnce()
			time.Sleep(pollInterval)
		}
	}()
}

func processOnce() {
	gdb := db.Get()
	if gdb == nil {
		if _, err := db.Init(); err != nil {
			return
		}
		gdb = db.Get()
	}
	// Find one pending job and claim it (simple transaction)
	var job models.Job
	tx := gdb.Begin()
	if tx.Where("status = ?", "pending").Order("created_at asc").First(&job).Error != nil {
		tx.Rollback()
		return
	}
	job.Status = "running"
	if err := tx.Save(&job).Error; err != nil {
		tx.Rollback()
		return
	}
	tx.Commit()

	// Dispatch by type
	switch job.Type {
	case "infer-schema":
		_ = handleInferSchema(gdb, &job)
	default:
		// mark unknown types as failed
		job.Status = "failed"
		job.Result = models.JSONB{"error": "unknown_job_type"}
		_ = gdb.Save(&job).Error
	}
}

func handleInferSchema(gdb *gorm.DB, job *models.Job) error {
	// Expect metadata to contain path and dataset_id
	pathIface, _ := job.Metadata["path"]
	dsIDIface, _ := job.Metadata["dataset_id"]
	pathStr, _ := pathIface.(string)

	// Call python service /infer-schema with multipart file
	pyBase := os.Getenv("PYTHON_SERVICE_URL")
	if pyBase == "" {
		pyBase = "http://python-service:8000"
	}

	var mpBuf bytes.Buffer
	mw := multipart.NewWriter(&mpBuf)
	fw, _ := mw.CreateFormFile("file", "upload")
	f, err := os.Open(pathStr)
	if err != nil {
		job.Status = "failed"
		job.Result = models.JSONB{"error": "open_file_failed"}
		_ = gdb.Save(job).Error
		return err
	}
	io.Copy(fw, f)
	f.Close()
	mw.Close()

	req, _ := http.NewRequest(http.MethodPost, pyBase+"/infer-schema", &mpBuf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	resp, err := http.DefaultClient.Do(req)
	if err != nil || resp == nil {
		job.Status = "failed"
		job.Result = models.JSONB{"error": "python_unreachable"}
		_ = gdb.Save(job).Error
		return err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	var body any
	_ = json.Unmarshal(b, &body)
	job.Result = models.JSONB{"response": body}

	// If response contains schema, persist to dataset
	if m, ok := body.(map[string]interface{}); ok {
		if schema, ok2 := m["schema"]; ok2 && schema != nil {
			if schemaBytes, err := json.Marshal(schema); err == nil {
				// update dataset schema
				if dsIDIface != nil {
					var dsID uint
					switch v := dsIDIface.(type) {
					case float64:
						dsID = uint(v)
					case int:
						dsID = uint(v)
					case uint:
						dsID = v
					}
					var ds models.Dataset
					if err := gdb.First(&ds, dsID).Error; err == nil {
						ds.Schema = string(schemaBytes)
						_ = gdb.Save(&ds).Error
					}
				}
			}
		}
	}

	job.Status = "success"
	_ = gdb.Save(job).Error
	return nil
}
