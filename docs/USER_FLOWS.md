# Oreo.io User Flows

This document describes the main user flows and workflows in Oreo.io.

---

## 1. Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATION                                   │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Register   │────▶│    Login     │────▶│  Dashboard   │
│  (new user)  │     │ email/pass   │     │   (home)     │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ Google OAuth │
                     │ (alternative)│
                     └──────────────┘
```

### Steps:
1. **Register** (`POST /api/auth/register`)
   - User provides email and password
   - Account created, redirected to login

2. **Login** (`POST /api/auth/login` or `POST /api/auth/google`)
   - User authenticates with credentials or Google
   - JWT token issued (stored in cookie/localStorage)
   - Redirected to Dashboard

3. **Session Check** (`GET /api/auth/me`)
   - On app load, verify session is valid
   - If invalid, redirect to login

4. **Logout** (`POST /api/auth/logout`)
   - Clear session, redirect to login

---

## 2. Project Management Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PROJECT LIFECYCLE                                │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Projects   │────▶│   Create     │────▶│   Project    │
│    List      │     │   Project    │     │   Details    │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                     ┌───────────────────────────┼───────────────────────┐
                     ▼                           ▼                       ▼
              ┌──────────────┐           ┌──────────────┐         ┌──────────────┐
              │    Manage    │           │   Datasets   │         │   Settings   │
              │   Members    │           │    List      │         │    Page      │
              └──────────────┘           └──────────────┘         └──────────────┘
```

### Steps:
1. **View Projects** (`GET /api/projects`)
   - Dashboard shows all projects user has access to
   - Shows role (owner/contributor/viewer) for each

2. **Create Project** (`POST /api/projects`)
   - Provide name and optional description
   - User becomes owner automatically

3. **Manage Members** (`GET/POST /api/projects/:id/members`)
   - Owner can add members by email
   - Assign roles: `owner`, `contributor`, `viewer`, `editor`

4. **Delete Project** (`DELETE /api/projects/:id`)
   - Only owner can delete
   - Cascades to all datasets

---

## 3. Dataset Creation Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       DATASET CREATION (2-Step)                          │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Select     │────▶│    Upload    │────▶│   Configure  │────▶│   Dataset    │
│   Project    │     │    File      │     │    Schema    │     │   Created    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                            │                    │
                            ▼                    ▼
                     ┌──────────────┐     ┌──────────────┐
                     │  Stage File  │     │ Set Table    │
                     │  (temp)      │     │ Name/Schema  │
                     └──────────────┘     └──────────────┘
```

### Steps:
1. **Stage Upload** (`POST /api/datasets/stage-upload`)
   - Upload CSV/XLSX file
   - File stored temporarily, schema inferred
   - Returns `staging_id`, `filename`, `row_count`, `schema`

2. **Review Schema**
   - User reviews inferred column types
   - Modify column names, types if needed
   - Set target schema and table name

3. **Finalize Dataset** (`POST /api/datasets/finalize`)
   - Provide `staging_id`, `name`, `schema`, `table`, `target_schema`
   - Creates Delta table with initial data
   - Returns dataset ID

4. **Alternative: Prepare Dataset** (`POST /api/datasets/prepare`)
   - Single-step creation with file upload
   - Less control over schema

---

## 4. Data Viewing Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA VIEWER                                      │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Dataset    │────▶│   Load Data  │────▶│   AG Grid    │
│   Select     │     │  (paginated) │     │   Display    │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                     ┌───────────────────────────┼───────────────────────┐
                     ▼                           ▼                       ▼
              ┌──────────────┐           ┌──────────────┐         ┌──────────────┐
              │    Filter    │           │     Sort     │         │   Export     │
              │   Columns    │           │    Rows      │         │   CSV/Excel  │
              └──────────────┘           └──────────────┘         └──────────────┘
```

### Steps:
1. **Navigate to Dataset** → Dataset Details page
2. **Load Data** (`GET /api/datasets/:id/data?limit=50&offset=0`)
   - Data loaded in pages (default 50 rows)
   - Uses DuckDB connection pool for fast queries

