# Oreo.io API Reference

**Version:** 3.0  
**Base URL:** `http://localhost:8080/api`  
**Authentication:** JWT Bearer Token (except auth endpoints)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Projects](#projects)
3. [Datasets](#datasets)
4. [Change Requests (Approvals)](#change-requests)
5. [Queries](#queries)
6. [Admin](#admin)
7. [User Settings](#user-settings)
8. [Security & Governance](#security--governance)
9. [Jobs](#jobs)
10. [Data Operations](#data-operations)

---

## Authentication

All authenticated endpoints require a JWT token in the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

### POST /api/auth/register

Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "message": "registered",
  "user_id": 1
}
```

**Validation:**
- Email must be valid RFC-compliant format
- Password must be 8+ characters with uppercase, lowercase, digit, and special character

---

### POST /api/auth/login

Authenticate and receive JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "user"
  }
}
```

Sets `token` cookie (HttpOnly, Secure in production).

**Error Responses:**
- `401 Unauthorized` - Invalid credentials
- `400 Bad Request` - Missing fields

---

### POST /api/auth/google

Authenticate via Google OAuth.

**Request:**
```json
{
  "credential": "<google_id_token>"
}
```

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "email": "user@gmail.com",
    "role": "user"
  }
}
```

---

### POST /api/auth/logout

Logout and clear authentication token.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "message": "logged out"
}
```

---

### GET /api/auth/me

Get current authenticated user information.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "ok": true,
  "id": 1,
  "email": "user@example.com",
  "role": "user"
}
```

---

### POST /api/auth/refresh

Refresh JWT token before expiration.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## Projects

Projects are the top-level organizational units. Each project can contain multiple datasets and has role-based access control (RBAC).

### GET /api/projects

List all projects accessible to the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "projects": [
    {
      "id": 1,
      "name": "Sales Analytics",
      "description": "Q4 sales data analysis",
      "owner_id": 1,
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

---

### POST /api/projects

Create a new project.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "name": "Customer Analytics",
  "description": "Customer behavior and retention analysis"
}
```

**Response:** `201 Created`
```json
{
  "id": 2,
  "name": "Customer Analytics",
  "description": "Customer behavior and retention analysis",
  "owner_id": 1,
  "created_at": "2025-01-20T14:00:00Z"
}
```

**Validation:**
- `name` is required (min 1 character)

---

### GET /api/projects/:id

Get project details.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "id": 1,
  "name": "Sales Analytics",
  "description": "Q4 sales data analysis",
  "owner_id": 1,
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T10:30:00Z"
}
```

---

### PUT /api/projects/:id

Update project details.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "name": "Sales Analytics 2025",
  "description": "Updated sales analysis for 2025"
}
```

**Response:** `200 OK`
```json
{
  "message": "project updated"
}
```

**Authorization:** Requires `owner` or `admin` role on the project.

---

### DELETE /api/projects/:id

Delete a project and all associated datasets.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "message": "project deleted"
}
```

**Authorization:** Requires `owner` role.

---

## Project Members (RBAC)

### GET /api/projects/:id/members

List all project members and their roles.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "members": [
    {
      "user_id": 1,
      "email": "owner@example.com",
      "role": "owner"
    },
    {
      "user_id": 2,
      "email": "editor@example.com",
      "role": "editor"
    },
    {
      "user_id": 3,
      "email": "viewer@example.com",
      "role": "viewer"
    }
  ]
}
```

**Roles:**
- `owner` - Full control, can delete project
- `admin` - Manage members, datasets, approve changes
- `editor` - Create/modify datasets, submit changes
- `viewer` - Read-only access

---

### GET /api/projects/:id/members/me

Get current user's role in the project.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "role": "editor"
}
```

---

### POST /api/projects/:id/members

Add or update a project member.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "user_email": "newmember@example.com",
  "role": "editor"
}
```

**Response:** `200 OK`
```json
{
  "message": "member added"
}
```

**Authorization:** Requires `owner` or `admin` role.

---

### DELETE /api/projects/:id/members/:userId

Remove a member from the project.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "message": "member removed"
}
```

**Authorization:** Requires `owner` or `admin` role.

---

## Datasets

Datasets store tabular data and support versioning, schema management, and approval workflows.

### GET /api/projects/:id/datasets

List all datasets in a project.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "datasets": [
    {
      "id": 1,
      "project_id": 1,
      "name": "customers",
      "schema": "{\"fields\":[{\"name\":\"id\",\"type\":\"integer\"}]}",
      "storage_backend": "delta",
      "created_at": "2025-01-15T11:00:00Z"
    }
  ]
}
```

---

### POST /api/projects/:id/datasets

Create a new dataset in the project.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "name": "orders",
  "schema": "{\"fields\":[{\"name\":\"order_id\",\"type\":\"integer\"},{\"name\":\"amount\",\"type\":\"float\"}]}",
  "storage_backend": "delta",
  "target": {
    "type": "postgres",
    "dsn": "analytics.orders"
  }
}
```

**Response:** `201 Created`
```json
{
  "id": 2,
  "name": "orders",
  "project_id": 1,
  "storage_backend": "delta"
}
```

**Storage Backends:**
- `delta` - Delta Lake (default, recommended)
- `postgres` - PostgreSQL tables

**Authorization:** Requires `editor`, `admin`, or `owner` role.

---

### GET /api/projects/:id/datasets/:datasetId

Get dataset details including metadata.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "id": 1,
  "project_id": 1,
  "name": "customers",
  "schema": "{\"fields\":[{\"name\":\"id\",\"type\":\"integer\"}]}",
  "storage_backend": "delta",
  "row_count": 15000,
  "column_count": 8,
  "last_update_at": "2025-01-18T09:30:00Z",
  "table_location": "/data/delta/1"
}
```

