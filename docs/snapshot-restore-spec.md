# Snapshot & Restore Page Specification (UI + Backend)

**Purpose**
This document defines the full specification for Oreo.io’s **Snapshot Page** and **Restore Page**. It includes UI/UX, backend APIs, user interactions, Delta-based snapshot logic, calendar visualization, and restore workflows.

The system must always hide technical backend terminology. Users only see **Snapshots**, **Calendar View**, **Restore Point**, and **History Entries** — not versions, commits, or Delta internals.

---

# 📌 1. Snapshot System Overview

A **Snapshot** represents the state of a dataset at a specific point in time.

Snapshots are created automatically whenever:

* A Change Request is merged
* A Restore action is completed
* A schema or ruleset changes
* Data is appended via upload
* A manual snapshot is triggered (optional future)

Users should be able to:

* Browse snapshots in a calendar view
* Inspect snapshot details
* Compare snapshots with the current dataset
* Restore the dataset to any snapshot
* Understand what changed between snapshots

---

# 📅 2. Calendar View UI/UX

The Snapshot Calendar displays all dates where dataset changes occurred.

### **Calendar UI Goals**:

* Show dots or numbers marking days where new snapshot(s) exist
* Hovering a date shows summary of snapshots created that day
* Clicking a date opens the list of that day’s snapshots

## **2.1 Calendar Representations**

### **A. Date Cell with Multiple Snapshots**

If a day has multiple snapshots:

* Dot color intensity increases OR
* Number is shown (e.g., “3”) inside the date cell

Examples:

* A single dot → 1 snapshot
* Two dots → 2 snapshots
* Number “4” → 4 snapshots

### **B. Tooltip Preview**

Hovering on a date shows:

```
Nov 20, 2025
• Live Edit: 12 cells updated (Alex)
• Upload: 120 rows (Rohit)
```

### **C. Clicking a Date**

Opens a right-side panel listing snapshots in chronological order.

---

# 📂 3. Snapshot List UI

When a date is clicked, a panel opens showing:

### Example list:

```
Snapshot at 4:32 PM — "12 cells updated" (Alex)
Snapshot at 2:10 PM — "Upload: 120 rows" (Rohit)
Snapshot at 10:12 AM — "Restore to previous state" (System)
```

Each entry includes:

* Timestamp
* Title (human-friendly)
* Created by
* Summary (rows added/updated/cells changed)
* “View Snapshot” button
* “Compare with Current” button
* “Restore Snapshot” button (permission based)

---

# 📊 4. Snapshot Details Page

When a snapshot is selected, the center pane displays:

### Header:

* Snapshot timestamp
* Actor (user or system)
* Type (edit, upload, merge, restore)

### Summary Cards:

* Rows Added
* Rows Updated
* Cells Modified
* Warnings / Errors
* Validation Summary

### Tabs:

1. **Summary**
2. **Diff from Current**
3. **Validation Report**
4. **Metadata**

---

# 🔍 5. Time Travel (Snapshot Viewing)

### Using DuckDB / Delta time-travel query:

```
SELECT * FROM my_table TIMESTAMP AS OF '2025-11-20T16:32:00Z'
```

The backend returns paginated results to the UI.

### UI behavior:

* Spreadsheet viewer opens in "Read-Only Snapshot Mode"
* A banner shows:

```
Viewing Snapshot from Nov 20, 2025 — 4:32 PM
```

* User can click “Return to Current Version”

---

# 🔁 6. Restore Workflow (User Experience)

### **Step 1:** User selects a snapshot

### **Step 2:** User clicks “Restore Snapshot”

### **Step 3:** Confirmation modal appears:

```
Restore Snapshot from Nov 20, 2025?

This will:
✓ Replace your dataset with its state at this time
✓ Undo changes made after this snapshot
✓ Create a new snapshot documenting the restore

Are you sure you want to continue?
```

### **Step 4:** Backend computes diffs

* DuckDB compares snapshot vs current
* Results displayed in diff preview

### **Step 5:** User confirms

### **Step 6:** Backend restores the dataset:

Using delta-rs:

```
RESTORE TABLE my_table TO TIMESTAMP AS OF '2025-11-20T16:32:00Z'
```

Or equivalent programmatic API:

```python
DeltaTable(path).restore_to_timestamp(ts)
```

### **Step 7:** System logs restore event

