# Validation Flow State Machine Specification for Oreo.io

**Purpose**
This document formally defines the *Validation Flow State Machine* for Oreo.io. It is meant as a precise engineering contract for your AI agent (Sonnet‑4.5) to implement all validation logic consistently across:

* Live Edit (cell‑level and row‑level validation)
* Append Ingest (file‑based ingestion)
* Change Requests (session‑level validation)
* Approval/Merge (full dataset validation)

All validation is powered by **Great Expectations (GE)** running on **Delta Lake**. This state machine guarantees predictable transitions, auditability, and deterministic outcomes.

---

# 1. Validation States (Top‑Level)

The validation pipeline is composed of the following primary states:

```
┌──────────────┐
│  NOT_STARTED │
└───────┬──────┘
        │
        ▼
┌──────────────┐
│  IN_PROGRESS │
└───────┬──────┘
        │
        ▼
┌──────────────┐
│ PARTIAL_PASS │
└───────┬──────┘
        │
        ▼
┌──────────────┐
│    PASSED    │
└───────┬──────┘
        │
        ▼
┌──────────────┐
│   FAILED     │
└──────────────┘
```

### Meaning of states

* **NOT_STARTED** – No validation has been executed yet.
* **IN_PROGRESS** – GE suite is being executed on Delta data.
* **PARTIAL_PASS** – All fatal errors are clean, but warnings/info exist. Allowed to continue only with approver review.
* **PASSED** – No errors or warnings; safe to merge without concerns.
* **FAILED** – Fatal errors exist and block any merge or submission.

---

# 2. Validation Severity Model

Each rule produces one of four severities:

```
INFO → advisory only
WARNING → soft‑fail, requires reviewer attention
ERROR → hard‑fail, blocks submission
FATAL → stop‑flow immediately; data must be corrected
```

Rules are evaluated using Great Expectations expectation suites.

Mapping from GE → system severity:

```
GE success = INFO
GE warn‑only expectation = WARNING
GE fail (non‑catchable) = ERROR
GE failure with stop‑on‑first = FATAL
```

---

# 3. Cell‑Level Validation (Live Edit)

Triggered on each cell edit:

```
EDIT_RECEIVED
    │
    ▼
VALIDATE_CELL
    │     ┌───────────────────────────────┐
    ▼     ▼                               │
VALID_CELL ───────────────► INVALID_CELL  │
                                   │      │
                                   └──────┘
```

**Rules:**

* Non‑editable columns return INVALID immediately.
* GE expectations run **filtered by row + column**.
* If INVALID → cell becomes visually flagged in UI.
* Edits stored in `live_edit/<session_id>/edits.delta` regardless.
* Edits with FATAL severity halt submission later.

Cell validation result structure:

```json
{
  "valid": false,
  "severity": "error|fatal|warning|info",
  "messages": ["<explanation>"]
}
```

---

# 4. Row‑Level Validation (Optional)

If enabled by dataset settings, every row touched during a session undergoes row‑level validation:

```
ROW_TOUCHED → VALIDATE_ROW → PASS | FAIL
```

This uses GE expectations that operate on **entire row context**, e.g.:

* amount > 0 when status = "active"
* date_end > date_start
* normalized business rule sets

Row failures are treated as `ERROR` severity.

---

# 5. Session‑Level Validation (Preview Stage)

Triggered when user requests change‑request preview:

```
SESSION_OPEN
    ▼
SESSION_EDITING
    ▼
SESSION_PREVIEW_REQUESTED
    ▼
VALIDATE_SESSION (GE execution over the staging edits)
        │
   ┌────┴──────────────┐
   │                   │
   ▼                   ▼
SESSION_VALID          SESSION_INVALID
   │                      │
   ▼                      ▼
CR_CREATABLE        CR_BLOCKED_BY_ERRORS
```

### Rules

* All edits aggregated from `session_edits` Delta table.
* Construct a synthetic dataframe combining base rows + staged edits.
* Run GE suite across synthetic dataframe.
* If any **FATAL** → session invalid.
* If **ERROR** → invalid.
* If only **WARNING/INFO** → valid but flagged as PARTIAL_PASS.

Session‑level result is stored in frontend preview and in memory until CR creation.

---

# 6. Change Request Validation (Before Approval)

Triggered when a change request is opened for approval:

```
CR_CREATED
   ▼
CR_PENDING_REVIEW
   ▼
REVALIDATE_STAGING
   │
   ├──► CR_VALID
   │
   └──► CR_INVALID
```

### Rules

* Re‑run full GE suite on staging Delta table at CR review time.
* Ensures stale sessions or upstream changes don’t slip wrong data.
* Approver is shown all validation results.
* CR cannot proceed if INVALID.

---

# 7. Approval‑Stage Validation (Merge Commit Guard)

Approval triggers final validation + merge attempt:

```
APPROVE_CLICKED
   ▼
FINAL_VALIDATION
   ▼
   ┌──────────────┐
   │              │
   ▼              ▼
MERGE_ALLOWED   MERGE_BLOCKED
```

### Rules

* FINAL_VALIDATION runs GE suites on the entire combined dataset as it would appear *post‑merge*.
* If PASS → merge permissible.
* If PARTIAL_PASS → approver must explicitly override.
* If ERROR or FATAL → MERGE_BLOCKED.

---

# 8. Merge Execution State Machine

```
MERGE_ALLOWED
    ▼
MERGING
    │
    ├──► MERGE_SUCCESS
    │         ▼
    │        CLEANUP_STAGING
    │         ▼
    │        DONE
    │
    └──► MERGE_FAILED
              ▼
           CR_REOPEN_FOR_FIX
```

### Rules

* On MERGE_SUCCESS, staging folders are deleted.
* On MERGE_FAILED, partial commits should never occur (Delta guarantees atomicity).
* CR may reopen for fix with diff info.

---

# 9. Combined Full Life‑Cycle Diagram

```
                ┌──────────────────────────────┐
                │        NOT_STARTED           │
                └──────────────┬───────────────┘
                               │
                               ▼
                     ┌───────────────────┐
                     │   IN_PROGRESS     │
                     └──────────┬────────┘
                                │
                     ┌──────────┴──────────┐
                     ▼                     ▼
               ┌──────────────┐     ┌─────────────┐
               │ PARTIAL_PASS │     │   FAILED    │
               └──────┬───────┘     └─────────────┘
                      │
                      ▼
              ┌──────────────┐
              │    PASSED    │
              └──────────────┘
```

This state machine applies consistently to:

* Cell‑level events
* Row‑level validation
* Session preview validation
* Change request revalidation
* Final merge‑gate validation

---

# 10. State Transition Rules Summary

| Source State | Trigger           | Next State   | Notes               |
| ------------ | ----------------- | ------------ | ------------------- |
| NOT_STARTED  | validate() called | IN_PROGRESS  |                     |
| IN_PROGRESS  | GE emits all INFO | PASSED       |                     |
| IN_PROGRESS  | Warnings exist    | PARTIAL_PASS |                     |
| IN_PROGRESS  | Any ERROR found   | FAILED       | Block session or CR |
| PARTIAL_PASS | Approved override | PASSED       |                     |
| PARTIAL_PASS | Reject            | FAILED       |                     |
| FAILED       | Fix edits & retry | IN_PROGRESS  |                     |

---

# 11. AI Agent Implementation Guidelines

### A. Validation Execution

* Use Great Expectations suites defined per dataset.
* For cell edit: filter dataframe to affected row + column.
* For session: synthesize dataframe with edited rows applied.
* For CR & approval: re‑validate against staging and merged projection.

### B. Performance

* Use DuckDB over Delta for fast in‑container validation queries.
* Cache expectation suites in memory.
* For large datasets, validate only changed rows unless full-suite required.

### C. Storage

* Save validation outputs in:

  * `validation_runs` metadata DB row
  * `audit/validation_runs/<run_id>/summary.json` inside dataset Delta folder

### D. Errors

* Always return structured validation response to Go service and UI.
* Fatal errors stop all flows immediately.

### E. Idempotency

* Re-running validation should always produce deterministic state transitions.
* Validation results must include suite version to avoid drift.

---

# 12. Example Validation Response

```json
{
  "state": "PARTIAL_PASS",
  "counts": {
    "info": 12,
    "warning": 2,
    "error": 0,
    "fatal": 0
  },
  "messages": [
    {"column":"amount","severity":"warning","message":"amount unusually high"}
  ],
  "can_proceed": true
}
```

---

# End of File