---

### PUT /api/projects/:id/datasets/:datasetId

Update dataset metadata.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "name": "customer_master",
  "schema": "{\"fields\":[{\"name\":\"id\",\"type\":\"integer\"},{\"name\":\"name\",\"type\":\"string\"}]}"
}
```

**Response:** `200 OK`
```json
{
  "message": "dataset updated"
}
```

**Authorization:** Requires `editor`, `admin`, or `owner` role.

---

### DELETE /api/projects/:id/datasets/:datasetId

Delete a dataset and all associated data.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "message": "dataset deleted"
}
```

**Authorization:** Requires `admin` or `owner` role.

---

## Dataset Data Operations

### POST /api/projects/:id/datasets/:datasetId/upload

Upload a file for schema inference or data preview.

**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request:**
```
file: <binary_csv_or_parquet>
```

**Response:** `200 OK`
```json
{
  "upload_id": 123,
  "inferred_schema": {
    "fields": [
      {"name": "id", "type": "integer"},
      {"name": "name", "type": "string"}
    ]
  },
  "row_count": 1000
}
```

**Supported Formats:** CSV, Parquet (max 100MB)

---

### POST /api/projects/:id/datasets/:datasetId/append/validate

Validate a file before submitting for approval.

**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request:**
```
file: <binary_csv_or_parquet>
```

**Response:** `200 OK`
```json
{
  "upload_id": 124,
  "validation": {
    "valid": true,
    "row_count": 500,
    "schema_match": true,
    "errors": []
  }
}
```

**Validation Checks:**
- Schema compatibility
- Data type conformance
- Business rules (if configured)

---

### POST /api/projects/:id/datasets/:datasetId/append/open

Submit a change request for review and approval.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "upload_id": 124,
  "reviewer_email": "admin@example.com",
  "note": "Adding Q1 2025 customer data"
}
```

**Response:** `201 Created`
```json
{
  "change_id": 10,
  "status": "pending",
  "reviewer_id": 2,
  "created_at": "2025-01-20T15:00:00Z"
}
```

**Status Flow:** `pending` → `approved` / `rejected` / `withdrawn`

---

### POST /api/projects/:id/datasets/:datasetId/append/preview

Preview data from a file without persisting it.

**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request:**
```
file: <binary_csv>
limit: 100
```

**Response:** `200 OK`
```json
{
  "columns": ["id", "name", "email"],
  "rows": [
    [1, "John Doe", "john@example.com"],
    [2, "Jane Smith", "jane@example.com"]
  ],
  "total_rows": 1000
}
```

---

### POST /api/projects/:id/datasets/:datasetId/append/json

Append data directly via JSON (for small edits).

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "rows": [
    {"id": 1001, "name": "New Customer", "email": "new@example.com"}
  ]
}
```

**Response:** `200 OK`
```json
{
  "message": "appended",
  "rows_added": 1
}
```

---

### POST /api/projects/:id/datasets/:datasetId/append/json/validate

