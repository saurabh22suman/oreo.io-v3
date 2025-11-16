# Oreo.io-v3

Schema-driven data management tool with Go (auth/orchestration), Python FastAPI (validation/processing), and React (UI).

## Monorepo Layout
- `go-service/` – Go + Gin API (auth, users/projects, proxy to Python)
- `python-service/` – FastAPI microservice (validate/transform/import/export)
- `frontend/` – React + Tailwind UI (TBD)
- `docker-compose.dev.yml` – Dev stack with hot reload
- `TRACKER.md` – Tasks, issues, work log

See `instructions.md` and `oreoio_project_plan.md` for detailed scope.

## Quickstart (Dev)
Requirements: Docker and Docker Compose.

- Start services (dev):
  - Builds images and starts Go and Python with live reload.
  - Access:
    - Go API: http://localhost:8081/healthz
    - Python API: http://localhost:8000/health
  - Proxy:
    - POST http://localhost:8081/api/data/validate → forwards to Python `/validate`
  - Auth test UI:
  - http://localhost:8081/ui/auth.html (register, login, refresh token, call /api/auth/me)
  - Projects UI (quick test):
    - http://localhost:8081/ui/projects.html (paste token, CRUD projects)
  - Datasets (API only for now):
    - Nested under projects: /api/projects/:projectId/datasets [GET, POST]
    - Single dataset: /api/projects/:projectId/datasets/:datasetId [GET, PUT, DELETE]

## Testing
- Python (in container): `docker compose -f docker-compose.dev.yml exec -T python-service pytest -q`
- Go (in ephemeral container):
  - Git Bash:
    - `MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD/go-service":/app -w /app golang:1.22-bookworm bash -lc "go version && go mod tidy && go test ./... -v"`
  - Note: On Windows bash, be careful with quotes when sending JSON in curl.

## CI/CD
GitHub Actions run Go and Python tests on push/PR (see .github/workflows/ci.yml). Lint/build steps to follow.

## License
MIT (TBD)

## Delta Lake Migration (Experimental v4)
The repository contains early work to migrate dataset storage from Postgres to Delta Lake.

Components:
- Python service exposes `/delta/append`, `/delta/query`, `/delta/history/{table}` and `/delta/restore/{table}/{version}` backed by delta-rs and DuckDB.
- Data root mounted at `./delta-data` → container path `/data/delta` (configurable via `DELTA_DATA_ROOT`).
- Go service can be pointed to a file-based metadata DB with `METADATA_DB=/data/meta/oreo.db` (see compose) while Postgres remains for legacy paths.

Export existing Postgres tables to Delta (one-off):
```
pip install -r scripts/requirements-migrate.txt
python scripts/export_postgres_to_delta.py \
  --dsn postgresql://USER:PASS@HOST:5432/DB \
  --tables projects,datasets,users \
  --delta-root ./delta-data
```

Quick query of a Delta table via Python service:
```
curl -X POST http://localhost:8000/delta/query -H "Content-Type: application/json" \
  -d '{"table":"projects","limit":5}'
```

See `docs/delta_migration.md` for the overall plan and next steps.

## Admin

Admin base UI: `/admin_base` (password `ADMIN_PASSWORD`, default `admin123`).

### Admin Command Line (Delta Utilities)
Inside the Admin page, use the command box to inspect Delta storage:

Supported command:

`delta ls [path]` – Lists folders and Delta tables under `DELTA_DATA_ROOT` (default `/data/delta`). A directory is classified as `delta_table` if it contains a `_delta_log` subfolder.

Examples:
```
delta ls
delta ls project_42
```

Output columns: TYPE, NAME, PATH.