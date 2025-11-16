package controllers

import (
    "testing"

    dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
    "github.com/oreo-io/oreo.io-v2/go-service/models"
    sqlite "github.com/glebarez/sqlite"
    "gorm.io/gorm"
)

// Test that when using sqlite as the metadata store, we emulate schemas by joining with underscore,
// and when no DB is set (non-sqlite path), we default to schema.table.
func TestDatasetPhysicalTable_SqliteSchemaEmulation(t *testing.T) {
    ds := &models.Dataset{TargetSchema: "test", TargetTable: "pollution"}

    // Case 1: sqlite in-memory DB -> expect underscore join
    gdb, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
    if err != nil {
        t.Fatalf("open sqlite: %v", err)
    }
    dbpkg.Set(gdb)
    got := datasetPhysicalTable(ds)
    if want := "test_pollution"; got != want {
        t.Fatalf("sqlite naming mismatch: got %q, want %q", got, want)
    }

    // Case 2: nil DB (non-sqlite path) -> expect schema.table
    dbpkg.Set(nil)
    got = datasetPhysicalTable(ds)
    if want := "test.pollution"; got != want {
        t.Fatalf("non-sqlite naming mismatch: got %q, want %q", got, want)
    }
}
