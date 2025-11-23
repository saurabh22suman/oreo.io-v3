# Change Request Schema Specification for Oreo.io

**Purpose**
This document defines the **data model**, **metadata structure**, **lifecycle**, and **state transitions** for the *Change Request (CR)* system that powers Live Edit, Append, Approvals, Merges, Audit Logging, and Time Travel in Oreo.io.

This is a foundational contract for the backend (Go + Python), frontend (React + AG Grid), Delta Lake storage adapter, and validation engine (Great Expectations).

---

# 1. What is a Change Request?

A **Change Request (CR)** is a structured, auditable request to modify a Delta dataset. It represents a unit of change that:

* originates from a **Live Edit Session** or **Ingest/Append** operation,
* contains one or more edits/rows/files,
* undergoes **validation**,
* requires **approval**, and
* is merged atomically into the dataset's **main Delta table**.

CRs provide:

* governance and auditability,
* role-based control (owner → approver → merge),
* version boundaries for Delta Lake,
* user-friendly history and diffing.

---

# 2. Core Entities

## 2.1 Change Request

Represents a single unit of proposed change.

### Table: `change_requests`

| Field                | Type          | Description                                                           |
| -------------------- | ------------- | --------------------------------------------------------------------- |
| id                   | STRING (UUID) | Unique CR ID (cr_xxx)                                                 |
| project_id           | STRING        | Project owner of dataset                                              |
| dataset_id           | STRING        | Dataset being modified                                                |
| session_id           | STRING        | Live edit session ID, or null for direct ingest                       |
| title                | TEXT          | Human-readable title of this CR                                       |
| description          | TEXT          | Optional detailed description                                         |
| created_by           | STRING        | User who started the CR                                               |
| approvers            | JSON[]        | Assigned reviewers (list of user IDs)                                 |
| status               | ENUM          | `draft`, `pending_review`, `rejected`, `approved`, `merged`, `closed` |
| created_at           | TIMESTAMP     | Timestamp of CR creation                                              |
| updated_at           | TIMESTAMP     | Last status update                                                    |
| approved_at          | TIMESTAMP     | When approved                                                         |
| rejected_at          | TIMESTAMP     | When rejected                                                         |
| merged_at            | TIMESTAMP     | When final merge completed                                            |
| staging_path         | TEXT          | Absolute Delta path: `/staging/<cr_id>`                               |
| delta_version_before | INT           | Delta version before merge                                            |
| delta_version_after  | INT           | Delta version after merge                                             |
| row_count_added      | INT           | Number of rows inserted                                               |
| row_count_updated    | INT           | Rows updated (via merge)                                              |
| row_count_deleted    | INT           | Rows deleted (rare; only if delete rules allowed)                     |
| cell_count_changed   | INT           | Cell-level edit count                                                 |
| validation_summary   | JSON          | Summary of GE run (warnings/errors)                                   |
| warnings_count       | INT           | Total warnings                                                        |
| errors_count         | INT           | Total errors                                                          |
| fatal_errors         | INT           | Total fatal errors                                                    |
| metadata             | JSON          | Arbitrary metadata for future extensions                              |

### CR Status Enum

```
draft
pending_review
rejected
approved
merged
closed (optional archival state)
```

---

# 3. Associated Tables

## 3.1 `change_request_events`

Captures lifecycle events for audit & UI timeline.

| Field      | Type      | Description                                                                    |
| ---------- | --------- | ------------------------------------------------------------------------------ |
| id         | STRING    | unique event ID                                                                |
| cr_id      | STRING    | change request ID                                                              |
| event_type | STRING    | `created`, `edited`, `submitted`, `approved`, `rejected`, `merged`, `restored` |
| actor_id   | STRING    | user ID performing event                                                       |
| message    | TEXT      | Optional comment                                                               |
| created_at | TIMESTAMP | Server time                                                                    |

This powers user-friendly activity feeds.

---

## 3.2 `change_request_edits`

Stores aggregated diff summary (optional; detailed diffs live in Delta audit folder).

| Field | Type   |                        |
| ----- | ------ | ---------------------- |
| cr_id | STRING |                        |
| diffs | JSON   | List of row+cell diffs |

### Example diff entry

