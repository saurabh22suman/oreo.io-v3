package db

import (
	"fmt"
	"log"
	"os"
	"time"

	"gorm.io/driver/postgres"
	// Use pure-Go SQLite driver to avoid CGO requirement in local/tests
	sqlite "github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

var globalDB *gorm.DB

func Init() (*gorm.DB, error) {
	dsn := os.Getenv("DATABASE_URL")
	metaPath := os.Getenv("METADATA_DB")
	var gdb *gorm.DB
	var err error
	if metaPath != "" {
		// Prefer a file-based SQLite metadata store if provided (migration step away from Postgres)
		gdb, err = gorm.Open(sqlite.Open(metaPath), &gorm.Config{})
		if err != nil {
			return nil, fmt.Errorf("sqlite connect (%s): %w", metaPath, err)
		}
	} else if dsn != "" {
		// Retry connect to Postgres to handle container startup races
		const maxAttempts = 30
		for i := 1; i <= maxAttempts; i++ {
			gdb, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
			if err == nil {
				break
			}
			if i == 1 {
				log.Printf("[db] waiting for Postgres: %v", err)
			}
			time.Sleep(1 * time.Second)
		}
		if err != nil {
			return nil, fmt.Errorf("postgres connect: %w", err)
		}
	} else {
		// Fallback for tests/local without DB
		gdb, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
		if err != nil {
			return nil, fmt.Errorf("sqlite connect: %w", err)
		}
	}
	globalDB = gdb
	return gdb, nil
}

func Get() *gorm.DB { return globalDB }

// Set allows tests to inject a DB.
func Set(gdb *gorm.DB) { globalDB = gdb }
