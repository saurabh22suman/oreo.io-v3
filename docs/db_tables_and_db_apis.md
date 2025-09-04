# Database tables and DB-interacting APIs

This document lists the primary DB-backed models (tables) in the codebase and a concise map of HTTP API endpoints that interact with the database (reads/writes). It's intended as a quick reference for developers.

---

## Tables (models)

Notes:
- Field types are taken from the Go model structs.
- `DatasetMeta` uses a special table name (`sys.metadata` for Postgres, `sys_metadata` for sqlite).

### User
- Fields:
  - ID uint (primaryKey)
  - Email string (uniqueIndex)
  - Password string (hashed, not returned)
  - Role string
  - CreatedAt time.Time
  - UpdatedAt time.Time

### Project
- Fields:
  - ID uint (primaryKey)
  - Name string (uniqueIndex)
  - Description string
  - OwnerID uint (index)
  - CreatedAt time.Time
  - UpdatedAt time.Time

### ProjectRole
- Purpose: links users to projects (RBAC)
- Fields:
  - ID uint (primaryKey)
  - ProjectID uint (index, unique with UserID)
  - UserID uint (index, unique with ProjectID)
  - Role string
  - CreatedAt time.Time
  - UpdatedAt time.Time

### Dataset
- Fields:
  - ID uint (primaryKey)
  - ProjectID uint (not null, unique index with Name per project)
  - Name string (not null)
  - Source string (local | s3 | azure | gcs | mssql)
  - TargetType string (target platform)
  - TargetDSN string (raw DSN stored)
  - TargetDatabase string (structured, optional)
  - TargetSchema string (structured, optional)
  - TargetTable string (structured, optional)
  - Schema string (inferred dataset schema, JSON/text)
  - Rules string (JSON/text rules)
  - LastUploadPath string (filesystem path for last uploaded file)
  - LastUploadAt *time.Time
  - CreatedAt time.Time
  - UpdatedAt time.Time

### DatasetMeta
- Purpose: per-dataset metadata (row/column counts, owner, last update)
- Fields:
  - ID uint (primaryKey)
  - ProjectID uint (index)
  - DatasetID uint (uniqueIndex)
  - OwnerName string
  - RowCount int64
  - ColumnCount int
  - LastUpdateAt time.Time
  - TableLocation string
  - CreatedAt time.Time
  - UpdatedAt time.Time
- Note: Table name is `sys.metadata` on Postgres and `sys_metadata` on sqlite.

### DatasetUpload
- Purpose: stores raw uploaded bytes (preview/validation)
- Fields:
  - ID uint (primaryKey)
  - ProjectID uint (index)
  - DatasetID uint (index)
  - Filename string
  - Content []byte (BLOB / bytea)
  - CreatedAt time.Time

### DatasetVersion
- Purpose: versioned snapshots or references of dataset state
- Fields:
  - ID uint (primaryKey)
  - DatasetID uint (index, not null)
  - Data string (JSON or table reference)
  - EditedBy uint
  - EditedAt time.Time
  - Status string (draft|approved)
  - Approvers string (JSON/text)

### ChangeRequest
- Purpose: approvals flow for appends/edits
- Fields:
  - ID uint (primaryKey)
  - ProjectID uint (index)
  - DatasetID uint (index)
  - UserID uint (index)
  - ReviewerID uint (index)
  - Reviewers string (JSON)
  - ReviewerStates string (JSON)
  - Type string
  - Status string
  - Title string
  - Payload string (JSON/text)
  - Summary string
  - CreatedAt time.Time
  - UpdatedAt time.Time

### ChangeComment
- Fields:
  - ID uint (primaryKey)
  - ProjectID uint (index)
  - ChangeRequestID uint (index)
  - UserID uint (index)
  - Body string
  - CreatedAt time.Time

### DatasetVersion (already listed)

### SavedQuery
- Purpose: user-saved queries per project
- Fields:
  - ID uint (primaryKey)
  - ProjectID uint (index)
  - UserID uint (index)
  - Name string
  - SQL string
  - CreatedAt time.Time
  - UpdatedAt time.Time

