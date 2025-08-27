package db

import (
	"fmt"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var globalDB *gorm.DB

func Init() (*gorm.DB, error) {
	dsn := os.Getenv("DATABASE_URL")
	var gdb *gorm.DB
	var err error
	if dsn != "" {
		gdb, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
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