Validate JSON data before submission.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "rows": [
    {"id": 1001, "name": "New Customer", "email": "new@example.com"}
  ]
}
```

**Response:** `200 OK`
```json
{
  "upload_id": 125,
  "validation": {
    "valid": true,
    "row_count": 1,
    "errors": []
  }
}
```

---

### GET /api/projects/:id/datasets/:datasetId/sample

Get a sample of dataset records.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `limit` (optional, default: 100, max: 1000)

**Response:** `200 OK`
```json
{
  "columns": ["id", "name", "email"],
  "rows": [
    [1, "John Doe", "john@example.com"],
    [2, "Jane Smith", "jane@example.com"]
  ]
}
```

---

## Change Requests (Approvals)

### GET /api/projects/:id/changes

List all change requests for a project.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `status` (optional): `pending`, `approved`, `rejected`, `withdrawn`

**Response:** `200 OK`
```json
{
  "changes": [
    {
      "id": 10,
      "dataset_id": 1,
      "requester_id": 3,
      "requester_email": "editor@example.com",
      "reviewer_id": 2,
      "status": "pending",
      "note": "Adding Q1 2025 customer data",
      "created_at": "2025-01-20T15:00:00Z"
    }
  ]
}
```

---

### GET /api/projects/:id/changes/:changeId

Get change request details.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "id": 10,
  "dataset_id": 1,
  "dataset_name": "customers",
  "requester_id": 3,
  "requester_email": "editor@example.com",
  "reviewer_id": 2,
  "reviewer_email": "admin@example.com",
  "status": "pending",
  "note": "Adding Q1 2025 customer data",
  "upload_id": 124,
  "created_at": "2025-01-20T15:00:00Z"
}
```

---

### GET /api/projects/:id/changes/:changeId/preview

Preview the data that will be added if approved.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `limit` (optional, default: 100)

**Response:** `200 OK`
```json
{
  "columns": ["id", "name", "email"],
  "rows": [
    [1001, "New Customer", "new@example.com"]
  ],
  "total_rows": 500
}
```

---

### POST /api/projects/:id/changes/:changeId/approve

Approve a change request and apply the data.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "comment": "Looks good, approved for production"
}
```

**Response:** `200 OK`
```json
{
  "message": "change approved and applied",
  "rows_added": 500
}
```

**Authorization:** Must be the assigned reviewer or have `admin`/`owner` role.

---

### POST /api/projects/:id/changes/:changeId/reject

Reject a change request.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "reason": "Data quality issues found in rows 45-50"
}
```

**Response:** `200 OK`
```json
{
  "message": "change rejected"
}
```

**Authorization:** Must be the assigned reviewer or have `admin`/`owner` role.

---

### POST /api/projects/:id/changes/:changeId/withdraw

Withdraw a submitted change request.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "message": "change withdrawn"
}
```

**Authorization:** Must be the requester or have `admin`/`owner` role.

---

### GET /api/projects/:id/changes/:changeId/comments

Get comments on a change request.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "comments": [
    {
      "id": 1,
      "change_id": 10,
      "user_id": 2,
      "user_email": "admin@example.com",
      "text": "Please verify rows 100-150",
      "created_at": "2025-01-20T16:00:00Z"
    }
  ]
}
```

---

### POST /api/projects/:id/changes/:changeId/comments

Add a comment to a change request.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "text": "I've verified the data and it looks correct"
}
```

**Response:** `201 Created`
```json
{
  "id": 2,
  "text": "I've verified the data and it looks correct",
  "created_at": "2025-01-20T16:30:00Z"
}
```

---

## Queries

### POST /api/datasets/:id/query

Execute SQL query on a dataset.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "sql": "SELECT * FROM customers WHERE country = 'USA' LIMIT 100"
}
```

**Response:** `200 OK`
```json
{
  "columns": ["id", "name", "email", "country"],
  "rows": [
    [1, "John Doe", "john@example.com", "USA"]
  ],
  "execution_time_ms": 45
}
```

**Security:** Queries are validated and sandboxed. Only SELECT statements allowed.

---

## Admin

Admin endpoints require the `X-Admin-Password` header.

### GET /api/admin/users

List all users (admin only).

**Headers:** 
- `X-Admin-Password: <admin_password>`

**Response:** `200 OK`
```json
{
  "users": [
    {
      "id": 1,
      "email": "user@example.com",
      "role": "user",
      "created_at": "2025-01-10T08:00:00Z"
    }
  ]
}
```

---

### POST /api/admin/users

Create a new user (admin only).

**Headers:** 
- `X-Admin-Password: <admin_password>`

