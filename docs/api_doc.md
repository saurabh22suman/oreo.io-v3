# Oreo.io v3 API Reference

This document describes the REST APIs exposed by the Go service. It’s organized by route groups, with request/response shapes, auth, and common errors. All responses are JSON.

Base URL
- Local dev: http://localhost:8081
- API prefix: /api

Auth
- JWT Bearer required for most endpoints (Authorization: Bearer <token>)
- Obtain a token via /api/auth/login or /api/auth/google
- Admin endpoints use a static header X-Admin-Password (no JWT required)

HTTP Status Codes
- 2xx: success
- 4xx: client errors (validation, forbidden, not found)
- 5xx: server/db errors

Common Error Shapes
- { "error": "invalid_payload" }
- { "error": "forbidden" }
- { "error": "not_found" }
- { "error": "db" }
- { "error": "python_unreachable" }
- { "error": "file_too_large", "message": "File too large. Max allowed size is 100 MB.", "limit_mb": 100 }

---

## Health
GET /healthz
- Public health check.
- 200 { "status": "ok" }

GET /api/ping
- 200 { "message": "pong" }

---

## Authentication
POST /api/auth/register
- Body: { email: string, password: string }
- 201 { id, email }
- 409 { error: "email_exists" }

POST /api/auth/login
- Body: { email: string, password: string }
- 200 { token }
- 401 { error: "invalid_creds" }

POST /api/auth/google
- Body: { id_token: string }
- 200 { token }
- 401/500 per validation

GET /api/auth/me
- Auth: Bearer
- 200 { ok: true, id, email, role }

POST /api/auth/refresh
- Auth: Bearer
- 200 { token }

---

## Admin (static password)
Header: X-Admin-Password: <ADMIN_PASSWORD>

GET /api/admin/users
- 200 [User]

POST /api/admin/users
- Body: { email, password, role? }
- 201 User

PUT /api/admin/users/:userId
- Body: { email?, password?, role? }
- 200 User

DELETE /api/admin/users/:userId
- 200 { ok: true }

---

## Projects
All routes require Bearer auth.

GET /api/projects
- Lists projects for the user (owner or member).
- 200 [Project]

POST /api/projects
- Body: { name: string, description?: string }
- 201 Project

GET /api/projects/:id
- 200 Project
- 403 if not a member

PUT /api/projects/:id
- Roles: owner, contributor
- Body: { name, description }
- 200 Project

DELETE /api/projects/:id
- Role: owner
- 204 No Content

### Project Members
GET /api/projects/:id/members
- Any project role
- 200 [{ id, email, role }]

GET /api/projects/:id/members/me
- Any project role
- 200 { role: string | null }

POST /api/projects/:id/members
- Role: owner
- Body: { email, role in [owner|contributor|approver|viewer] ("editor" accepted as alias of contributor) }
- 200 { id, email, role }

DELETE /api/projects/:id/members/:userId
- Role: owner
- 204 No Content
- 400 { error: "cannot_remove_self" | "cannot_remove_owner" }

---

## Datasets (nested under project)
All routes require Bearer auth.
Base: /api/projects/:id/datasets

GET ""
- Roles: owner, contributor, viewer
- 200 [Dataset]

POST ""
- Roles: owner, contributor
- Body: { name, schema?, rules?, source?, target? }
- 201 Dataset

GET "/:datasetId"
- Roles: owner, contributor, viewer
- 200 Dataset

PUT "/:datasetId"
- Roles: owner, contributor
- Body: { name, schema?, rules? }
- 200 Dataset

DELETE "/:datasetId"
- Role: owner
- 204

POST ":datasetId/upload"
- Role: owner
- multipart/form-data: file
- 201 { stored: true, path, dataset_id }
- Also infers and updates dataset schema.

GET "/:datasetId/sample"
- Roles: owner, contributor, approver, viewer
- 200 { data: [], columns: [], rows, total_rows }

### Append flow (file)
POST ":datasetId/append/preview"
- Roles: owner, contributor, viewer
- multipart/form-data: file
- Query: limit (n, default 500), offset (default 0)
- 200 preview JSON

POST ":datasetId/append"
- Roles: owner, contributor
- multipart/form-data: file, reviewer_id (single reviewer)
- Validates schema/rules; if ok, creates Change Request and staging table
- 201 { ok: true, change_request }

POST ":datasetId/append/validate"
- Roles: owner, contributor
- multipart/form-data: file
- Validates only, stores as upload
- 200 { ok: boolean, upload_id, schema?, rules? }

POST ":datasetId/append/open"
- Roles: owner, contributor
- Body: { upload_id: number, reviewer_id?: number, reviewer_ids?: number[], title?: string, comment?: string }
- Creates a CR with multiple reviewers (all must approve)
- 201 { ok: true, change_request }

