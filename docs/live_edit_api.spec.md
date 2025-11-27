# Live Edit API Specification for Oreo.io

**Purpose:**
This document specifies the HTTP/JSON API for the Excel-like *Live Edit* feature layered on Delta Lake. It is written for an AI coding agent (Sonnet-4.5) to implement endpoints, request/response contracts, validation rules, and lifecycle flows for editing, staging, approval, and merging edits into production Delta tables.


---

## High-level concepts

* **Dataset**: A Delta table identified by `dataset_id` and stored under `DELTA_DATA_ROOT/<project>/<dataset_id>/main`.
* **Live Edit Session**: A short-lived editing session owned by a user; edits saved to a lightweight staging location: `.../live_edit/<session_id>/`.
* **Live Edit Row Edits**: Stored as cell-level records in a Delta staging table; structure keeps row primary key (`row_id`), `column`, `old_value`, `new_value`, `user_id`, `timestamp`.
* **Change Request**: A submission wrapping a set of edits from a session; has approvers and approval status. On approval, the staging edits are merged into the canonical dataset via Delta `MERGE`.
* **Validation**: Business rules executed per cell/row using Great Expectations; results are returned as structured JSON and saved as `validation_runs`.

---

## Auth & Headers

All endpoints require authentication via JWT (httpOnly cookie or `Authorization: Bearer <token>`).

Common headers:

```
Authorization: Bearer <jwt>
Content-Type: application/json
X-Request-ID: <uuid>        # idempotency and tracing
```

Responses follow JSON API shape; errors use HTTP status codes + structured body:

```json
{ "error": { "code": "DELTA_ADAPTER_UNAVAILABLE", "message": "Delta adapter not available" }}
```

---

## Endpoints

### 1) Start Live Edit Session

**POST** `/api/v1/datasets/{dataset_id}/live_sessions`

**Description:** Create a new live edit session; server allocates `session_id` and a lightweight staging path. Returns initial sample rows and metadata (editable flags, business rules per column).

**Request body:**

```json
{ "user_id": "u_123", "mode": "row_selection|full_table", "rows": [123,124] }
```

**Response 201:**

```json
{
  "session_id": "sess_abc",
  "staging_path": "/data/delta/<project>/<dataset_id>/live_edit/sess_abc/",
  "editable_columns": ["amount", "status"],
  "rules_map": {"amount": [{"type":"min","value":0}]},
  "sample_rows": [ {"row_id":123,...}, ... ]
}
```

**Notes:**

* `editable_columns` derived from metadata & business rules; non-editable columns must not be editable in UI.
* Session TTL enforced (e.g., 24h) and auto-cleanup scheduled.

---

### 2) Fetch Grid / Page

**GET** `/api/v1/datasets/{dataset_id}/data?page=1&limit=100&session_id=sess_abc`

**Description:** Returns paginated rows for grid rendering. If `session_id` provided, overlay any live edits (show `new_value`) and mark edited rows.

**Response 200:**

```json
{
  "meta": {"page":1,"limit":100,"total":12345},
  "columns": [ {"name":"user_id","type":"string","editable":false}, ...],
  "rows": [
     {"row_id":123, "cells": {"user_id":"u_8393","status":"pending","amount":450.5}, "edited": true}
  ]
}
```

**Behavior:**

* Server must merge base Delta table rows with any staging edits for `session_id` before returning results.

---

### 3) Edit Cell (single-cell update)

**POST** `/api/v1/datasets/{dataset_id}/live_sessions/{session_id}/edits`

**Description:** Save a single cell edit to the live staging area and validate against business rules. This endpoint is called by the grid when a user edits a cell.

**Request body:**

```json
{
  "row_id": 123,
  "column": "amount",
  "new_value": 450.50,
  "client_ts": "2025-11-22T10:00:00Z"
}
```

**Response 200 (valid):**

```json
{
  "status": "ok",
  "validation": { "valid": true, "messages": [] },
  "edit_id": "edit_789"
}
```

**Response 422 (invalid):**

```json
{
  "status": "error",
  "validation": { "valid": false, "messages": ["amount must be >= 0"] }
}
```

**Notes:**

* Implement server-side validation for cell-level rules instantly. Use GE `expect_column_*` expectations or custom rules.
* Save edit row into staging Delta: `session_edits(session_id)` table with schema `(edit_id, row_id, column, old_value, new_value, user_id, ts, validation_payload)`.
* Return `validation` payload to allow UI to visually show errors/warnings.

---

### 4) Bulk Save Edits (client-side batching)

**POST** `/api/v1/datasets/{dataset_id}/live_sessions/{session_id}/edits/batch`

**Description:** Accepts an array of edits (for keyboard-based fast editing). Server validates each edit and returns per-edit validation.

**Request body:**

```json
{ "edits": [ {"row_id":1,"column":"amount","new_value":10}, ... ] }
```

**Response 200:**

```json
{ "results": [ {"edit_id":"e1","valid":true},{"edit_id":"e2","valid":false,"messages":["..."] } ] }
```

---

### 5) Preview Change Request (generate patch summary)

**POST** `/api/v1/datasets/{dataset_id}/live_sessions/{session_id}/preview`

**Description:** Compile all edits in the session into a single preview object: counts (rows changed), diffs, validation summary, and estimated impacts (rows affected).

**Response 200:**

```json
{
  "summary": {"rows_changed": 5, "cells_changed": 12},
  "diffs": [ {"row_id":123, "column":"amount", "old":400, "new":450} ],
  "validation_summary": {"valid": 10, "warnings":2, "errors":0}
}
```

**Notes:**

* UI uses preview to show approver what will change.

