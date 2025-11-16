package storage

import "testing"

func TestAdapterFactory_DefaultPostgres(t *testing.T) {
    a := NewAdapter("")
    if _, ok := a.(*PostgresAdapter); !ok {
        t.Fatalf("expected PostgresAdapter by default, got %T", a)
    }
}

func TestAdapterFactory_Delta(t *testing.T) {
    a := NewAdapter("delta")
    if _, ok := a.(*DeltaAdapter); !ok {
        t.Fatalf("expected DeltaAdapter for 'delta', got %T", a)
    }
}

