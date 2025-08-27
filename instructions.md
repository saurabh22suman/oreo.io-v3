# instructions.md

## 📌 Project Context
This project is **Oreo.io-v2**, a schema-driven data management tool (similar to Woody.io).  
It has **3 main parts**:  
1. **Go service** → Auth, user/project management, orchestration.  
2. **Python FastAPI service** → Schema validation, data import/export, business rules.  
3. **React frontend** → UI for schema editor, data editor, validation panel, import/export.  

We follow **TDD (Test-Driven Development)** and deploy via Docker (dev → staging → prod).  

---

## ⚙️ Tech Stack & Conventions

### Go Service
- Framework: **Gin** (or Fiber, but pick one consistently).  
- ORM: **GORM** with Postgres.  
- Auth: JWT.  
- Structure:  
  ```
  go-service/
  ├── main.go
  ├── routes/
  ├── models/
  ├── controllers/
  ├── middleware/
  └── tests/
  ```
- Tests: `testing` + `testify`.  
- Rule: Always write a **failing test** before implementing features.  

### Python Service
- Framework: **FastAPI**.  
- Schema validation: `pydantic`, `jsonschema`.  
- Data handling: `pandas`, `sqlalchemy`, `pyarrow`, `openpyxl`.  
- Structure:  
  ```
  python-service/
  ├── main.py
  ├── routes/
  ├── schemas/
  ├── utils/
  └── tests/
  ```
- Tests: `pytest` + `httpx`.  
- Rule: Start with endpoint contract tests → then implement logic.  

### React Frontend
- Stack: React + Tailwind.  
- UI components: AgGrid/Handsontable for data editor, Monaco Editor for schema editing.  
- Structure:  
  ```
  frontend/
  ├── src/
  │   ├── components/
  │   ├── pages/
  │   ├── services/
  │   └── tests/
  ```
- Tests: Jest + React Testing Library (unit), Cypress/Playwright (E2E).  
- Rule: Build components in isolation → snapshot test → then integrate.  

---

## 🔄 Service Communication
- Go ↔ Python via REST API.  
- Example flow:  
  - Go receives file upload → forwards to Python `/validate`.  
  - Python validates/transforms → returns JSON + errors → Go passes back to frontend.  

---

## ✅ Development Workflow
1. Write failing test.  
2. Implement code until test passes.  
3. Refactor (keep tests green).  
4. Commit with meaningful messages (`feat:`, `fix:`, `test:`).  
5. Run full test suite before pushing.  

---

## 📦 Docker & Environments
- Use **Docker Compose** for multi-service setup.  
- `docker-compose.dev.yml` → hot reload, mounted volumes.  
- `docker-compose.stg.yml` → staging on VPS with debug logging.  
- `docker-compose.prod.yml` → optimized, stable release.  
- All services must include healthcheck endpoints.  

---

## 🧪 CI/CD (GitHub Actions)
Pipeline stages:  
1. **Lint & Unit Tests** → Go, Python, React.  
2. **Integration Tests** → Compose up, run cross-service tests.  
3. **Build & Push Docker Images** → Tagged by branch (`dev`, `stg`, `prod`).  
4. **Deploy to VPS** → staging auto-deploy, prod manual approval.  

---

## 🎯 MVP Requirements (Alignment Guide)

Use this as the product-alignment north star. All features and changes should map to one or more of these items.

1) User Authentication & Dashboard
- Secure signup/login (JWT).
- Dashboard shows recent projects.
- Settings tab (account, profile, preferences).

2) Projects
- A project is a container (like a repository).
- Creator is the owner (owns datasets, workflows, rules in the project).
- RBAC roles per project:
  - Owner: full access.
  - Editor: append/edit datasets, define schema, apply business rules.
  - Approver: approve/reject workflow changes.
  - Viewer: read-only.

3) Datasets
- Each project contains multiple datasets.
- Dataset properties include schema.
- Initialize schema in two ways:
  - Manual schema definition (user-defined fields/types).
  - Schema inference (from uploaded file).

4) Data Append & Validation Flow
- Append new data triggers checks:
  - Schema validation (detect mismatches, report errors).
  - Business rules validation (ranges, uniqueness, constraints, etc.).
- Live editing to fix errors inline before submission.
- If all checks pass → move to workflow approval stage.
- If checks fail → show clear errors with suggested fixes.

5) Workflow & Approval
- Pending changes appear in a workflow section.
- Members with approval rights can approve/reject.
- Approved data is committed to the dataset.

6) Analytics & Live Query
- Statistics view: record counts, schema overview, errors history, rule violations.
- Live SQL connect: users can query datasets with SQL, see tabular results, and export (CSV/Excel).

Always reference this section when planning sprint scope, writing tests, or prioritizing backlog items.

