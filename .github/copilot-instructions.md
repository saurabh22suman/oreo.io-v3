# Oreo.io v3 - AI Coding Agent Instructions

## Architecture Overview

Oreo.io is a **three-service** data management platform with ACID-compliant versioning via Delta Lake:

```
Frontend (React+Vite) ──HTTP──▶ Go Service (Gin) ──HTTP──▶ Python Service (FastAPI)
     :5173                           :8080                        :8000
                                       │                            │
                                       ├─▶ PostgreSQL/SQLite       ├─▶ Delta Lake
                                       │   (metadata)              │   (data storage)
                                       └─▶ JWT Auth/RBAC           └─▶ DuckDB (queries)
```

### Service Responsibilities
- **Go Service** (`go-service/`): Auth, RBAC, routing, metadata, proxies data ops to Python
- **Python Service** (`python-service/`): Delta Lake CRUD, validation, live edit sessions, merge execution
- **Frontend** (`frontend/`): React + AG Grid for Excel-like editing, approval workflows

### Delta Lake Folder Structure
Data lives in `delta-data/` (or `/data/delta` in Docker):
```
/data/delta/projects/<project_id>/datasets/<dataset_id>/
├── main/         # Canonical Delta table
├── staging/      # Per-change-request staging tables
├── live_edit/    # Per-session cell-edit tables  
├── imports/      # Raw files & intermediate ingest
└── audit/        # Validation runs, snapshots
```

## Key Patterns

### Storage Adapter Pattern (Go)
The Go service uses a swappable `StorageAdapter` interface (`go-service/internal/storage/adapter.go`):
```go
type StorageAdapter interface {
    Query(ctx context.Context, req QueryRequest) (QueryResult, error)
    Insert(ctx context.Context, datasetID string, records []map[string]interface{}) error
    // ...
}
```
Set `DEFAULT_STORAGE_BACKEND=delta` or `postgres` in env. Delta is the primary backend.

### Change Request Workflow
All data modifications go through approval:
1. User creates live edit session → edits staged in `live_edit/`
2. Submit creates `ChangeRequest` (status: `pending`)
3. Reviewer approves/rejects via `/changes/:id/approve|reject`
4. On approval, merge executor merges staging → main Delta table

### Validation State Machine
Validation happens at four levels (see `python-service/validation_service.py`):
- **Cell-level**: Immediate feedback during editing
- **Session-level**: Before CR creation
- **CR-level**: Re-validates when opened for approval
- **Merge-level**: Final validation before merge

Severities: `INFO < WARNING < ERROR < FATAL` (FATAL blocks merge)

### Live Edit Hooks (Frontend)
Core hooks in `frontend/src/hooks/`:
- `useLiveSession.ts` - Session lifecycle (start, save, submit CR)
- `useEdits.ts` - Track staged cell edits
- `useValidation.ts` - Real-time validation feedback

## Development Commands

### Start All Services (Docker)
```bash
docker compose -f docker-compose.dev.yml up -d --build
# Frontend: http://localhost:5173
# Go API: http://localhost:8080
# Python API: http://localhost:8000/docs
```

### Run Services Locally
```bash
# Terminal 1 - Python service
cd python-service && source ../.venv/Scripts/activate  # Windows venv
uvicorn main:app --reload --port 8000

# Terminal 2 - Go service  
cd go-service && go run ./cmd/server

# Terminal 3 - Frontend
cd frontend && npm run dev
```

### Tests
```bash
# Go tests
cd go-service && go test ./...

# Python tests
cd python-service && pytest

# Frontend unit tests
cd frontend && npm test

# E2E tests (Playwright)
cd frontend && npm run test:e2e
```

## Code Conventions

### Go Service
- Clean architecture: `cmd/` entry, `internal/handlers|models|storage|service`
- Error handling: Always wrap errors with context `fmt.Errorf("failed to X: %w", err)`
- Routes defined in `internal/handlers/router.go`
- GORM for ORM; models in `internal/models/`

### Python Service  
- FastAPI endpoints in `main.py` (large file - use search)
- Delta operations in `delta_adapter.py` using `deltalake` + `duckdb`
- Business rules validation in `business_rules_service.py`
- Pydantic models throughout

### Frontend
- TypeScript strict mode, React functional components
- API calls in `src/api.ts` (centralized fetch wrapper)
- Tailwind CSS + shadcn/ui components in `src/components/ui/`
- AG Grid for data tables (`AgGridTable.tsx`)

## Environment Variables

Critical variables in `.env` / `docker-compose.dev.yml`:
```bash
JWT_SECRET=<32+ chars>          # Required for auth
ADMIN_PASSWORD=<12+ chars>      # Admin UI password
DEFAULT_STORAGE_BACKEND=delta   # "delta" or "postgres"
DELTA_DATA_ROOT=/data/delta     # Delta storage path
PYTHON_SERVICE_URL=http://python-service:8000
```

## Common Tasks

### Add New API Endpoint
1. Define route in `go-service/internal/handlers/router.go`
2. Create handler in appropriate handler file
3. If needs Python processing, proxy via `forwardJSON()` to Python service
4. Add Python endpoint in `python-service/main.py`