### QueryHistory
- Purpose: audit of executed queries
- Fields:
  - ID uint (primaryKey)
  - ProjectID uint (index)
  - UserID uint (index)
  - SQL string
  - ResultRows int
  - CreatedAt time.Time

---

## APIs that interact with the database

Below are the primary HTTP endpoints (grouped by area) that perform DB reads/writes. For each endpoint: HTTP method, path, handler (controller), and brief DB action summary.

> Note: routes are registered in `go-service/server.go` and implemented in `go-service/controllers/*.go`.

### Auth
- POST `/api/auth/register` — `controllers.Register`
  - Creates new `User` (gdb.Create)
- POST `/api/auth/login` — `controllers.Login`
  - Reads `User` by email (gdb.Where/First)
- POST `/api/auth/logout` — `controllers.Logout` (session handling)
- GET `/api/auth/me` — returns auth info (relies on middleware)

### Admin
- GET `/api/admin/users` — `controllers.AdminUsersList` (reads users)
- POST `/api/admin/users` — `controllers.AdminUsersCreate` (creates user)
- PUT `/api/admin/users/:userId` — `controllers.AdminUsersUpdate` (updates user)
- DELETE `/api/admin/users/:userId` — `controllers.AdminUsersDelete` (deletes user)

### Projects (protected)
- GET `/api/projects` — `controllers.ProjectsList` (reads projects, may join project_roles)
- POST `/api/projects` — `controllers.ProjectsCreate` (gdb.Create project + create owner ProjectRole)
- GET `/api/projects/:id` — `controllers.ProjectsGet` (gdb.First project)
- PUT `/api/projects/:id` — `controllers.ProjectsUpdate` (gdb.Save)
- DELETE `/api/projects/:id` — `controllers.ProjectsDelete` (gdb.Delete)

Project members (RBAC):
- GET `/api/projects/:id/members` — `controllers.MembersList` (gdb.Where project roles)
- POST `/api/projects/:id/members` — `controllers.MembersUpsert` (create/update ProjectRole)
- DELETE `/api/projects/:id/members/:userId` — `controllers.MembersDelete` (delete ProjectRole)

### Datasets (nested under project)
- GET `/api/projects/:id/datasets` — `controllers.DatasetsList` (gdb.Where find datasets)
- POST `/api/projects/:id/datasets` — `controllers.DatasetsCreate` (create dataset record)
- GET `/api/projects/:id/datasets/:datasetId` — `controllers.DatasetsGet` (read dataset)
- PUT `/api/projects/:id/datasets/:datasetId` — `controllers.DatasetsUpdate` (update dataset; also parses/sets structured target fields)
- DELETE `/api/projects/:id/datasets/:datasetId` — `controllers.DatasetsDelete` (delete dataset)

File uploads and preview endpoints (dataset-level) — many perform DB updates/reads:
- POST `/api/projects/:id/datasets/:datasetId/upload` — `controllers.DatasetUpload`
  - Stores upload file, updates `Dataset` (LastUploadPath/LastUploadAt), creates/ingests main table and updates `DatasetMeta` (upsert)
- POST `/api/projects/:id/datasets/:datasetId/append` — `controllers.AppendUpload` (creates DatasetUpload, opens change request)
- POST `/api/projects/:id/datasets/:datasetId/append/validate` — `controllers.AppendValidate` (validation + DB interactions)
- POST `/api/projects/:id/datasets/:datasetId/append/open` — `controllers.AppendOpen` (create ChangeRequest)
- POST `/api/projects/:id/datasets/:datasetId/append/preview` — `controllers.AppendPreview` (may use DB)
- POST `/api/projects/:id/datasets/:datasetId/append/json` — `controllers.AppendJSON` (ingest or create upload)
- POST `/api/projects/:id/datasets/:datasetId/append/json/validate` — `controllers.AppendJSONValidate`
- GET `/api/projects/:id/datasets/:datasetId/sample` — `controllers.DatasetSample` (reads sample from main table or last upload)
- GET `/api/projects/:id/datasets/:datasetId/stats` — `controllers.DatasetStats` (reads DatasetMeta, counts rows)
- POST `/api/projects/:id/datasets/:datasetId/query` — `controllers.DatasetQuery` (queries main table JSON content)