3. **Query Data** (`POST /api/datasets/:id/query`)
   - Apply filters, WHERE clauses
   - Server-side pagination

4. **SQL Query Mode** (Project Query page)
   - Write custom SQL against Delta tables
   - Uses `POST /delta/query` endpoint

5. **Export** (AG Grid built-in)
   - Export visible data to CSV/Excel

---

## 5. Append Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         APPEND DATA WORKFLOW                             │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Upload     │────▶│   Validate   │────▶│   Select     │────▶│   Change     │
│   File       │     │   Schema     │     │   Reviewer   │     │   Request    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                            │                                        │
                            ▼                                        ▼
                     ┌──────────────┐                         ┌──────────────┐
                     │  Check Rules │                         │   Pending    │
                     │  (business)  │                         │   Approval   │
                     └──────────────┘                         └──────────────┘
```

### Steps:
1. **Upload File** (`POST /api/datasets/:id/data/append/validate`)
   - Upload CSV/XLSX with new rows
   - Validate against dataset schema
   - Validate against business rules
   - Returns validation results

2. **Review Validation**
   - Check for schema mismatches
   - Review rule violations (warnings/errors)
   - Errors block submission

3. **Select Reviewers**
   - Choose one or more reviewers
   - Must be project members with appropriate role

4. **Create Change Request** (`POST /api/datasets/:id/data/append/open`)
   - Data staged in Delta staging table
   - Change request created with status `pending`
   - Reviewers notified

---

## 6. Live Edit Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LIVE EDIT SESSION                                │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Start      │────▶│   Edit       │────▶│   Preview    │────▶│   Submit     │
│   Session    │     │   Cells      │     │   Changes    │     │   CR         │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │                    │
       ▼                    ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Session ID  │     │  Real-time   │     │    Diff      │     │   Pending    │
│  Created     │     │  Validation  │     │    View      │     │   Approval   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### Steps:
1. **Start Session** (`POST /api/datasets/:id/live-sessions`)
   - Creates editing session with unique ID
   - Returns editable columns, validation rules
   - Session expires after inactivity

2. **Edit Cells** (`POST /api/datasets/:id/live-sessions/:sessionId/edits`)
   - Each cell edit saved immediately
   - Real-time validation against rules
   - Returns validation status (valid/warning/error)

3. **Bulk Edits** (`POST /api/datasets/:id/live-sessions/:sessionId/edits/batch`)
   - Save multiple edits at once
   - Performance optimization for paste operations

4. **Preview Changes** (`POST /api/datasets/:id/live-sessions/:sessionId/preview`)
   - See diff of all changes
   - Summary: rows changed, cells changed, deleted rows
   - Validation summary

5. **Submit as CR** (`POST /api/datasets/:id/data/live-edit/open`)
   - Provide title, comment, reviewer IDs
   - Creates change request
   - Session closed

6. **Discard Session** (`DELETE /api/datasets/:id/live-sessions/:sessionId`)
   - Abort all changes
   - Clean up staging data

---

## 7. Change Request Approval Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      CHANGE REQUEST LIFECYCLE                            │
└─────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │   PENDING    │
                              └──────────────┘
                                     │
                 ┌───────────────────┼───────────────────┐
                 ▼                   ▼                   ▼
          ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
          │   APPROVED   │   │   REJECTED   │   │  WITHDRAWN   │
          └──────────────┘   └──────────────┘   └──────────────┘
                 │
                 ▼
          ┌──────────────┐
          │    MERGE     │
          └──────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
 ┌──────────────┐  ┌──────────────┐
 │   MERGED     │  │ MERGE_FAIL   │
 │  (success)   │  │  (conflict)  │
 └──────────────┘  └──────────────┘
```

### Status Transitions:
- `pending` → `approved` (reviewer approves)
- `pending` → `rejected` (reviewer rejects)
- `pending` → `withdrawn` (submitter withdraws)
- `approved` → `merged` (auto-merge succeeds)
- `approved` → `merge_fail` (conflict detected)