### Append flow (edited JSON rows)
POST "/:datasetId/append/json"
- Roles: owner, contributor
- Body: { rows: object[], filename?: string, reviewer_id?: number, reviewer_ids?: number[] }
- Validates against dataset schema/rules, stores as upload, creates CR
- 201 { ok: true, change_request } or 200 { ok: false, schema? | rules? }

POST "/:datasetId/append/json/validate"
- Roles: owner, contributor
- Body: { rows: object[], filename?: string }
- Validates and stores as upload for later open
- 200 { ok: true, upload_id } or 200 { ok: false, schema? | rules? }

---

## Datasets (top-level shortcuts)
All routes require Bearer auth.
Base: /api/datasets

POST ""
- Body: { project_id, name, source?, target? }
- 201 Dataset

GET ":id/schema"
- Roles: owner, contributor, viewer
- 200 { schema: string }

POST ":id/schema"
- Roles: owner, contributor
- Body: { schema: string }
- 200 { ok: true }

POST ":id/rules"
- Roles: owner, contributor
- Body: { rules: string }
- 200 { ok: true }

POST ":id/data/append"
- Roles: owner, contributor
- Maps to project append upload

POST ":id/data/append/validate"
- Roles: owner, contributor
- Validates and stores upload
- 200 { ok, upload_id, schema?, rules? }

POST ":id/data/append/open"
- Roles: owner, contributor
- Creates CR using prior upload
- 201 { ok: true, change_request }

GET ":id/data"
- Roles: owner, contributor, viewer
- Query: limit, offset
- 200 { data, columns }

GET ":id/stats"
- Roles: owner, contributor, viewer
- 200 { last_upload_at, owner_name, row_count, column_count, last_update_at, table_location, pending_approvals }

POST ":id/query"
- Roles: owner, contributor, viewer
- Body: { where?: object, limit?: number, offset?: number }
- 200 { data, columns }

POST ":id/data/append/json/validate"
- Roles: owner, contributor
- Body: { rows: object[], filename?: string }
- 200 { ok: true, upload_id } or 200 { ok: false, schema? | rules? }

---

## Change Requests (approvals)
Base: /api/projects/:id/changes

GET ""
- Roles: any member (owner, contributor, approver, viewer)
- 200 [ChangeRequest]

GET "/:changeId"
- Roles: any member
- 200 { change, reviewer_email?, reviewer_emails?, reviewer_states? }

GET "/:changeId/preview"
- Roles: any member
- 200 preview of stored upload (JSON parsed locally; CSV/XLSX via python /sample)

POST "/:changeId/approve"
- Roles: assigned reviewer OR project approver
- Multi-reviewer: marks the acting reviewer approved; only applies append when all reviewers approved
- 200 { ok: true, change_request } or 200 { ok: true, message: "Waiting for all reviewers to approve.", change_request }
- On final approval for append: dataset main table updated, staging dropped, dataset version recorded

POST "/:changeId/reject"
- Roles: assigned reviewer OR project approver
- 200 { ok: true, change_request } (status becomes rejected)

POST "/:changeId/withdraw"
- Role: change creator only
- 200 { ok: true, change_request } (status becomes withdrawn)

GET "/:changeId/comments"
- Roles: any member
- 200 [ { id, project_id, change_request_id, user_id, user_email, body, created_at } ]

POST "/:changeId/comments"
- Roles: any member
- Body: { body: string }
- 201 { id, project_id, change_request_id, user_id, user_email, body, created_at }

---

## Data Services proxy (to python-service)
All routes require Bearer auth.

POST /api/data/validate
- Body: { json_schema, data }
- 200 { valid: boolean, ... }

POST /api/data/transform
- Body: transform spec
- 200 transformed result

POST /api/data/export
- Body: export spec
- 200 export payload

POST /api/data/infer-schema
- multipart/form-data: file
- 200 { schema }

POST /api/data/rules/validate
- Body: { rules, data }
- 200 { valid: boolean, ... }

---

## Models (simplified)
- User: { id, email, role }
- Project: { id, name, description, owner_id }
- Dataset: { id, project_id, name, schema, rules, source, target_type, target_dsn, last_upload_path, last_upload_at }
- ChangeRequest: { id, project_id, dataset_id, type: "append", status: "pending"|"approved"|"rejected"|"withdrawn", title, payload, reviewer_id, reviewers: json[], reviewer_states: json[] }
- ChangeComment: { id, project_id, change_request_id, user_id, body, created_at }
- DatasetUpload: { id, project_id, dataset_id, filename, content }
- DatasetVersion: { id, dataset_id, data, edited_by, edited_at, status, approvers }

Notes
- Roles used in RBAC: owner, contributor, approver, viewer ("editor" accepted as alias of contributor in member APIs).
- Append approval applies rows from staging (ds_<id>_stg_<cr>) into main (ds_<id>) when all reviewers approve.
