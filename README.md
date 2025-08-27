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