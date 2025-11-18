package storage

import (
    "context"
    "database/sql"
    "errors"
    "fmt"
    "regexp"
    "strings"

    dbpkg "github.com/oreo-io/oreo.io-v2/go-service/internal/database"
)

// PostgresAdapter delegates to the configured GORM database (Postgres in prod, sqlite in dev/tests).
// NOTE: This path is kept for compatibility and will be removed once Delta backend is stable.
// TODO: Remove once Delta backend proven stable.
type PostgresAdapter struct{}

func (p *PostgresAdapter) getDB() (*sql.DB, error) {
    gdb := dbpkg.Get()
    if gdb == nil {
        if _, err := dbpkg.Init(); err != nil {
            return nil, err
        }
        gdb = dbpkg.Get()
        if gdb == nil {
            return nil, errors.New("db not initialized")
        }
    }
    return gdb.DB()
}

func (p *PostgresAdapter) Query(ctx context.Context, req QueryRequest) (QueryResult, error) {
    if strings.TrimSpace(req.SQL) == "" {
        return QueryResult{Columns: []string{}, Rows: [][]interface{}{}}, nil
    }
    sqlText := strings.TrimSpace(req.SQL)
    // Add LIMIT if requested and not already present (naive detection)
    if req.Limit > 0 && !hasLimitClause(sqlText) {
        sqlText = fmt.Sprintf("%s LIMIT %d", sqlText, req.Limit)
    }
    db, err := p.getDB()
    if err != nil {
        return QueryResult{}, err
    }
    rows, err := db.QueryContext(ctx, sqlText)
    if err != nil {
        return QueryResult{}, err
    }
    defer rows.Close()
    cols, err := rows.Columns()
    if err != nil {
        return QueryResult{}, err
    }
    result := QueryResult{Columns: cols, Rows: make([][]interface{}, 0)}
    for rows.Next() {
        // Prepare generic receivers
        scanHolders := make([]interface{}, len(cols))
        scanTargets := make([]interface{}, len(cols))
        for i := range scanHolders {
            scanTargets[i] = &scanHolders[i]
        }
        if err := rows.Scan(scanTargets...); err != nil {
            return QueryResult{}, err
        }
        // Normalize []byte -> string for readability
        normalized := make([]interface{}, len(cols))
        for i, v := range scanHolders {
            switch x := v.(type) {
            case []byte:
                normalized[i] = string(x)
            default:
                normalized[i] = x
            }
        }
        result.Rows = append(result.Rows, normalized)
    }
    return result, rows.Err()
}

func (p *PostgresAdapter) Insert(ctx context.Context, datasetID string, records []map[string]interface{}) error {
    if len(records) == 0 {
        return nil
    }
    table := sanitizeIdent(datasetID)
    if table == "" {
        return errors.New("invalid dataset/table name")
    }
    db, err := p.getDB()
    if err != nil {
        return err
    }
    // Derive columns from first record. Use TEXT columns for simplicity/compat across drivers.
    first := records[0]
    cols := make([]string, 0, len(first))
    for k := range first { cols = append(cols, sanitizeIdent(k)) }
    // deterministic order (not required but helpful). Simple selection sort.
    for i := 0; i < len(cols); i++ {
        for j := i + 1; j < len(cols); j++ {
            if cols[j] < cols[i] { cols[i], cols[j] = cols[j], cols[i] }
        }
    }
    // Create table if not exists
    colDefs := make([]string, len(cols))
    for i, c := range cols { colDefs[i] = fmt.Sprintf("\"%s\" TEXT", c) }
    createSQL := fmt.Sprintf("CREATE TABLE IF NOT EXISTS \"%s\" (%s)", table, strings.Join(colDefs, ","))
    if _, err := db.ExecContext(ctx, createSQL); err != nil { return err }

    // Insert rows
    placeholders := make([]string, len(cols))
    for i := range placeholders { placeholders[i] = "?" }
    insertSQL := fmt.Sprintf("INSERT INTO \"%s\" (%s) VALUES (%s)", table, joinQuoted(cols), strings.Join(placeholders, ","))
    for _, rec := range records {
        args := make([]interface{}, len(cols))
        for i, c := range cols { args[i] = fmt.Sprint(rec[c]) }
        if _, err := db.ExecContext(ctx, insertSQL, args...); err != nil { return err }
    }
    return nil
}

func (p *PostgresAdapter) Merge(ctx context.Context, datasetID string, stagingPath string, keys []string) error {
    // Not implemented for legacy path.
    return nil
}

func (p *PostgresAdapter) Delete(ctx context.Context, datasetID string, filter string) error {
    // Not implemented for legacy path.
    return nil
}

func (p *PostgresAdapter) History(ctx context.Context, datasetID string) ([]VersionInfo, error) {
    // Legacy path has no version history.
    return []VersionInfo{}, nil
}

func (p *PostgresAdapter) Restore(ctx context.Context, datasetID string, version int) error {
    // No-op for legacy path.
    return nil
}

// Utilities
var limitRegex = regexp.MustCompile(`(?is)\blimit\b`)

func hasLimitClause(sql string) bool { return limitRegex.MatchString(sql) }

var identRegex = regexp.MustCompile(`(?i)^[a-z_][a-z0-9_]*$`)

func sanitizeIdent(s string) string {
    s = strings.TrimSpace(s)
    s = strings.ReplaceAll(s, "\"", "")
    if identRegex.MatchString(s) { return s }
    return ""
}

func joinQuoted(cols []string) string {
    parts := make([]string, len(cols))
    for i, c := range cols { parts[i] = fmt.Sprintf("\"%s\"", c) }
    return strings.Join(parts, ",")
}