### Steps:
1. **View Pending Changes** (`GET /api/projects/:projectId/changes`)
   - Reviewer sees pending requests
   - Filter by status: pending, approved, rejected, all

2. **Review Change Details** (`GET /api/changes/:id`)
   - See diff of proposed changes
   - View validation results
   - Check for conflicts

3. **Approve** (`POST /api/projects/:projectId/changes/:id/approve`)
   - Change status → `approved`
   - Triggers merge execution

4. **Reject** (`POST /api/projects/:projectId/changes/:id/reject`)
   - Change status → `rejected`
   - Submitter notified

5. **Withdraw** (`POST /api/projects/:projectId/changes/:id/withdraw`)
   - Submitter cancels request
   - Staging data cleaned up

6. **Merge Execution** (automatic on approval)
   - Staging data merged into main table
   - Conflict detection
   - Audit trail created

---

## 8. Validation Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      VALIDATION STATE MACHINE                            │
└─────────────────────────────────────────────────────────────────────────┘

     Cell Level              Session Level           CR Level            Merge Level
    ┌──────────┐             ┌──────────┐          ┌──────────┐         ┌──────────┐
    │  Edit    │────────────▶│  Submit  │─────────▶│  Review  │────────▶│  Merge   │
    │  Cell    │             │  Preview │          │  Approve │         │ Execute  │
    └──────────┘             └──────────┘          └──────────┘         └──────────┘
         │                        │                     │                    │
         ▼                        ▼                     ▼                    ▼
    ┌──────────┐             ┌──────────┐          ┌──────────┐         ┌──────────┐
    │ Validate │             │ Validate │          │ Validate │         │ Validate │
    │  Cell    │             │ Session  │          │   CR     │         │  Merge   │
    └──────────┘             └──────────┘          └──────────┘         └──────────┘
```

### Validation Levels:
1. **Cell-Level** (`POST /api/data/rules/validate/cell`)
   - Immediate feedback during editing
   - Single cell against column rules

2. **Session-Level** (`POST /api/data/rules/validate/batch`)
   - Before CR submission
   - All edited rows validated

3. **CR-Level** (on review)
   - Re-validates when reviewer opens CR
   - Ensures data still valid

4. **Merge-Level** (before merge)
   - Final validation before merge
   - FATAL severity blocks merge

### Severity Levels:
- `INFO` - Advisory, never blocks
- `WARNING` - Allows submission, flagged for review
- `ERROR` - Blocks CR submission
- `FATAL` - Blocks merge execution

---

## 9. Snapshot & Restore Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      SNAPSHOT (TIME TRAVEL)                              │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   View       │────▶│   Select     │────▶│   Preview    │────▶│   Restore    │
│   Calendar   │     │   Version    │     │   Data       │     │   (confirm)  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### Steps:
1. **View Snapshot Calendar** (`GET /api/datasets/:id/snapshots/calendar`)
   - Calendar view of all versions
   - Grouped by date
   - Shows operation type (append, merge, restore)

2. **Select Version**
   - Click on version in calendar
   - See summary (rows added/updated/deleted)

3. **Preview Data** (`GET /api/datasets/:id/snapshots/:version/data`)
   - Time travel query
   - View data as it was at that version

4. **Restore** (`POST /api/datasets/:id/snapshots/:version/restore`)
   - Revert to selected version
   - Creates new version (non-destructive)
   - Audit trail recorded

---

## 10. Audit Trail Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AUDIT TRAIL                                      │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   View       │────▶│   Select     │────▶│   View       │
│   Events     │     │   Event      │     │   Details    │
└──────────────┘     └──────────────┘     └──────────────┘
                                                │
                     ┌───────────────────────────┼───────────────────────┐
                     ▼                           ▼                       ▼
              ┌──────────────┐           ┌──────────────┐         ┌──────────────┐
              │   View Diff  │           │   View       │         │   Related    │
              │   (before/   │           │  Validation  │         │   CR         │
              │    after)    │           │   Report     │         │              │
              └──────────────┘           └──────────────┘         └──────────────┘
```