---

### 6) Submit Change Request

**POST** `/api/v1/datasets/{dataset_id}/change_requests`

**Request body:**

```json
{
  "session_id": "sess_abc",
  "title": "Update amounts for batch A",
  "description": "Manual corrections from live edit",
  "approvers": ["u_approver1","u_approver2"],
  "notify": true
}
```

**Response 201:**

```json
{ "change_request_id": "cr_456", "status": "pending_approval" }
```

**Behavior:**

* Persist change_request metadata in `change_requests` table with pointer to staging path and session_id.
* Optionally trigger notifications (SSE/email/webhook) to approvers.

---

### 7) List / View Change Requests

**GET** `/api/v1/datasets/{dataset_id}/change_requests?status=pending`

**GET** `/api/v1/change_requests/{change_request_id}`

**Response sample:**

```json
{
  "id": "cr_456",
  "session_id": "sess_abc",
  "created_by": "u_123",
  "approvers": ["u_approver1"],
  "status": "pending_approval",
  "summary": {...}
}
```

---

### 8) Approve / Reject Change Request

**POST** `/api/v1/change_requests/{change_request_id}/approve`

**Request body:**

```json
{ "approver_id": "u_approver1", "comment": "LGTM" }
```

**Response 200:**

```json
{ "status": "approved", "merged_version": 123 }
```

**On approval, server must:**

1. Re-run full validation (GE) on staging edits; if errors exist, reject and return error.
2. Run Delta `MERGE` from staging path into `/main` path for dataset (atomic commit).
3. Record audit log and update `dataset_meta` (row count, last_commit_id, delta_version).
4. Delete or archive staging path.
5. Notify stakeholders.

**Reject endpoint:** POST `/api/v1/change_requests/{id}/reject` with `reason` field.

---

### 9) Abort / Cancel Live Session

**DELETE** `/api/v1/datasets/{dataset_id}/live_sessions/{session_id}`

**Behavior:**

* Delete staging edits and mark session as aborted. If change_request exists, disallow deletion unless CR is closed.

---

### 10) Merge Simulation / Dry-run (optional)

**POST** `/api/v1/change_requests/{id}/dry_run_merge`

**Description:** Execute a non-destructive simulation that computes diffs and validation results without committing.

**Response:** Summary + diff + estimated rows affected.

---

### 11) History & Versioning

**GET** `/api/v1/datasets/{dataset_id}/history` — returns Delta history (timestamp, user, operation, version).

**GET** `/api/v1/datasets/{dataset_id}/diff?from=10&to=12` — returns a compiled diff between two versions.

---

### 12) Health & Admin

**GET** `/api/v1/admin/delta_status` — check Delta adapter availability.

**POST** `/api/v1/admin/cleanup_staging` — admin-only: cleanup orphaned staging folders older than TTL.

---

## Data Models (simplified)

### `session_edits` (staging Delta table schema)

```sql
(edit_id STRING, session_id STRING, row_id STRING, column STRING, old_value STRING, new_value STRING, user_id STRING, ts TIMESTAMP, validation JSON)
```

### `change_requests` (metadata in metadata DB)

```sql
(id, dataset_id, session_id, created_by, approvers JSON[], status, title, description, created_at, approved_at, merged_version, staging_path)
```

### `validation_runs` (metadata DB + persisted audit in Delta)

```sql
(id, dataset_id, run_at, run_by, suite_name, status, summary JSON)
```

---

## Validation contract

A validation payload (returned per cell) must be structured like:

```json
{ "valid": true, "severity": "info|warning|error|fatal", "messages": ["..."], "expectation_id": "exp_123" }
```

* `fatal` blocks submission of the change request.
* `warning` is advisory but approver should see it.

---

## Concurrency & Conflict Handling

* Each edit stores `client_ts` and server calculates `edit_ts`.
* On approval merge, use `MERGE` with `WHEN MATCHED` conditions. If row was updated in main table after the session started (concurrent write), mark that row as conflict and surface to approver.
* Provide conflict resolution UI where approver can choose:

  * Overwrite main value
  * Reject this cell
  * Rebase session edits on top of latest main row

---

## Notifications / Events

Emit SSE events on these states:

* `live_session_created` {session_id}
* `edit_saved` {edit_id}
* `change_request_created` {change_request_id}
* `change_request_updated` {id, status}
* `change_request_approved` {id}

---

## Testing guidance for AI agent

1. Unit test cell-level validation logic with mocked GE expectations.
2. Integration test: start a session, perform edits, preview, submit CR with approver flows, simulate approval, assert Delta table content changed.
3. Load test: simulate many concurrent cell edits in one session.
4. Edge-case: test conflict detection when main table changed between session start and merge.

---

## Implementation notes / perf tips

* Do not clone entire dataset to staging; only save modified rows as `session_edits` (sparse changes). This reduces IO.
* Keep session edits as Delta for ACID + time travel, but partition by `session_id` or `user_id` for fast lookups.
* For overlays in `GET data`, use a left-join: `main LEFT JOIN session_edits (session_id=X) ON row_id` and prefer DuckDB for fast in-container queries.
* Use `optimize`/`vacuum` jobs to compact staging and main tables periodically.

---

## Example Flows

### Create session + single edit + submit + approve

1. POST /live_sessions → get `sess_abc`
2. POST /live_sessions/sess_abc/edits {row_id, col, new}
3. POST /live_sessions/sess_abc/preview → returns summary
4. POST /change_requests {session_id: sess_abc, approvers: [u1]}
5. Approver POST /change_requests/{id}/approve → server runs full GE suite then MERGE → response contains merged_version

---

End of spec.