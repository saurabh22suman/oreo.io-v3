📘 AUDIT PAGE SPECIFICATION (UI + BACKEND)
Purpose

The Audit Page shows a human-friendly, non-technical timeline of everything that has happened to a dataset:

Edits

Appends

Uploads

Merges

Change Requests

Validations

Approvals / rejections

Restores

Schema changes

Rule changes

Users never see versions, Delta logs, parquet files, metadata internals, or SQL.

Everything is rendered as clear English events.

============================================
1. TARGET EXPERIENCE (What users should feel)
============================================

“I can see the entire story of this dataset.”

“I know who changed what, and when.”

“Every change is captured, readable, and auditable.”

“I can click into any event to see exact diffs.”

“I can restore old states safely.”

This page is the governance heart of Oreo.io.

============================================
2. AUDIT PAGE — UI DESIGN
============================================

The page is divided into three core sections:

A. Timeline Panel (Left Sidebar)

Scrollable vertical list of audit events.

Event Entry UI Example
● Mar 21 — “12 cells updated in Live Edit” (Alex)
● Mar 20 — “Change Request #981 merged” (Saurabh)
● Mar 19 — “Dataset restored to Snapshot 10” (System)
● Mar 17 — “Uploaded 230 rows from file” (Rohit)
● Mar 15 — “Schema updated: +2 columns” (Sam)

Each entry includes:

Event icon

Event title

User (“actor”)

Timestamp

Short description

Category color (edit / merge / restore / upload / validation)

Event Types (UI categories)

edit → pencil icon

append → upload icon

CR created → document icon

CR approved → check icon

CR rejected → close icon

CR merged → merge icon

restore → history icon

schema change → columns icon

rule change → shield icon

validation run → check-circle icon

B. Event Details Panel (Center Pane)

Displays details of the selected audit event.

Layout:

Header:

Event title

Actor

Timestamp

Event type badge

Summary Cards:

“Rows Added: X”

“Rows Updated: Y”

“Cells Changed: Z”

“Warnings: W”

“Errors: E”

“Commit Snapshot: #14” (but display as “Snapshot #14”, not “Delta version 14”)

Tabs:

Summary (default)

Diff

Validation Report (if validation happened)

Metadata

Related Change Request (optional)

C. Diff Panel (Right Side Slide-out)

Shows diffs in a readable format:

Row-level example:
Row ID: 4921
  amount: 450 → 982
  status: pending → approved
  updated_at: 3:42 PM

Insert example:
New row inserted (Row ID: 9931)
  amount: 128
  customer: "John"

Delete example (if supported):
Row deleted (Row ID: 8121)

============================================
3. BACKEND ARCHITECTURE FOR AUDIT PAGE
============================================

Backend must consolidate events from:

change_request_events (DB)

change_requests table (DB)

delta history (_delta_log)

audit folder in Delta:

diff.json

validation.json

metadata.json

validation_runs

schema change records

rule change records

The backend retrieves them and normalizes into a single, human-readable format.

============================================
4. BACKEND ENDPOINTS
============================================
1. LIST AUDIT EVENTS
GET /api/v1/datasets/{dataset_id}/audit
Response:
[
  {
    "audit_id": "evt_1093",
    "snapshot_id": "snap_14",
    "type": "merge",
    "title": "Change Request #982 merged",
    "created_by": "user_77",
    "timestamp": "2025-03-21T16:32:00Z",
    "summary": {
      "rows_added": 3,
      "rows_updated": 5,
      "cells_changed": 12,
      "warnings": 0,
      "errors": 0
    }
  }
]

Backend logic:

Read from change_request_events

Resolve linked CR

Map CR merge events → snapshot creation

Map restore events → snapshot

Include schema/rule changes

Include append events (uploads)

2. GET AUDIT EVENT DETAILS
GET /api/v1/audit/{audit_id}
Response:
{
  "audit_id": "evt_1093",
  "snapshot_id": "snap_14",
  "type": "merge",
  "created_by": "user_77",
  "title": "Change Request #982 merged",
  "diff_path": "/audit/change_requests/cr_982/diff.json",
  "validation_path": "/audit/change_requests/cr_982/validation.json",
  "metadata_path": "/audit/change_requests/cr_982/metadata.json"
}


Backend then loads JSON files and returns:

{
  "diff": {...},
  "validation": {...},
  "metadata": {...}
}

3. GET DIFF FOR AUDIT EVENT
GET /api/v1/audit/{audit_id}/diff

Returns diff.json.

4. GET VALIDATION REPORT
GET /api/v1/audit/{audit_id}/validation

Returns validation.json.

============================================
5. DATA MODEL REQUIRED
============================================
change_request_events

Used for:

edits

approvals

merges

restore

schema/rule change events

audit folder in Delta

Contains diff + metadata:

/audit/change_requests/<cr_id>/diff.json
/audit/change_requests/<cr_id>/validation.json
/audit/change_requests/<cr_id>/metadata.json

restore_events

Used for timeline.

============================================
6. DIFF ENGINE BACKEND
============================================

Diff calculation uses DuckDB:

Row-level:

SELECT * FROM delta.main VERSION AS OF {before}
EXCEPT
SELECT * FROM delta.main VERSION AS OF {after};


Reverse for opposite direction.

Backend merges both to produce:

rows added

rows removed

rows updated

cell-level diffs

Stored in audit folder before cleanup.

============================================
7. UI INTERACTIONS & UX RULES
============================================
1. Never show Delta terms

Replace:

“version 14” → “Snapshot #14”

2. Always human-readable

“12 cells updated”

“3 rows added”

“Dataset restored to previous state”

“Validation warnings found”

3. Read-only by default

No editing inside audit page.

4. Cross-linking

Audit events link to:

related CR

restore

snapshot viewer

diff viewer

validation report

5. Clear icons

Make it scannable at a glance.

============================================
8. PERMISSIONS
============================================
Role	View Audit	View Diff	Restore	Approve CR
Owner	✔	✔	✔	✔
Contributor	✔	✔	✔	✔
Viewer	✔	✔	✖ (cannot restore)	✔

Audit page is read-only for all roles.

============================================
9. FINAL UX FLOW
============================================
User opens Audit page → sees timeline

▼
Clicks an event
▼
Sees detailed summary
▼
Clicks “View Diff” (optional)
▼
Clicks “View Data as of this snapshot” (optional)
▼
If allowed: “Restore Snapshot”
▼
Confirm modal → Restore
▼
New audit event created: “Dataset restored to Snapshot X”

🎯 Final Summary

This spec defines:

✔ UI components
✔ backend endpoints
✔ diff engine
✔ metadata structures
✔ audit event model
✔ restore integration
✔ timeline + details + diff viewer
✔ permissions
✔ UX language rules
✔ end-to-end workflow