```json
{
  "row_id": "488",
  "changes": {
    "amount": {"old": 450, "new": 982},
    "status": {"old": "pending", "new": "approved"}
  }
}
```

---

# 4. Delta Lake Folder Structure Integration

Each CR gets its own staging Delta table:

```
/staging/<cr_id>/
    _delta_log/
    part-*.parquet
```

Audit data stored under:

```
/audit/change_requests/<cr_id>/diff.json
/audit/change_requests/<cr_id>/validation.json
/audit/change_requests/<cr_id>/metadata.json
```

---

# 5. CR Lifecycle State Machine

```
DRAFT
  │
  ▼
PENDING_REVIEW
  │   ┌─────────────┐
  ▼   ▼             │
APPROVED  ◄── REJECTED
  │
  ▼
MERGED
  │
  ▼
CLOSED
```

### State Transitions

| From           | Event         | To             | Notes                         |
| -------------- | ------------- | -------------- | ----------------------------- |
| draft          | submit        | pending_review | Validation summary computed   |
| pending_review | approve       | approved       | No fatal errors allowed       |
| pending_review | reject        | rejected       | Reviewer must leave comment   |
| approved       | merge_success | merged         | Delta MERGE applied           |
| approved       | merge_fail    | pending_review | Retry possible                |
| merged         | cleanup       | closed         | Staging deleted, audit logged |

---

# 6. Validation Rules

CR-level validation is triggered:

1. when user previews CR
2. when CR is submitted
3. when approver views CR
4. before merge (final validation)

The CR must:

* contain no fatal errors
* contain no hard validation errors
* may contain warnings (require approver attention)

### Validation Payload stored in `change_requests.validation_summary`

```json
{
  "state": "PARTIAL_PASS",
  "counts": {"info":12, "warning":2, "error":0, "fatal":0},
  "messages": [ {"col":"amount","msg":"high value"} ]
}
```

---

# 7. Merge Semantics

When CR is approved:

1. Load staging Delta table: `/staging/<cr_id>/`
2. Load main Delta table
3. Run synthetic GE validation
4. Compute row-level diffs
5. Execute Delta MERGE:

```sql
MERGE INTO main AS tgt
USING staging AS src
ON tgt.row_id = src.row_id
WHEN MATCHED THEN UPDATE SET *
WHEN NOT MATCHED THEN INSERT *
```

6. Record version_before and version_after
7. Move diffs + validation to audit folder
8. Delete staging directory

---

# 8. CR Permissions

| Role        | Create CR | Approve CR | Merge CR | View CR |
| ----------- | --------- | ---------- | -------- | ------- |
| owner       | ✔         | ✔          | ✔        | ✔       |
| contributor | ✔         | ✔          | ✔        | ✔       |
| viewer      | ✖         | ✔          | ✔        | ✔       |

Approval and merge permissions are granted to all project members except viewers cannot create CRs.

---

# 9. API Contracts

**(Full details in Live Edit API file)**

### Create CR

POST `/change_requests`

### Get CR

GET `/change_requests/{cr_id}`

### List CR

GET `/datasets/{dataset_id}/change_requests`

### Approve CR

POST `/change_requests/{cr_id}/approve`

### Reject CR

POST `/change_requests/{cr_id}/reject`

### Merge (internal)

POST `/change_requests/{cr_id}/merge`

---

# 10. Audit Integration

Every CR generates human-readable audit:

```
- Who created
- Who edited
- Who approved
- Version updated
- Rows + cells changed
- Validation summary
```

Stored in:

```
change_request_events
change_request_edits
/audit/change_requests/<cr_id>/*
```

---

# 11. Frontend Rendering

Timeline view:

```
● CR #982 — "Fix pending transactions"
  Created by Saurabh → Approved by Alex
  3 rows added · 2 updated · 7 cells changed
  Validation: 1 warning
  Version: 14
  [View Details] [View Dataset at v14]
```

CR details view tabs:

* Summary
* Diffs
* Validation
* GE Report
* Metadata

---

# 12. Implementation Guidelines for AI agent

* Keep CRs immutable after merge
* Never modify staging data except through session edits
* Never merge unvalidated CRs
* Always compute and store diff before cleanup
* When restoring to a version, generate synthetic CR event
* Build idempotent merge logic (safe to retry)

---

# End of spec.
