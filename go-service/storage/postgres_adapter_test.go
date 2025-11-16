package storage

import (
    "context"
    "testing"

    dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
)

func ensureDB(t *testing.T) {
    t.Helper()
    if dbpkg.Get() == nil {
        if _, err := dbpkg.Init(); err != nil {
            t.Fatalf("db init failed: %v", err)
        }
    }
}

func TestPostgresAdapter_Insert(t *testing.T) {
    ensureDB(t)
    a := &PostgresAdapter{}
    rows := []map[string]interface{}{
        {"id": 1, "name": "alice"},
        {"id": 2, "name": "bob"},
    }
    if err := a.Insert(context.Background(), "t_insert", rows); err != nil {
        t.Fatalf("insert failed: %v", err)
    }
    // verify count
    gdb := dbpkg.Get()
    var cnt int64
    if err := gdb.Raw("select count(*) from t_insert").Scan(&cnt).Error; err != nil {
        t.Fatalf("count failed: %v", err)
    }
    if cnt != 2 {
        t.Fatalf("expected 2 rows, got %d", cnt)
    }
}

func TestPostgresAdapter_Query(t *testing.T) {
    ensureDB(t)
    a := &PostgresAdapter{}
    // prepare table and data
    gdb := dbpkg.Get()
    _ = gdb.Exec("DROP TABLE IF EXISTS t_adpt").Error
    if err := gdb.Exec("CREATE TABLE t_adpt (id INTEGER, name TEXT)").Error; err != nil {
        t.Fatalf("create failed: %v", err)
    }
    _ = gdb.Exec("INSERT INTO t_adpt (id,name) VALUES (1,'alice'),(2,'bob')").Error

    res, err := a.Query(context.Background(), QueryRequest{SQL: "select id, name from t_adpt order by id", Limit: 10})
    if err != nil {
        t.Fatalf("query failed: %v", err)
    }
    if len(res.Columns) != 2 {
        t.Fatalf("expected 2 columns, got %d", len(res.Columns))
    }
    if len(res.Rows) != 2 {
        t.Fatalf("expected 2 rows, got %d", len(res.Rows))
    }
}
