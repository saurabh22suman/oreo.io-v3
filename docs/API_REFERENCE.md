# Oreo.io API Reference

This document provides a comprehensive reference for all API endpoints in Oreo.io.

## Architecture Overview

```
Frontend (React+Vite) ──HTTP──▶ Go Service (Gin) ──HTTP──▶ Python Service (FastAPI)
     :5173                           :8080                        :8000
```

- **Go Service** (`/api/*`): Authentication, authorization, metadata, proxies data operations to Python
- **Python Service** (`/`): Delta Lake operations, validation, live edit, merge execution

---

## Go Service API (Port 8080)

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login with email/password |
| `POST` | `/api/auth/google` | Login with Google ID token |
| `GET` | `/api/auth/me` | Get current user info |
| `POST` | `/api/auth/logout` | Logout current session |

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/projects` | List all user's projects |
| `POST` | `/api/projects` | Create a new project |
| `GET` | `/api/projects/:id` | Get project details |
| `PUT` | `/api/projects/:id` | Update project |
| `DELETE` | `/api/projects/:id` | Delete project |

#### Create Project
```http
POST /api/projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Project",
  "description": "Optional description"
}
```

---

### Project Members (RBAC)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/projects/:id/members` | List project members |
| `POST` | `/api/projects/:id/members` | Add/update member |
| `GET` | `/api/projects/:id/members/me` | Get my role in project |
| `DELETE` | `/api/projects/:id/members/:userId` | Remove member |

**Roles**: `owner`, `contributor`, `viewer`, `editor`

---

### Datasets

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/projects/:projectId/datasets` | List datasets in project |
| `POST` | `/api/projects/:projectId/datasets` | Create dataset |
| `GET` | `/api/projects/:projectId/datasets/:id` | Get dataset |
| `PUT` | `/api/projects/:projectId/datasets/:id` | Update dataset |
| `DELETE` | `/api/projects/:projectId/datasets/:id` | Delete dataset |

#### Top-Level Dataset Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/datasets` | Create dataset (alt) |
| `POST` | `/api/datasets/prepare` | Prepare dataset with file |
| `POST` | `/api/datasets/stage-upload` | Stage file upload |
| `POST` | `/api/datasets/finalize` | Finalize staged dataset |
| `DELETE` | `/api/datasets/staging/:staging_id` | Delete staged upload |

---

### Dataset Data Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/datasets/:id/data` | Get dataset data (paginated) |
| `GET` | `/api/datasets/:id/stats` | Get dataset statistics |
| `GET` | `/api/datasets/:id/schema` | Get dataset schema |
| `POST` | `/api/datasets/:id/schema` | Set dataset schema |
| `POST` | `/api/datasets/:id/rules` | Set validation rules |
| `POST` | `/api/datasets/:id/query` | Query dataset |

#### Query Dataset
```http
POST /api/datasets/:id/query
Authorization: Bearer <token>
Content-Type: application/json

{
  "where": { "status": "active" },
  "limit": 100,
  "offset": 0
}
```

---

### Append/Upload

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/datasets/:id/data/append` | Append data (file) |
| `POST` | `/api/datasets/:id/data/append/validate` | Validate append |
| `POST` | `/api/datasets/:id/data/append/open` | Open change request |
| `POST` | `/api/datasets/:id/data/append/json/validate` | Validate JSON append |

---

### Live Edit Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/datasets/:id/live-sessions` | Start session |
| `GET` | `/api/datasets/:id/live-sessions/:sessionId` | Get session |
| `DELETE` | `/api/datasets/:id/live-sessions/:sessionId` | Delete session |
| `POST` | `/api/datasets/:id/live-sessions/:sessionId/edits` | Save cell edit |
| `POST` | `/api/datasets/:id/live-sessions/:sessionId/edits/batch` | Save bulk edits |
| `POST` | `/api/datasets/:id/live-sessions/:sessionId/preview` | Get edit preview |
| `POST` | `/api/datasets/:id/data/live-edit/open` | Submit as change request |

---

