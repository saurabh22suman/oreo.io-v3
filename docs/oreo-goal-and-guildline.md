# Oreo.io — Product Goal & Master Guidelines Specification

**Purpose**
This document defines the *core goal*, *philosophy*, *flows*, and *non-negotiable guidelines* for Oreo.io. It is written for your **AI coding agent** so that every feature, API, UI, and backend decision aligns to the product’s vision.

This file acts as the **North Star** of the project.

---

# 🎯 OVERALL GOAL OF OREO.IO

Oreo.io transforms raw datasets into a **simple, governed, spreadsheet-like editing experience** where:

### ✔ Anyone can edit data easily (like Excel)

### ✔ Every change is validated automatically

### ✔ Every change goes through governance & approvals

### ✔ Every change is tracked, versioned, and auditable

### ✔ The underlying storage engine (Delta Lake) is invisible

The user interacts with **a clean grid**, not databases, pipelines, or Delta tables.

The system automatically handles:

* ACID transactions
* versioning
* time travel
* merge conflicts
* audit logs
* snapshots
* schema enforcement
* validation via Great Expectations

Oreo.io = **Spreadsheet Simplicity + Enterprise Data Reliability**.

---

# 🌟 CORE PHILOSOPHY

### 1. **Hide complexity. Expose simplicity.**

The UX should *feel like editing a spreadsheet*, not like working with a data lake.

### 2. **User trust is everything.**

Every edit must be:

* validated
* approved
* tracked
* reversible

### 3. **Never expose backend details.**

Users must never see:

* Delta Lake terminology
* versions / commit logs
* parquet files
* SQL
* staging tables

### 4. **Every edit must be safe.**

Business rules, schema rules, and validation must stop bad data before it lands.

### 5. **Auditability is a first-class feature.**

Every change must have a clear story:

* who changed what
* when
* why
* what changed

### 6. **Role-based simplicity.**

Different roles experience Oreo differently:

* Owner → can do everything
* Contributor → can do everything except create project
* Viewer → can see everything, can approve + merge CRs, cannot create CR

### 7. **Clear workflows. Not endless features.**

Every feature should map to 1 of 4 actions:

* View
* Edit
* Submit
* Approve/Merge

---

# 🔥 CORE SYSTEM FLOWS (End-to-End)

## 1. PROJECT FLOW

* User creates a Project
* User adds members (Owner, Contributor, Viewer)
* Members automatically gain permissions on all datasets inside project

## 2. DATASET FLOW

* Owner/Contributor creates a Dataset
* Provide data via upload, external storage, or JDBC
* System infers schema
* User edits schema + business rules
* System stores metadata in DB
* Physical table created as a Delta table

## 3. LIVE EDIT FLOW (Spreadsheet Editing)

* User enters Live Edit mode
* UI loads paginated grid
* Editable cells highlighted
* On cell edit: validate immediately (GE)
* Store edits in live_edit/<session_id>/ Delta table
* Users see changes overlayed on top of main table

## 4. CHANGE REQUEST FLOW

* User submits edits → system compiles session edits
* System validates entire set via Great Expectations
* User selects approvers
* CR is created (status: pending_review)
* Approver sees diffs and validation summary

## 5. APPROVAL + MERGE FLOW

* Approver clicks “Approve & Merge”
* Backend runs final validation
* Backend merges staging edits into main Delta table (atomic)
* Update dataset metadata
* Compute and store diffs under audit folders
* Delete staging and live edits
* CR moves to "merged"

## 6. HISTORY FLOW

* Every merge creates a new snapshot
* UI lists snapshots in human-friendly timeline
* User can view snapshot data (read-only)
* User can compare snapshots (diff engine)

## 7. RESTORE FLOW

* User selects snapshot
* User sees diff between snapshot and current
* User confirms
* Backend uses Delta restore(version)
* New snapshot is created representing restoration

---

# 🧱 BACKEND GUIDELINES

### ✔ Architecture

* Go → API + project/dataset governance
* Python → data operations + GE validation + Delta operations
* DuckDB → fast querying + diff engine
* Delta-rs → merge + restore + versioning

### ✔ Must update metadata DB on every write

* delta_version
* last_commit_id
* row_count
* last_validation_state
* last_validated_at

### ✔ Never expose Delta paths or logs to the user

### ✔ Never write SQL logic for editing table data

### ✔ Always use Delta for data edits

### ✔ Validate before every merge or restore

### ✔ Store diff.json, validation.json in audit folder per CR

### ✔ Live edit sessions remain temporary and must auto-cleanup

---

# 🧩 FRONTEND GUIDELINES

### ✔ UX must feel like:

* Airtable + Excel + Notion hybrid

### ✔ GRID BEHAVIOR

* AG Grid for editing
* Virtualized rows
* Inline validation
* Cell highlight for changed cells
* Read-only mode for viewers

### ✔ NEVER show:

* versions
* parquet files
* commit logs
* delta tables

### ✔ ALWAYS show:

* clean wording like “Snapshot”, “Change Request”, “History”, “Restore”

### ✔ DIFF VIEWER

* Row-level and cell-level color-coded diffs
* Human-friendly summaries: “12 cells changed”, “3 rows added”

### ✔ RESTORE UI

* Timeline
* Snapshot details
* Diff comparison
* Confirm modal

---

# 📊 DATA VALIDATION GUIDELINES

### ✔ Great Expectations is the source of truth

### ✔ Validation runs occur:

1. Cell-level
2. Session-level preview
3. CR submission
4. CR approval
5. Merge time
6. Restore time

### ✔ Validation states:

* passed
* partial_pass
* failed

### ✔ FATAL or ERROR stops merge

### ✔ Warnings require approver acknowledgment

---

# 📂 METADATA GUIDELINES

### Stored in DB:

* dataset_meta
* schema_json
* rules_json
* uploads
* CRs
* diff summaries
* validation runs

### Stored in Delta:

* actual data
* commit history
* stats
* metadata.json in audit folder
* diffs.json

---

# 🔐 PERMISSION GUIDELINES

| Role        | Create CR | Approve CR | Merge CR | View CR | Edit Data     | Create Dataset |
| ----------- | --------- | ---------- | -------- | ------- | ------------- | -------------- |
| Owner       | ✔         | ✔          | ✔        | ✔       | ✔             | ✔              |
| Contributor | ✔         | ✔          | ✔        | ✔       | ✔             | ✔              |
| Viewer      | ✖         | ✔          | ✔        | ✔       | ✖ (view-only) | ✖              |

### Notes

* Viewers cannot create CR but can approve/merge.
* All roles except viewers can create/edit datasets.

---

# 🧠 IMPORTANT NON-NEGOTIABLES

### 1. User must NEVER see anything about Delta, parquet, SQL, or storage.

### 2. Every edit must be tracked.

### 3. Every write must go through CR workflow.

### 4. Every merge must produce:

* new Delta version
* diff summary
* audit event

### 5. System must always maintain metadata integrity.

### 6. Restore must be reversible.

### 7. UI must be simple enough for a business analyst with zero SQL experience.

---

# 🧭 VISION STATEMENT

Oreo.io unifies the friendliness of a spreadsheet with the trustworthiness of enterprise data systems. Our vision is to let anyone collaborate on data safely, confidently, and transparently — without ever having to understand the complex machinery behind it.

---

# END OF SPEC
