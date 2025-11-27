# Delta Lake Folder Structure Specification for Oreo.io

**Purpose:**
This document defines the canonical Delta Lake folder layout used across Oreo.io for datasets, staging, live edit sessions, imports, and change-request workflows. It is written explicitly to guide your AI agent (Sonnet-4.5) so it can create, manage, and query Delta tables in a consistent, predictable way.

This structure ensures:

* ACID guarantees
* Clean separation of concerns (main vs staging vs live edits)
* Easy cleanup of orphaned sessions and temporary data
* Predictable merge paths for append jobs
* Scalable organization under projects

All paths assume the root is:

```
$DELTA_DATA_ROOT/
```

Typically mounted at:

```
/data/delta
```

---

# 1. Top-Level Layout

```
/data/delta/
    ├── projects/
    │     ├── <project_id>/
    │     │       ├── datasets/
    │     │       │       └── <dataset_id>/
    │     │       │             ├── main/               # canonical Delta table
    │     │       │             ├── staging/            # per-change-request staging tables
    │     │       │             ├── live_edit/          # per-session cell-edit tables
    │     │       │             ├── imports/            # raw files & intermediate ingest
    │     │       │             └── audit/              # validation runs, snapshots, history extracts
```

This hierarchy tightly scopes all dataset-related files to:

* project
* dataset
* table purpose

This enables fine-grained cleanup and clear lineage tracking.

---

# 2. Dataset Root Layout

Each dataset lives under:

```
/data/delta/projects/<project_id>/datasets/<dataset_id>/
```

Containing:

```
<dataset_id>/
    ├── main/
    ├── staging/
    ├── live_edit/
    ├── imports/
    └── audit/
```

---

# 3. Main Table

The canonical Delta table containing committed, approved data.

```
main/
    ├── part-0000.parquet
    ├── part-0001.parquet
    ├── ...
    └── _delta_log/
```

### Rules for `main/`

* All merge operations commit here.
* Schema evolution allowed via `mergeSchema=true`.
* Only the **approved** path writes here.
* Never write unvalidated or user-edited temporary data here.
* Vacuum schedule recommended (e.g., 7–30 days).
* Partitions optional. If using partitioning, add:

  ```
  main/<partition_col>=<value>/...parquet
  ```

---

# 4. Staging Tables (Append / Change Requests)

When a user creates a change request or new append job, its ingest lands in:

```
staging/
    └── <change_request_id>/
            ├── part-0000.parquet
            ├── part-0001.parquet
            └── _delta_log/
```

### Rules

* One Delta table per change request.
* Can contain append-only or edit/replace rows.
* The **approver** triggers the merge of this table into `main/`.
* After successful merge, this folder **must be deleted**.

### Merge Action

The merge logic lives in Python:

```python
DeltaTable(main_path).merge(
    source_df,
    on="row_id"
).whenMatchedUpdateAll().whenNotMatchedInsertAll().execute()
```

---

# 5. Live Edit Session Storage

Every user-owned live edit session has its own lightweight delta table storing **only modified cells**, not entire rows.

```
live_edit/
    └── <session_id>/
            ├── edits.delta/   # Delta table directory
            │       ├── part-*.parquet
            │       └── _delta_log/
            └── metadata.json  # session metadata (optional)
```

### Delta Table Schema (edits.delta)

```
(edit_id STRING,
 session_id STRING,
 row_id STRING,
 column STRING,
 old_value STRING,
 new_value STRING,
 user_id STRING,
 ts TIMESTAMP,
 validation JSON)
```

### Rules

* Must store only changed cells — not full rows.
* Used for: overlay rendering, preview pane, diff computation, and merge.
* Staging edits here must never exceed ~100MB; enforce TTL deletion.
* Fully merge only **after approval**.

---

# 6. Imports Folder (Raw File Intake)

```
imports/
    └── <upload_id>/
            ├── raw.csv | raw.parquet | raw.xlsx
            ├── converted.parquet
            └── ingest.delta/   # Optional intermediate Delta conversion
```

### Purpose

* Store original uploaded files.
* Store converted versions for safer ingestion.
* Store inferred schema snapshots.

### Rules

* Never merge imports/ tables directly into `main/` — always validate first.
* Clean up orphaned uploads older than TTL.

---

# 7. Audit Folder (Validation, Snapshots, Metadata)

```
audit/
    ├── validation_runs/
    │       └── <run_id>/
    │             ├── summary.json
    │             └── full.json
    ├── snapshots/      # exported snapshot files
    └── history/        # optional materialized history views
```

### Rules

* All GE runs for dataset → stored here.
* Snapshots may be generated for backup, export, or visualization.
* History folder optional; most history comes from Delta itself.

---

# 8. Delta Adapter Rules for AI Agent

Your AI agent must follow these guidelines for correct folder usage:

## A. Path Resolution

Always resolve full dataset path like:

```
dataset_root = f"{DELTA_DATA_ROOT}/projects/{project_id}/datasets/{dataset_id}"
main_path = f"{dataset_root}/main"
staging_path = f"{dataset_root}/staging/{change_request_id}"
live_edit_path = f"{dataset_root}/live_edit/{session_id}/edits.delta"
```

## B. Atomicity Rules

* Only commit approved data to main.
* Never modify existing parquet manually — rely on Delta writer.
* Never copy/add/delete files inside `_delta_log` manually.

## C. Cleanup Rules

* Delete staging directories after merge.
* Delete live_edit/<session_id> after change request closed or TTL expired.
* Delete orphan imports/

## D. Metadata Sync

After every commit:

* Update `dataset_meta.delta_version` = latest version.
* Update `dataset_meta.last_commit_id` = commit UUID.
* Update row counts via DuckDB: `SELECT COUNT(*) FROM delta.`path``.

## E. Validation Rules

Before merge:

* Run GE suite on staging dataset.
* If severity == fatal → abort merge.
* If warnings exist → include for approver.

---

# 9. Examples

## Example dataset creation

```
/data/delta/projects/pr_1001/datasets/ds_3201/main/
```

## Example staging for change request

```
staging/cr_99231/_delta_log/
staging/cr_99231/part-0001.parquet
```

## Example live edit session

```
live_edit/sess_1234/edits.delta/_delta_log/
live_edit/sess_1234/edits.delta/part-0000.parquet
```

---

# 10. Anti-Patterns (Do Not Do This)

* ❌ Do not write user edits directly to main.
* ❌ Do not copy files from staging → main.
* ❌ Do not store full-row snapshots inside live_edit.
* ❌ Do not let staging accumulate many CRs — cleanup aggressively.
* ❌ Do not bypass GE validations.
* ❌ Do not flatten directories (every CR/session gets its own folder).

---

# 11. Checklist for AI Agent

* [ ] Create dataset folder structure on dataset creation.
* [ ] Create Delta table under main/.
* [ ] Use live_edit for cell edits.
* [ ] Use staging/<cr_id> for approved append/edits.
* [ ] Validate staging before merge.
* [ ] Merge into main only after approval.
* [ ] Delete staging and live edits after merge.
* [ ] Update metadata DB after each successful commit.
* [ ] Keep folder structure **idempotent**.

---

## End of File.