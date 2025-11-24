# Merge Execution Specification for Oreo.io

**Purpose**
This document defines the Merge Execution Engine: the exact orchestration, APIs, implementation contracts, failure modes, tests, and operational guarantees required to atomically apply a Change Request (CR) staging Delta table into the canonical `main` Delta table. It is written for the AI coding agent (Sonnet-4.5) and engineering team to implement the merge reliably, safely, and audibly.


# 1. Goals & Guarantees

* **Atomicity:** Merges must be atomic — either all intended changes are committed as a single Delta version, or none.
* **Idempotency:** Retrying a merge should be safe; it must not create duplicate rows or corrupt data.
* **Validation gating:** Final GE validation must run immediately before merge and block the merge on fatal errors.
* **Conflict detection:** If the main table changed after the session started, detect conflicts and surface them to approver.
* **Auditability:** Produce diffs, validation snapshots, and event logs stored under `/audit/change_requests/<cr_id>/`.
* **Metadata sync:** After successful merge, update `dataset_meta` (delta_version, last_commit_id, row_count, schema_json if evolved).
* **Cleanup:** Remove staging folder, optionally archive diffs, and mark CR merged.

---

# 2. Inputs & Preconditions

* `cr_id` (Change Request ID) — points to staging path `/staging/<cr_id>/`.
* `dataset_id` — dataset to merge into; resolves to `main_path` (from dataset_meta).
* `approver_id` — the user performing the approval/merge.
* CR status must be `approved` before merge.
* Staging table must exist and be readable by delta-rs.
* Primary key(s) must be known (from `dataset_meta.primary_key`) to perform deterministic merges.

---

# 3. High-Level Merge Flow (orchestration)

1. **Lock CR:** mark CR as `merging` (optimistic lock). Prevent concurrent merges.
2. **Pre-merge validation:**

   * Re-run GE full suite on *staging-as-applied* projection.
   * If any FATAL or ERROR → abort with detailed report.
3. **Conflict detection:**

   * Compare `delta_version` in dataset_meta with `cr.delta_version_before`.
   * If mismatch, compute conflicting row ids and return `409 Conflict` with summary.
4. **Read staging into DataFrame:**

   * Use delta-rs or PySpark to read staging delta path into pandas/Spark DataFrame.
5. **Perform Merge using delta-rs:**

   * Use DeltaTable API for merge with `mergeSchema=True` when allowed.
   * Operation must be executed as a single atomic Delta transaction.
6. **Post-merge metadata:**

   * Read new Delta version and commit id.
   * Update `dataset_meta.delta_version`, `row_count`, `last_commit_id`, `schema_json` if changed.
7. **Audit & Diff:**

   * Before deleting staging, compute: rows added, rows updated, rows deleted, cell-level diffs. Persist to `/audit/change_requests/<cr_id>/`.
   * Persist GE validation summary as `/audit/change_requests/<cr_id>/validation.json`.
8. **Cleanup:**

   * Delete staging directory `/staging/<cr_id>/` or move to `/archive/change_requests/<cr_id>/` based on retention policy.
9. **CR finalization:**

   * Mark CR as `merged`, set `merged_at`, push change event to `change_request_events`.
10. **Notification:**

* Notify requestor and subscribers via SSE/email/webhook.

---

# 4. API & Endpoint Contracts

## 4.1 Internal Merge API (Python FastAPI)

**POST** `/delta/merge`

**Request JSON:**

```json
{
  "main_path": "/data/delta/projects/<project>/datasets/<dataset>/main",
  "staging_path": "/data/delta/projects/<project>/datasets/<dataset>/staging/<cr_id>",
  "primary_keys": ["row_id"],
  "merge_options": { "mergeSchema": true, "conflictStrategy": "abort" },
  "requested_by": "u_approver"
}
```

**Response 200:**

```json
{ "status": "ok", "merged_version": 123, "commit_id": "abc-123" }
```

**Error 4xx/5xx:** return structured error with `code`, `message`, `details`.

---

## 4.2 External API (Go API Handler)

**POST** `/api/v1/change_requests/{cr_id}/merge`

* Validates user permissions (must be owner or contributor; or per-policy).
* Resolves `main_path` from `dataset_meta`.
* Calls Python `/delta/merge` and handles errors including conflict and validation failures.
* On success, updates CR DB row and returns merged version.

---

# 5. Implementation Details (Python delta_adapter.merge)

Use `deltalake` (delta-rs) for merge with example pseudocode:

```python
from deltalake import DeltaTable
from deltalake.writer import write_deltalake

# read staging
staging = DeltaTable(staging_path).to_pandas()

# perform merge
tgt = DeltaTable(main_path)
# with deltalake, you may use PySpark or a library helper; otherwise use a pattern:
# - create temporary dataframe file
# - write into a temporary location and perform merge via Spark SQL if available

# preferred: use PySpark if available
spark.read.format('delta').load(staging_path).createOrReplaceTempView('src')
spark.read.format('delta').load(main_path).createOrReplaceTempView('tgt')

sql = '''MERGE INTO delta.`{main_path}` AS tgt
          USING delta.`{staging_path}` AS src
          ON {on_clause}
          WHEN MATCHED THEN UPDATE SET *
          WHEN NOT MATCHED THEN INSERT *'''

spark.sql(sql)
```

**Notes:**

* If PySpark is heavy, you can implement merge via delta-rs utilities or via rewriting files carefully; prefer PySpark for robust merge support.
* Ensure `mergeSchema` option is controlled via dataset settings.

---

# 6. Conflict Detection Strategy

* If `dataset_meta.delta_version != cr.delta_version_before`, compute changed row ids:

  * Read `main` version `cr.delta_version_before` and current `main` (or compute file-level changes from `_delta_log`).
  * Compare primary keys to find overlapping modifications.
* If conflicts found, return `409 Conflict` with `conflicts: [{row_id, main_value, staging_value}]`.
* Provide option `force_merge=true` only for owners and with audit logging.

---

# 7. Diff Computation (pre-delete staging)

* Use DuckDB to compute diffs efficiently:

  * `before = SELECT * FROM delta.`main` VERSION AS OF <before>`
  * `after = SELECT * FROM delta.`main` VERSION AS OF <after>`
  * `changed = (before EXCEPT after) UNION (after EXCEPT before)`

* For cell-level diffs:

  * UNPIVOT both tables and join on (row_id, column)
  * Filter where values differ

* Persist diffs as JSON under `/audit/change_requests/<cr_id>/diff.json` and also write a compact summary to `change_request_edits`.

---

# 8. Validation & Safety Checks

* Final GE run on projected merged dataset must pass with no fatal errors.
* If GE returns warnings only, allow merge but include warnings in CR audit and UI.
* If any fatal/error-level issues: abort merge and return full GE report.
* Check for schema compatibility before merge; if schema evolution required, ensure `mergeSchema` is set and user-consented.

---

# 9. Retention, Archival & Cleanup Policies

* After successful merge, delete staging directory: `/staging/<cr_id>/` unless `retain_staging=true` is configured.
* Archive diffs and validation under `/audit/change_requests/<cr_id>/` permanently (or per retention policy).
* Implement scheduled cleanup for orphaned staging directories older than TTL (e.g., 7 days).

---

# 10. Observability & Telemetry

Emit structured logs and metrics:

* `merge.start` (cr_id, dataset_id, requested_by)
* `merge.success` (cr_id, merged_version, duration)
* `merge.failed` (cr_id, error_code)
* `merge.conflict` (cr_id, conflict_count)

Record audit events in `change_request_events` table.

---

# 11. Tests & Validation

Required tests:

* Unit tests for conflict detection logic
* Integration test for successful merge (create staging, append, merge, assert version bump)
* Integration test for validation blocking (fatal GE)
* Integration test for conflict return (simulate concurrent write)
* Idempotency test (re-run merge request should be safe)

---

# 12. Failure Modes & Recovery

* If merge crashed mid-way: Delta ensures atomic commit; partial writes should not be visible. Re-run verification and cleanup.
* If metadata update failed after merge: implement compensating transaction to fix DB or run an idempotent metadata sync job.
* If delete staging fails: schedule background cleanup job; mark CR as `merged` and `cleanup_pending`.

---

# 13. Security & Permissions

* Only project members (owner/contributor) can trigger merge; viewers cannot create CRs but may view merges.
* `force_merge` and restore operations restricted to owners.
* Log `requested_by` and `executed_by` for audit.

---

# 14. Implementation Roadmap (tickets)

* T1: implement `/delta/merge` in Python (delta_adapter)
* T2: Go handler for CR merge call and permission checks
* T3: conflict detection module
* T4: diff computation & audit persistence
* T5: GE final validation integration
* T6: tests: unit + integration + idempotency
* T7: UI hook for merge with confirmation modal & conflict UI

---

# 15. Appendix

* Example SQL merge snippet (PySpark suggested)