### Add New Frontend Page
1. Create page in `frontend/src/pages/`
2. Add route in `App.tsx`
3. Wrap with `ProtectedRoute` for auth-required pages

### Modify Delta Table Schema
1. Update schema in `delta_adapter.py` methods
2. Run migration or use `ensure_main_table()` for new columns
3. Update corresponding Go model if metadata changes

## File Reference

| Purpose | Location |
|---------|----------|
| API routing | `go-service/internal/handlers/router.go` |
| Auth middleware | `go-service/internal/handlers/auth.go` |
| Delta operations | `python-service/delta_adapter.py` |
| Validation logic | `python-service/validation_service.py` |
| Live edit service | `python-service/live_edit_service.py` |
| Frontend API client | `frontend/src/api.ts` |
| Live edit hooks | `frontend/src/hooks/useLiveSession.ts` |
| Main page components | `frontend/src/pages/` |

## API Patterns & Error Handling

### HTTP Status Codes
| Code | Meaning | Use Case |
|------|---------|----------|
| 200 | Success | Normal responses |
| 201 | Created | New resource created |
| 400 | Bad Request | Validation errors, malformed input |
| 403 | Forbidden | RBAC permission denied |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Merge conflicts, duplicate resources, CR not pending |
| 422 | Unprocessable | Validation failed (cell edit rejected) |
| 500 | Server Error | Database/service failures |
| 502 | Bad Gateway | Python service unreachable |

### Go → Python Proxy Pattern
The Go service proxies data operations to Python via `forwardJSON()` (JSON) or `proxyMultipart()` (file uploads):
```go
// router.go - proxy rule validation to Python
api.POST("/data/rules/validate", func(c *gin.Context) {
    forwardJSON(c, cfg.PythonServiceURL + "/rules/validate")
})
```
Add new data operations the same way—define proxy route in Go, implement logic in Python.

### Retry Logic
- **Database connection**: Go retries Postgres connection 30 times on startup (`internal/database/db.go`)
- **Delta writes**: Retry with schema alignment on type mismatch (`delta_adapter.py:834`)
- **Frontend polling**: E2E tests retry dataset data fetch up to 20 attempts for eventual consistency
- **No automatic retry** for API calls from frontend—handle errors explicitly

### CR Status Transitions
```
pending → approved → merged
        → rejected
        → withdrawn
approved → merge_fail → pending_review (retry possible)
```

### Validation Severity Blocking
- `INFO`: Advisory only, never blocks
- `WARNING`: Allows submission, flagged for reviewer
- `ERROR`: Blocks CR submission
- `FATAL`: Blocks merge execution

## Testing Conventions

### File Naming
| Service | Unit Tests | Integration/E2E |
|---------|------------|-----------------|
| Go | `*_test.go` in same package | `go-service/tests/*.go` |
| Python | `python-service/tests/test_*.py` | Same folder |
| Frontend | `src/**/__tests__/*.test.ts` | `frontend/tests/*.spec.ts` |

### Go Tests
```bash
cd go-service
go test ./...                    # All tests
go test ./internal/handlers      # Specific package
go test -cover ./...             # With coverage
go test -v -run TestChangeApprove  # Single test
```
- Use `test_helper.go` for shared setup (loads config)
- Integration tests in `tests/` folder mock Python service but exercise real Go code

### Python Tests  
```bash
cd python-service
pytest                           # All tests
pytest tests/test_live_edit.py   # Single file
pytest -v -k "test_save_cell"    # Single test by name
```
- Tests are self-contained, create temp Delta tables in `/tmp/test_delta`
- Service classes instantiated directly (no HTTP mocking needed for unit tests)
- Pattern: `test_*.py` with functions named `test_*`

### Frontend Unit Tests (Jest)
```bash
cd frontend
npm test                         # Watch mode
npm test -- --coverage           # With coverage
npm test -- useLiveSession.test.ts  # Single file
```
- Mock API modules with `jest.mock('../../api/liveEditAPI')`
- Use `@testing-library/react` for hook testing via `renderHook()`
- Setup file at `src/test/setup.ts` mocks `localStorage`, `matchMedia`, console

### Frontend E2E Tests (Playwright)
```bash
cd frontend
npm run test:e2e                 # All E2E tests
npm run test:e2e -- --ui         # With UI
npx playwright test append-approval-multiuser.spec.ts  # Single file
```
- Tests run against live services (Docker or local)
- Multi-user flows: register users, create projects, switch auth contexts
- Use `page.evaluate()` for direct API calls in tests
- Pattern: `*.spec.ts` with `test()` blocks

### Test Data
- Sample CSVs in `test-data/` and `sample-data/`
- E2E tests generate unique names with `Date.now()` timestamps
- Python tests use temp directories, cleaned up automatically

## Gotchas

- **CORS**: Dev allows `localhost:5173`, check `router.go` for allowed origins
- **File uploads**: Max 100MB, handled via multipart proxy to Python
- **Session recovery**: Live edit sessions stored in localStorage for crash recovery
- **Merge conflicts**: 409 response from `/delta/merge-cr` includes conflict details
- **Codacy analysis**: Per `.github/instructions/codacy.instructions.md`, run analysis after edits
- **Test isolation**: E2E tests create unique projects/datasets to avoid collisions
