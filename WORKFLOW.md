## Development Workflow (Applied)

We follow the TDD + Dockerized dev flow from `instructions.md`. This file lists concrete steps to run locally.

### Prereqs
- Docker Desktop installed.
- Windows shell: bash (Git Bash). Commands assume bash.

### Start Dev Stack
Use the dev compose to build and run Go and Python services with health checks.

Steps:
1. Build and start:
  - This builds images and starts containers for Go (mapped to 8081) and Python (8000).
   
  Commands (run in repo root):
  ```bash
  docker compose -f docker-compose.dev.yml build
  docker compose -f docker-compose.dev.yml up -d
  ```
2. Verify health:
  - Go: http://localhost:8081/healthz
  - Python: http://localhost:8000/health
   
  ```bash
  curl -sS http://localhost:8081/healthz
  curl -sS http://localhost:8000/health
  ```

### Testing
- Go unit tests: run inside a Go dev container or locally.
- Python tests: run via pytest.

Commands:
```bash
# Python (inside container)
docker compose -f docker-compose.dev.yml exec -T python-service pytest -q

# Go (run transient container; on Git Bash, disable path conversion)
MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD/go-service":/app -w /app golang:1.23-bookworm bash -lc "go mod tidy && go test ./... -v"
```

Notes (Windows Git Bash):
- If you see paths like `C:/Program Files/Git/...` in docker exec/run, set `MSYS_NO_PATHCONV=1` as shown above.
- If `develop.watch` hot-reload is not supported by your Docker version, rebuild on changes:
```bash
docker compose -f docker-compose.dev.yml build && docker compose -f docker-compose.dev.yml up -d
```

### Next Steps
- Add Postgres to compose.
- Implement `/validate` using jsonschema and add tests.
- Add Go reverse proxy to Python under `/api/data/*`.
- Scaffold frontend.

### CI
- On push/PR, GitHub Actions runs Go and Python tests (see .github/workflows/ci.yml).

# 🛠️ Development Workflow Strategy (with GPT-5 in VSCode)

## 1. **Project Setup**
- Ask GPT-5 to:
  - Scaffold Go backend (`/backend`) with REST API boilerplate.
  - Scaffold Python microservice (`/data-service`) for schema validation + rules.
  - Scaffold React frontend (`/frontend`) with Vite + Tailwind.
  - Generate `docker-compose.yml` with all services wired.
- **Prompt Example**:  
  > “Generate a minimal Go REST API with endpoints `/api/projects` and `/api/data`, include unit tests using TDD style in Go. Place in `/backend` folder.”

---

## 2. **TDD Development Cycle**
- For **every feature**:
  1. **Write tests first** with GPT-5’s help.  
     - Go: `testing` package + testify.  
     - Python: `pytest`.  
     - React: `vitest` + `testing-library/react`.  
  2. Run tests → they should fail.  
  3. Implement code until tests pass.  
  4. Refactor → re-run tests.  

- **Prompt Example**:  
  > “Write a failing unit test for validating schema rules in `/data-service/rules_test.py` using pytest. Then generate minimal code in `rules.py` to make it pass.”

---

## 3. **GitHub Copilot + GPT-5 Workflow**
- Use **Copilot** for inline completions (small snippets).  
- Use **GPT-5 (Chat)** for:
  - Structuring services, TDD cycle prompts.  
  - Explaining failing test errors.  
  - Generating integration test suites across services.  

- **Prompt Example**:  
  > “Here’s my test failure log, explain why my Go handler isn’t returning expected JSON and fix the code.”

---

## 4. **Dockerized Environments**
- **Dev (local Docker Desktop)**  
  - Run `docker-compose -f docker-compose.dev.yml up`.  
  - Mount volumes for hot reload.  
- **Staging / Prod (VPS)**  
  - Build & push images with GitHub Actions.  
  - Use `.env.stg` and `.env.prod`.  
- **Prompt Example**:  
  > “Write me a `docker-compose.dev.yml` that mounts local source code for hot reload in Go and Python containers, plus React dev server.”

---

## 5. **CI/CD with TDD**
- GPT-5 generates `.github/workflows/ci.yml`:
  - Run Go, Python, and React tests in parallel.
  - Build Docker images.
  - Deploy to VPS (staging) on push to `main`.
- **Prompt Example**:  
  > “Generate a GitHub Actions workflow that runs Go tests, pytest, and vitest, then builds Docker images and pushes to my VPS staging server on main branch merge.”

---

## 6. **Refactoring & Documentation**
- After MVP features pass tests:
  - Use GPT-5 to refactor code (split files, clean functions).
  - Ask it to auto-generate API docs (`OpenAPI/Swagger` for Go).
  - Generate `README.md` and update `docs/`.

- **Prompt Example**:  
  > “Refactor my Go handler code in `/backend/handlers/data.go` for clarity, add Swagger annotations, and keep tests green.”

---

## 7. **When to Use Other Models**
- **Claude Sonnet 4** → repo-wide refactor, summarization, long doc generation.  
- **Gemini 2.5 Pro** → frontend UX prototyping, GCP integrations.  
- **Grok Code Fast 1** → quick CRUD stubs or config scaffolds.  

---

✅ With this workflow, GPT-5 becomes your **TDD partner + debugger**, Copilot your **inline assistant**, and you only switch to other models for **cleanup or speed**.  