### Steps:
1. **List Audit Events** (`GET /api/datasets/:id/audit`)
   - All events for dataset
   - Filter by type (append, merge, restore, etc.)

2. **View Event Details** (`GET /api/audit/:auditId`)
   - Who, what, when
   - Summary of changes

3. **View Diff** (`GET /api/audit/:auditId/diff`)
   - Before/after comparison
   - Row-level changes

4. **View Validation** (`GET /api/audit/:auditId/validation`)
   - Validation results at time of event
   - Warnings, errors

---

## 11. Notifications Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         NOTIFICATIONS                                    │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Real-time   │────▶│   Inbox      │────▶│   Mark       │
│  SSE Stream  │     │   View       │     │   Read       │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Notification Types:
- Change request assigned for review
- Change request approved/rejected
- Merge completed/failed
- Member added to project

### Steps:
1. **Subscribe to SSE** (`GET /api/security/notifications/stream`)
   - Real-time push notifications
   - Auto-reconnect on disconnect

2. **View Inbox** (`GET /api/security/notifications`)
   - List all notifications
   - Filter: all, read, unread

3. **Mark Read/Unread**
   - `POST /api/security/notifications/read`
   - `POST /api/security/notifications/unread`

4. **Delete** (`DELETE /api/security/notifications`)
   - Remove selected notifications

---

## Quick Reference: Complete User Journey

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE USER JOURNEY                                       │
└─────────────────────────────────────────────────────────────────────────────────────────┘

  ┌────────┐    ┌────────┐    ┌────────────┐    ┌────────────┐    ┌─────────────┐
  │Register│───▶│ Login  │───▶│  Create    │───▶│  Create    │───▶│   Upload    │
  │        │    │        │    │  Project   │    │  Dataset   │    │   Data      │
  └────────┘    └────────┘    └────────────┘    └────────────┘    └─────────────┘
                                    │                                    │
                                    ▼                                    ▼
                             ┌────────────┐                       ┌─────────────┐
                             │   Invite   │                       │  View Data  │
                             │  Members   │                       │  in Grid    │
                             └────────────┘                       └─────────────┘
                                                                        │
                     ┌──────────────────────────────────────────────────┤
                     ▼                              ▼                   ▼
              ┌─────────────┐              ┌─────────────┐       ┌─────────────┐
              │   Append    │              │  Live Edit  │       │    SQL      │
              │   Data      │              │   Cells     │       │   Query     │
              └─────────────┘              └─────────────┘       └─────────────┘
                     │                            │
                     └────────────┬───────────────┘
                                  ▼
                           ┌─────────────┐
                           │   Create    │
                           │  Change Req │
                           └─────────────┘
                                  │
                     ┌────────────┴────────────┐
                     ▼                         ▼
              ┌─────────────┐          ┌─────────────┐
              │   Review    │          │   Approve   │
              │   Changes   │─────────▶│   / Reject  │
              └─────────────┘          └─────────────┘
                                              │
                                              ▼
                                       ┌─────────────┐
                                       │    Merge    │
                                       │   to Main   │
                                       └─────────────┘
                                              │
                                              ▼
                                       ┌─────────────┐
                                       │   Audit     │
                                       │   Trail     │
                                       └─────────────┘
```

---

## Role-Based Access Summary

| Action | Owner | Contributor | Editor | Viewer |
|--------|-------|-------------|--------|--------|
| View data | ✅ | ✅ | ✅ | ✅ |
| Export data | ✅ | ✅ | ✅ | ✅ |
| Append data | ✅ | ✅ | ✅ | ❌ |
| Live edit | ✅ | ✅ | ✅ | ❌ |
| Submit CR | ✅ | ✅ | ✅ | ❌ |
| Review/Approve CR | ✅ | ✅ | ❌ | ❌ |
| Manage schema | ✅ | ✅ | ❌ | ❌ |
| Manage rules | ✅ | ✅ | ❌ | ❌ |
| Manage members | ✅ | ❌ | ❌ | ❌ |
| Delete dataset | ✅ | ❌ | ❌ | ❌ |
| Delete project | ✅ | ❌ | ❌ | ❌ |
