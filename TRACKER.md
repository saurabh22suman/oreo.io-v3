# Project Tracker – Oreo.io-v3

This file tracks tasks, issues, decisions, and work logs across the project.

## Legend
- Status: TODO | DOING | BLOCKED | DONE | DEFERRED
- Area: go | python | frontend | infra | ci

## Today
- Date: 2025-08-27
- Summary: Initial scaffolding for Go and Python services, Docker Compose dev, health endpoints, repo hygiene, and docs.

## Tasks Backlog

### Feature → Tech Alignment
- Auth & RBAC (Go) – Status: DOING
- Projects/Datasets CRUD (Go) – Status: DOING
- Workflow approval engine (Go) – Status: TODO
- File uploads/storage (Go) – Status: TODO
- Schema inference (Python) – Status: TODO
- Schema mismatch detection (Python) – Status: TODO
- Business rules (Python) – Status: TODO
- Data statistics (Python) – Status: TODO
- SQL query API (Go) – Status: TODO
- Live editing validation (Python) – Status: TODO
- Dashboard (React + Go API) – Status: TODO

### Auth Enhancements
- Google Sign-In integration
  - [ ] Backend: finalize Google token verification and telemetry (Status: DONE→VERIFY)
  - [ ] Frontend: handle GIS errors and multi-tenant client IDs (Status: TODO)
  - [ ] E2E: Playwright e2e with real client ID (Status: TODO)

### Dataset Flow
- [ ] Top-level dataset endpoints (create, schema, rules, append, data, stats) (Status: TODO)
- [ ] Frontend pages: Create, Schema & Rules, Upload & Append, Approvals, Viewer (Status: TODO)
- [ ] Python rules: regex, allowed_values, not_null aliases, referential (basic) (Status: TODO)
- [ ] TDD: Go httptest, Python pytest, React Vitest/RTL, E2E flow (Status: TODO)

### Backend (Go)
- [ ] Setup Gin API server with health route. (Status: DONE)
- [ ] JWT auth middleware and login endpoint. (Status: DONE)
- [ ] JWT refresh endpoint. (Status: DONE)
  - Auth: Added register/login, JWT middleware, and static UI (/auth.html) to test flows.
  - DB: Added GORM with Postgres (docker-compose) and AutoMigrate for User.
- [ ] Projects CRUD `/api/projects`. (Status: DONE)
- [ ] Datasets CRUD `/api/projects/:projectId/datasets`. (Status: DOING)
- [ ] Users/roles CRUD `/api/users`. (Status: TODO)
- [ ] File upload `/api/files/upload`. (Status: TODO)
- [ ] Reverse proxy to Python under `/api/data/*`. (Status: TODO)
- [ ] Unit tests with testify. (Status: TODO)

### Backend (Python)
- [ ] FastAPI project with `/health` and `/validate`. (Status: DONE)
- [ ] Implement schema validation via `jsonschema`. (Status: DONE)
- [ ] Add `/transform`, `/import`, `/export`. (Status: TODO)
- [ ] Pandas/openpyxl/sqlalchemy/pyarrow integration. (Status: TODO)
- [ ] Pytest + httpx tests. (Status: TODO)

### Frontend
- [ ] React + Tailwind scaffold. (Status: TODO)
- [ ] Login, Dashboard, Schema Editor, Data Editor. (Status: TODO)
- [ ] API integration to Go/Python. (Status: TODO)
- [ ] Jest/RTL + E2E. (Status: TODO)

### Infra/CI
- [ ] Dockerfiles for Go/Python (dev). (Status: DONE)
- [ ] docker-compose.dev.yml with hot reload. (Status: DONE)
- [ ] Healthchecks for services. (Status: DONE)
- [ ] GitHub Actions CI (lint, test, build). (Status: DOING)

## Issues
- [ ] Python warning: ValidateRequest.schema shadows BaseModel attribute (`pydantic`). Consider renaming to `json_schema`. (Status: TODO)

## Decisions
- Web framework: Gin for Go; FastAPI for Python.
- DB: Postgres for app runtime (dev/stg/prod). SQLite (pure-Go) only for unit tests.
- Service comms: REST. Reverse proxy from Go to Python planned.

## Work Log
- 2025-08-27
  - Init: Created repo hygiene files (.gitignore), tracker, and scaffolding plan.
  - Infra: Added docker-compose.dev.yml with Go + Python services and healthchecks.
  - Go: Created minimal Gin server with `/healthz`.
  - Python: Created FastAPI app with `/health` and implemented `/validate` using jsonschema.
  - Tests: Go unit tests added; Go toolchain in container pending. Python tests updated (3 passing).
  - Run: Built images and started services. Verified health endpoints via curl; proxy wiring done.
  - Proxy: Go `/api/data/validate` forwards to Python `/validate` (env: PYTHON_SERVICE_URL).
  - Auth: Implemented register/login/JWT middleware; served UI at `/ui/auth.html`.
  - Auth: Added /api/auth/refresh route, updated UI with Refresh button, added unit test for refresh.
  - DB: Added Postgres service to compose; Go auto-migrates User.
  - Projects: Added Project model, CRUD handlers, routes (protected), unit tests, and a minimal UI at `/ui/projects.html`.

## Next Up
- Add tests: Go (testify) and Python (pytest + httpx).
- Implement `/validate` with jsonschema validation.
- Wire Go reverse proxy to Python `/validate`.
- Add Postgres service to compose and basic models.