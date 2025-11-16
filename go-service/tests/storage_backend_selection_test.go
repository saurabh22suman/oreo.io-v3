package tests

import (
    "testing"
    "github.com/oreo-io/oreo.io-v2/go-service/models"
    "github.com/oreo-io/oreo.io-v2/go-service/storage"
)

func TestBackendSelection_DatasetOverride(t *testing.T) {
    ds := &models.Dataset{StorageBackend: "delta"}
    a := storage.GetAdapterForDataset(ds)
    if _, ok := a.(*storage.DeltaAdapter); !ok {
        t.Fatalf("expected DeltaAdapter for dataset override, got %T", a)
    }
}

func TestBackendSelection_DefaultEnvFallback(t *testing.T) {
    // Override env lookup to simulate DEFAULT_STORAGE_BACKEND=postgres
    storage.EnvLookupForTest("postgres")
    ds := &models.Dataset{StorageBackend: ""}
    a := storage.GetAdapterForDataset(ds)
    if _, ok := a.(*storage.PostgresAdapter); !ok {
        t.Fatalf("expected PostgresAdapter for env fallback, got %T", a)
    }
}