### Top-level dataset endpoints
- POST `/api/datasets` — `controllers.DatasetsCreateTop`
  - Creates `Dataset` record (now also parses/stores structured target fields)
- GET `/api/datasets/:id/schema` — `controllers.DatasetSchemaGet` (read dataset schema)
- POST `/api/datasets/:id/schema` — `controllers.DatasetSchemaSet` (save dataset schema)
- POST `/api/datasets/:id/rules` — `controllers.DatasetRulesSet` (save rules)
- POST `/api/datasets/:id/data/append` — `controllers.DatasetAppendTop`
- POST `/api/datasets/:id/data/append/validate` — `controllers.DatasetAppendValidateTop`
- POST `/api/datasets/:id/data/append/open` — `controllers.DatasetAppendOpenTop`
- GET `/api/datasets/:id/data` — `controllers.DatasetDataGet` (reads rows from main table)
- GET `/api/datasets/:id/stats` — `controllers.DatasetStats` (same as project-scoped)
- POST `/api/datasets/:id/query` — `controllers.DatasetQuery`
- POST `/api/datasets/:id/data/append/json/validate` — `controllers.DatasetAppendJSONValidateTop`

### Change requests / approvals
- POST `/api/projects/:id/changes/:changeId/approve` — `controllers.ChangeApprove` (saves ChangeRequest status, may apply staging -> main table)
- POST `/api/projects/:id/changes/:changeId/reject` — `controllers.ChangeReject` (update CR status)
- POST `/api/projects/:id/changes/:changeId/withdraw` — `controllers.ChangeWithdraw`
- GET `/api/projects/:id/changes` — `controllers.ChangesList` (read change requests)
- GET `/api/projects/:id/changes/:changeId` — `controllers.ChangeGet` (read CR)
- GET `/api/projects/:id/changes/:changeId/preview` — `controllers.ChangePreview` (reads staging/main tables)
- GET `/api/projects/:id/changes/:changeId/comments` — `controllers.ChangeCommentsList` (reads comments)
- POST `/api/projects/:id/changes/:changeId/comments` — `controllers.ChangeCommentsCreate` (create comment)

### Query APIs (read-only query execution + saved/history)
- POST `/api/query/execute` — `controllers.ExecuteQueryHandler`
  - Runs user-provided SELECT query (server enforces SELECT-only) and returns columns/rows. Uses DB directly (db.Raw)
- POST `/api/query/save` — `controllers.SaveQueryHandler`
  - Saves `SavedQuery` (db.Create)
- GET `/api/query/history/:projectId` — `controllers.HistoryHandler`
  - Reads `QueryHistory` entries (db.Where/Find)

### Admin / misc
- Many controllers use DB for lookups and modifications, including `controllers.admin.go`, `controllers.members.go`, `controllers.projects.go`, `controllers.changes.go`, `controllers.change_details.go`, `controllers.datasets.go`, etc. See code for details.

---

## How to keep this doc current
- When adding a new GORM model (`go-service/models/*.go`) add its fields to this doc.
- When adding new endpoints that read/write DB state, add an entry under the API section with HTTP method, path and DB effect.

---

If you want, I can:
- add a small backfill migration script to populate `target_database/target_schema/target_table` from existing `target_dsn` values, or
- produce a simple SQL script (for Postgres) that backfills structured fields from `target_dsn`.

## DB hardening

- `go-service/migrations/007_protect_audit_logs.sql` — creates a trigger that prevents UPDATE/DELETE on `audit_logs`, enforcing append-only behavior at the DB level. Apply this migration on Postgres to protect audit integrity.