**Request:**
```json
{
  "email": "newadmin@example.com",
  "password": "SecurePass123!",
  "role": "admin"
}
```

**Response:** `201 Created`
```json
{
  "id": 5,
  "email": "newadmin@example.com",
  "role": "admin"
}
```

---

### PUT /api/admin/users/:userId

Update user details (admin only).

**Headers:** 
- `X-Admin-Password: <admin_password>`

**Request:**
```json
{
  "role": "admin"
}
```

**Response:** `200 OK`
```json
{
  "message": "user updated"
}
```

---

### DELETE /api/admin/users/:userId

Delete a user (admin only).

**Headers:** 
- `X-Admin-Password: <admin_password>`

**Response:** `200 OK`
```json
{
  "message": "user deleted"
}
```

---

## User Settings

### GET /api/me/profile

Get current user profile.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "id": 1,
  "email": "user@example.com",
  "full_name": "John Doe",
  "avatar_url": "https://example.com/avatar.jpg"
}
```

---

### PUT /api/me/profile

Update user profile.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "full_name": "John Smith",
  "avatar_url": "https://example.com/new-avatar.jpg"
}
```

**Response:** `200 OK`
```json
{
  "message": "profile updated"
}
```

---

### GET /api/me/preferences

Get user preferences.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "theme": "dark",
  "notifications_enabled": true,
  "default_page_size": 50
}
```

---

### PUT /api/me/preferences

Update user preferences.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "theme": "light",
  "notifications_enabled": false
}
```

**Response:** `200 OK`
```json
{
  "message": "preferences updated"
}
```

---

## Utility Endpoints

### GET /healthz

Health check endpoint.

**Response:** `200 OK`
```json
{
  "status": "ok"
}
```

---

### GET /api/ping

Simple ping endpoint for connectivity tests.

**Response:** `200 OK`
```json
{
  "message": "pong"
}
```

---

### GET /api/storage/backend

Get active storage backend configuration.

**Response:** `200 OK`
```json
{
  "backend": "delta"
}
```

**Possible Values:** `delta`, `postgres`

---

### GET /api/check_table_exists

Check if a physical database table exists.

**Query Parameters:**
- `schema` (required)
- `table` (required)

**Response:** `200 OK`
```json
{
  "exists": true,
  "message": "Table already exists"
}
```

**Validation:** Table and schema names are validated to prevent SQL injection.

---

## Error Responses

All endpoints return consistent error responses:

### 400 Bad Request
```json
{
  "error": "invalid_input",
  "message": "Email is required"
}
```

### 401 Unauthorized
```json
{
  "error": "unauthorized",
  "message": "Invalid or expired token"
}
```

### 403 Forbidden
```json
{
  "error": "forbidden",
  "message": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "not_found",
  "message": "Resource not found"
}
```

### 413 Request Entity Too Large
```json
{
  "error": "file_too_large",
  "message": "File too large. Max allowed size is 100 MB.",
  "limit_mb": 100
}
```

### 500 Internal Server Error
```json
{
  "error": "internal_error",
  "message": "An unexpected error occurred"
}
```

---

## Rate Limiting

Currently no rate limiting is enforced. Production deployments should implement rate limiting at the API gateway level.

**Recommended Limits:**
- Authentication endpoints: 5 requests/minute
- Data upload endpoints: 10 requests/minute
- Query endpoints: 100 requests/minute
- Other endpoints: 1000 requests/minute

---

## Security

### Authentication
- JWT tokens expire after configured `SESSION_TIMEOUT` (default: 3600 seconds)
- Tokens are HttpOnly cookies in production
- Refresh tokens before expiration using `/api/auth/refresh`

### Authorization
- Role-based access control (RBAC) at project level
- Admin endpoints require `X-Admin-Password` header
- SQL injection prevention on all table name inputs
- Input validation on all user-provided data

### Configuration
See [SECURITY.md](./SECURITY.md) for security configuration details.

---

## Changelog

### Version 3.0 (2025-01-20)
- Refactored to clean architecture (cmd/, internal/)
- Centralized configuration with validation
- Added SQL injection prevention
- Enhanced error handling
- Added approve/reject workflow for data changes
- Migrated to Delta Lake storage backend

---

## Support

For issues and questions:
- GitHub Issues: https://github.com/saurabh22suman/oreo.io-v3/issues
- Documentation: https://github.com/saurabh22suman/oreo.io-v3/tree/main/docs
