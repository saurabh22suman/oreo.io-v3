package storage

import "github.com/gin-gonic/gin"

// GetAdapter retrieves the StorageAdapter placed in Gin context during server init.
// Falls back to a default Postgres adapter if missing.
func GetAdapter(c *gin.Context) StorageAdapter {
    if c == nil { return NewAdapter("postgres") }
    if v, ok := c.Get("storage_adapter"); ok {
        if a, ok2 := v.(StorageAdapter); ok2 { return a }
        if a, ok2 := v.(*DeltaAdapter); ok2 { return a }
        if a, ok2 := v.(*PostgresAdapter); ok2 { return a }
    }
    return NewAdapter("postgres")
}
