# Oreo.io Delta Lake Migration (v4)

## Goals
- Replace Postgres dataset storage with Delta Lake for ACID, schema evolution, time travel.
- Preserve existing REST API contracts (no breaking changes for frontend).
- Introduce storage adapter pattern to isolate persistence mechanics.

## Stack Decision (Phase 1)
| Concern | Choice | Rationale |
|---------|--------|-----------|
| Write/Append/History | delta-rs (`deltalake` Python) | Lightweight, no full Spark JVM requirement initially |
| Query (ad hoc, filters) | DuckDB + delta scan extension | Fast local analytical reads over Delta parquet files |
| Schema Evolution | `mergeSchema` via overwrite / planned MERGE support | Keep complexity low early |
| Validation | Great Expectations (Spark integration deferred) | Start with Python-level DataFrame validation |

## Directory Layout
```
/data/delta/        # Mounted volume (container) holding delta table folders
  customers/        # Example table -> contains _delta_log + parquet data
  project_42_ds_7/  # Namespaced dataset tables
```

## Adapter (Python Service)
`delta_adapter.py` provides:
- `append_rows(table, rows)` append write
- `overwrite(table, rows)` full replace
- `history(table)` delta log inspection
- `restore(table, version)` time travel restore
- `query(table, where, limit, offset)` via DuckDB

Temporary endpoints exposed under `/delta/*` for iterative integration; will be internalized and proxied by Go service later preserving the existing dataset endpoints.

## Migration Phases
1. Foundation: Dependencies, volume, adapter, experimental endpoints (DONE initial stub).
2. Data Parity: Export existing Postgres tables to Delta (script TBD) + hash comparisons for validation.
3. API Bridging: Swap dataset CRUD in Go controllers to call Python delta endpoints (or direct delta-rs bindings if adopted in Go).
4. Transactions & History Exposure: New endpoints (e.g. `/api/datasets/:id/history`, `/restore`).
5. Performance & Optimization: Add scheduled OPTIMIZE (Spark / delta-rs counterpart) & VACUUM jobs, partitioning, ZORDER.
6. Great Expectations Integration: Configure Spark or GE DataContext to validate Delta tables after writes.
7. Removal of Postgres: Strip `db` service, remove gorm Postgres driver, consolidate metadata to SQLite or dedicated lightweight store.

## Open Decisions
- Whether to keep SQLite for metadata (projects/users) while Delta handles datasets.
- Introduce Go-native delta bindings vs continue Python proxy pattern.
- Partitioning strategy (by project_id, dataset_id, ingestion_date). Suggested: `project_id=.. / dataset_id=.. / date=YYYY-MM-DD`.

## Next Steps
- Implement export script: read Postgres -> write delta tables.
- Add Go interface abstraction (`StorageBackend`) and initial Postgres implementation, then Delta implementation.
- Enhance Python adapter: MERGE (upsert) semantics for append approvals.

## Environment Variables
- `DELTA_DATA_ROOT` path for physical delta tables (mounted). Defaults to `/data/delta`.

## Testing Strategy
- Unit: delta_adapter CRUD & query
- Integration: Write → Query → History → Restore roundtrip
- Parity: Row count & checksum vs Postgres dump

---
This document will evolve as subsequent migration phases are implemented.