* New snapshot created (system-generated)
* Added to calendar
* Added to audit log

---

# 🔐 7. Permissions

| Role        | View Snapshots | Restore Snapshot |
| ----------- | -------------- | ---------------- |
| Owner       | ✔              | ✔                |
| Contributor | ✔              | ✔                |
| Viewer      | ✔              | ✖                |

Viewers can browse snapshots and diffs but cannot restore.

---

# 🔥 8. Backend API Design

## **8.1 LIST SNAPSHOTS BY DATE**

### `GET /api/v1/datasets/{id}/snapshots/calendar`

Returns all snapshot timestamps grouped by date.

### Response:

```json
{
  "2025-11-20": [
    {
      "snapshot_id": "snap_14",
      "timestamp": "2025-11-20T16:32:00Z",
      "title": "Live Edit: 12 cells updated",
      "type": "edit"
    },
    {
      "snapshot_id": "snap_13",
      "timestamp": "2025-11-20T14:10:00Z",
      "title": "Uploaded 120 rows",
      "type": "upload"
    }
  ]
}
```

---

## **8.2 GET SNAPSHOT DETAILS**

### `GET /api/v1/snapshots/{snapshot_id}`

Returns:

```json
{
  "snapshot_id": "snap_14",
  "timestamp": "2025-11-20T16:32:00Z",
  "title": "Live Edit: 12 cells updated",
  "actor": "user_44",
  "summary": {
    "rows_added": 0,
    "rows_updated": 5,
    "cells_changed": 12
  },
  "diff": null,
  "validation": null
}
```

---

## **8.3 SNAPSHOT DIFF (time-travel diff)**

### `GET /api/v1/snapshots/{snapshot_id}/diff`

Backend executes DuckDB:

```sql
SELECT * FROM delta.main TIMESTAMP AS OF {snapshot_ts}
EXCEPT
SELECT * FROM delta.main;
```

Reverse query is also executed to find updated/new rows.

---

## **8.4 VIEW SNAPSHOT DATA**

### `GET /api/v1/snapshots/{snapshot_id}/data?page=1&page_size=100`

Backend uses DuckDB with time-travel query.

---

## **8.5 RESTORE SNAPSHOT**

### `POST /api/v1/datasets/{id}/restore`

Request:

```json
{"snapshot_id": "snap_14"}
```

Backend resolves timestamp:

* snapshot_id → timestamp
* timestamp → Delta restore call

Restore via delta-rs:

```python
dt.restore_to_timestamp('2025-11-20T16:32:00Z')
```

After restore:

* New commit created
* Update metadata DB
* Write restore event to audit log
* Create new snapshot entry

---

# 🧱 9. Snapshot Data Model (DB)

## `snapshots` table

| Column          | Description                             |
| --------------- | --------------------------------------- |
| snapshot_id     | ID                                      |
| dataset_id      | FK                                      |
| timestamp       | Restore timestamp (UTC)                 |
| title           | Human-friendly text                     |
| type            | edit/upload/merge/restore/schema_change |
| created_by      | User who caused the snapshot            |
| diff_path       | audit diff JSON file                    |
| validation_path | validation JSON file                    |
| metadata_path   | metadata JSON                           |

---

# 🎨 10. Frontend Component Architecture

### Components:

* `SnapshotCalendar`
* `SnapshotDayPopover`
* `SnapshotListPanel`
* `SnapshotDetails`
* `SnapshotDiffViewer`
* `SnapshotRestoreModal`
* `SnapshotDataViewer`

### Hooks:

* `useSnapshotCalendar(datasetId)`
* `useSnapshotDetails(snapshotId)`
* `useSnapshotDiff(snapshotId)`
* `useRestoreSnapshot(datasetId)`
* `useSnapshotData(snapshotId)`

---

# 🧭 11. UX Principles

* Hide all backend storage concepts
* Speak in clear human language
* Always show what will happen before restoring
* Snapshots should feel like “save points”
* Calendar must be smooth and intuitive
* Diff viewer must be readable, not technical

---

# 🏁 12. End-to-End Flow Summary

### User opens Snapshot Page → calendar loads

### User clicks a date → snapshot list appears

### User selects a snapshot → detail panel opens

### User compares snapshot with current (optional)

### User restores snapshot → confirmation → restore executed

### Audit + new snapshot created automatically

---

# END OF SPEC
