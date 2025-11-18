package storage

import (
    "strings"

    "github.com/oreo-io/oreo.io-v2/go-service/internal/models"
)

// GetAdapterForDataset resolves the adapter using dataset.StorageBackend if set, else env default.
func GetAdapterForDataset(ds *models.Dataset) StorageAdapter {
    if ds != nil {
        if b := strings.ToLower(strings.TrimSpace(ds.StorageBackend)); b != "" {
            return NewAdapter(b)
        }
    }
    return NewAdapter(strings.ToLower(strings.TrimSpace(getDefaultBackend())))
}

// getDefaultBackend reads DEFAULT_STORAGE_BACKEND; defined here for testability.
func getDefaultBackend() string {
    // server.go wires the adapter with env at startup; this helper mirrors that behavior.
    // Keep env lookup centralized if needed later.
    return lookupEnv("DEFAULT_STORAGE_BACKEND")
}

var lookupEnv = func(key string) string {
    // indirection for tests
    if v, ok := syscallLookupEnv(key); ok { return v }
    return ""
}

var syscallLookupEnv = func(key string) (string, bool) { return getEnv(key) }

// getEnv is split for platform indirection; here we just use os.LookupEnv via small wrapper in tests.
func getEnv(key string) (string, bool) { return envLookup(key) }

var envLookup = func(key string) (string, bool) { return defaultEnvLookup(key) }

var defaultEnvLookup = func(key string) (string, bool) {
    // implemented in tests by overriding envLookup; real default uses os.LookupEnv
    return realLookupEnv(key)
}

// realLookupEnv is provided in factory_os.go to avoid importing os in this file.