### Change Requests

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/projects/:projectId/changes` | List changes |
| `GET` | `/api/changes/:id` | Get change details |
| `POST` | `/api/projects/:projectId/changes/:id/approve` | Approve change |
| `POST` | `/api/projects/:projectId/changes/:id/reject` | Reject change |
| `POST` | `/api/projects/:projectId/changes/:id/withdraw` | Withdraw change |

---

### Snapshots & Audit

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/datasets/:id/snapshots/calendar` | Get snapshot calendar |
| `GET` | `/api/datasets/:id/snapshots/:version/data` | Get snapshot data |
| `POST` | `/api/datasets/:id/snapshots/:version/restore` | Restore snapshot |
| `GET` | `/api/datasets/:id/audit` | List audit events |
| `GET` | `/api/audit/:auditId` | Get audit event |
| `GET` | `/api/audit/:auditId/diff` | Get audit diff |
| `GET` | `/api/audit/:auditId/validation` | Get audit validation |

---

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/security/notifications` | List notifications |
| `POST` | `/api/security/notifications/read` | Mark as read |
| `POST` | `/api/security/notifications/unread` | Mark as unread |
| `GET` | `/api/security/notifications/unread_count` | Get unread count |
| `DELETE` | `/api/security/notifications` | Delete notifications |
| `GET` | `/api/security/notifications/stream` | SSE stream |

---

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/users` | List all users (admin only) |
| `PUT` | `/api/admin/users/:id` | Update user (admin only) |
| `DELETE` | `/api/admin/users/:id` | Delete user (admin only) |

---

### Health Checks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/healthz` | Go service health |
| `GET` | `/healthz/duckdb` | DuckDB health (experimental) |

---

## Python Service API (Port 8000)

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service health |
| `GET` | `/health/duckdb` | DuckDB pool health |

---

### Delta Lake Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/delta/query` | Execute SQL query on Delta tables |
| `POST` | `/delta/ensure` | Ensure Delta table exists |
| `POST` | `/delta/insert` | Insert rows into Delta table |
| `POST` | `/delta/append` | Append to Delta table (merge) |
| `POST` | `/delta/merge` | Merge staging into main |
| `POST` | `/delta/merge-cr` | Merge change request |

#### Delta Query
```http
POST /delta/query
Content-Type: application/json

{
  "sql": "SELECT * FROM test.mytable WHERE status = 'active'",
  "table_mappings": {
    "test.mytable": "15/36"
  },
  "limit": 100,
  "offset": 0
}
```

---

### Schema & Validation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/schema/validate` | Validate data against JSON Schema |
| `POST` | `/schema/infer` | Infer schema from file |
| `POST` | `/rules/validate` | Validate against business rules |
| `POST` | `/rules/validate/cell` | Cell-level validation |
| `POST` | `/rules/validate/batch` | Batch validation |

---

### Live Edit (Python Backend)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/live-edit/session` | Create session |
| `GET` | `/live-edit/session/{session_id}` | Get session |
| `DELETE` | `/live-edit/session/{session_id}` | Delete session |
| `POST` | `/live-edit/session/{session_id}/save-cell` | Save cell edit |
| `POST` | `/live-edit/session/{session_id}/preview` | Preview changes |
| `POST` | `/live-edit/session/{session_id}/submit` | Submit as CR |
| `POST` | `/live-edit/grid-data` | Get grid data with edits |

---

### Change Requests (Python)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/change-requests` | List change requests |
| `GET` | `/change-requests/{cr_id}` | Get change request |
| `POST` | `/change-requests/{cr_id}/merge` | Execute merge |

---

### Snapshots (Python)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/snapshots/{dataset_id}/history` | Get version history |
| `GET` | `/snapshots/{dataset_id}/version/{version}` | Get data at version |
| `POST` | `/snapshots/{dataset_id}/restore` | Restore to version |

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "error_code",
  "message": "Human-readable message",
  "details": { }
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (not logged in) |
| 403 | Forbidden (no permission) |
| 404 | Not Found |
| 409 | Conflict (merge conflict, duplicate) |
| 422 | Unprocessable (validation failed) |
| 500 | Server Error |
| 502 | Bad Gateway (Python service unreachable) |

---

## Authentication

Most endpoints require a JWT token. Include it in the `Authorization` header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Or rely on the httpOnly cookie set by the login endpoint.

---

## Rate Limits

Currently no rate limits are enforced. This may change in production.

---

## Versioning

API is currently unversioned. Breaking changes will be documented in release notes.
