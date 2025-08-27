# Oreo.io-v2 Project Blueprint

## 📌 Goal
Build a schema-driven structured data management tool (similar to Woody.io) with:
- Schema enforcement (JSON schema, custom business rules).
- Data import/export (CSV, Excel, SQL, Google Drive, etc.).
- Live editing in a user-friendly UI.
- User roles, projects, and permissions.
- Backend split between **Go** (auth, users, orchestration) and **Python** (data validation/processing).

---

## 🏗️ System Architecture

### 1. Backend (Go)
**Responsibilities:**
- Authentication (JWT-based).
- Project & user management (CRUD APIs).
- Roles & permissions (Admin, Editor, Viewer).
- Serve the frontend React app.
- Orchestrate requests to Python service for data handling.

**Work Needed:**
- [ ] Set up Go Fiber/Gin API server.
- [ ] Implement JWT authentication + middleware.
- [ ] Create APIs for:
  - `/api/projects` → manage projects.
  - `/api/users` → manage users/roles.
  - `/api/files/upload` → handle file upload (store in disk/S3).
- [ ] Add reverse proxy for Python microservice requests (`/api/data/*`).

---

### 2. Backend (Python - FastAPI microservice)
**Responsibilities:**
- Schema parsing (JSON Schema, Pydantic).
- Data validation against schema.
- Business rules enforcement.
- Data import/export:
  - CSV, Excel → using `pandas` + `openpyxl`.
  - SQL DB → via `sqlalchemy`.
  - Parquet/Arrow → via `pyarrow`.
- Return validation results + transformed data to Go API.

**Work Needed:**
- [ ] Create FastAPI project (`/python-service`).
- [ ] Endpoints:
  - `POST /validate` → validate data against schema.
  - `POST /transform` → apply business rules.
  - `POST /import` → import file → return JSON.
  - `POST /export` → export to chosen format (CSV, Excel, SQL, Parquet).
- [ ] Integrate `jsonschema`, `pydantic`, `pandas`, `sqlalchemy`.

---

### 3. Frontend (React + Tailwind)
**Responsibilities:**
- Dashboard for projects & users.
- Schema editor (JSON/YAML editor with autocomplete).
- Data editor (table/grid view for live editing).
- Validation feedback (highlight invalid cells, show error messages).
- Import/export UI.

**Work Needed:**
- [ ] Setup React app with Tailwind.
- [ ] Components:
  - **Login/Register**
  - **Dashboard** → list projects.
  - **Schema Editor** → JSON editor with validation preview.
  - **Data Editor** → spreadsheet-like grid (AgGrid/Handsontable).
  - **Validation Panel** → show errors/warnings.
  - **Import/Export Panel** → file chooser, DB connection config.
- [ ] API integration:
  - `/api/projects` → fetch projects.
  - `/api/data/validate` → validate live edits.
  - `/api/data/import` → upload & preview data.

---

### 4. Integration Flow
1. User logs in → Go backend issues JWT.
2. User uploads schema/data → Go API stores file → forwards to Python service.
3. Python validates/transforms → sends results back.
4. Go returns results to frontend.
5. Frontend updates grid & error panel in real-time.
6. On export, Python microservice handles format conversion → file returned via Go API.

---

## 🔑 Tech Stack
- **Backend (Go):** Gin/Fiber, GORM, JWT.
- **Backend (Python):** FastAPI, Pydantic, Pandas, SQLAlchemy, PyArrow, Openpyxl.
- **Frontend:** React, Tailwind, AgGrid/Handsontable, Monaco Editor.
- **Database:** Postgres (projects, users, metadata).
- **Storage:** Local FS or S3-compatible bucket for files.
- **Deployment:** Docker + Docker Compose (Go + Python services + Postgres + Nginx).

---

## ✅ Development Roadmap

### Phase 1 – MVP (Core Foundation)
- [ ] **Backend (Go):** Auth (JWT), project & user CRUD.
- [ ] **Backend (Python):** Basic `/validate` API with JSON Schema.
- [ ] **Frontend:** Login page, dashboard, schema editor.
- [ ] **Integration:** Go ↔ Python call for schema validation.

🎯 Goal: User can define schema, upload JSON, and validate data.

---

### Phase 2 – Beta (Data Handling & Editing)
- [ ] **Python:** Add CSV/Excel import/export, basic transformations.
- [ ] **Frontend:** Data editor (grid view), validation panel.
- [ ] **Integration:** Validate edits in real-time via Python service.
- [ ] **Storage:** Save uploaded files (local/S3).

🎯 Goal: User can upload CSV/Excel, see it in grid, validate against schema.

---

### Phase 3 – Advanced (Business Rules & Export)
- [ ] **Python:** Implement custom business rules engine.
- [ ] **Frontend:** Business rules UI (define conditions, constraints).
- [ ] **Export Options:** SQL DB, Parquet, Google Drive.
- [ ] **Frontend:** Import/export panel with file type options.

🎯 Goal: User can enforce rules, transform data, and export in multiple formats.

---

### Phase 4 – Production Ready (Collaboration & Scaling)
- [ ] **Go:** Role-based permissions (Admin, Editor, Viewer).
- [ ] **Frontend:** Multi-user project collaboration.
- [ ] **Deployment:** Dockerize full stack with Nginx proxy.
- [ ] **Monitoring/Logging:** Prometheus + Grafana or equivalent.

🎯 Goal: Multi-user SaaS-ready platform.

---

## 📂 Repo Structure (Proposed)
```
oreo.io-v2/
├── go-service/          # Go backend
│   ├── main.go
│   ├── routes/
│   ├── models/
│   ├── controllers/
│   └── middleware/
│
├── python-service/      # Python FastAPI microservice
│   ├── main.py
│   ├── routes/
│   ├── schemas/
│   └── utils/
│
├── frontend/            # React + Tailwind frontend
│   ├── src/
│   ├── components/
│   ├── pages/
│   └── services/
│
├── docker-compose.yml   # Multi-service deployment
└── README.md
```

