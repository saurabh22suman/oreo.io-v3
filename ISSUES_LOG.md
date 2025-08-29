## 2025-08-29 Fixes (approvals & comments)

- Assigned reviewer cannot see Approve/Reject on change page
	- Fix: Backend now allows assigned reviewers or approver role to approve/reject; frontend shows buttons when user is assigned OR approver.
	- Files: go-service/controllers/changes.go; frontend/src/pages/ChangeDetailsPage.tsx; frontend/src/pages/DatasetApprovalsPage.tsx
	- Status: Deployed to dev.

- Comment should show commenter email
	- Fix: Normalize user_id extraction in ChangeCommentsCreate and include user_email in response; list already included email.
	- Files: go-service/controllers/change_details.go
	- Status: Deployed to dev.

- Edited numeric values validated as strings (e.g., Year '2026' flagged not integer)
	- Root cause: Edits from the grid produced string values; validation used schema requiring integer.
	- Fix: In `DatasetAppendFlowPage`, coerce edited values to schema types (integer/number/boolean) before validation and on save using dataset schema properties.
	- Files: frontend/src/pages/DatasetAppendFlowPage.tsx
	- Status: Deployed to dev.

- Multi-reviewer approval: require all reviewers to approve before status moves to 'approved'
	- Requirement: If a change request has multiple reviewers, status should only move to 'approved' and data appended when all assigned reviewers have approved.
	- Fix: Backend now updates reviewer_states for the acting user, then checks if all reviewers have status 'approved'. Only then does it proceed to final approval and data append. Otherwise, status remains 'pending'.
	- Files: go-service/controllers/changes.go
	- Status: Deployed to dev.

## 2025-08-29 UX improvements

- Gate Approve/Reject buttons on Approvals list page to assigned reviewers only.
	- Done: frontend conditionally renders based on current user id vs reviewer_id or reviewers_ids.

- Reviewer selection dialog: switch to checkbox multi-select.
	- Done: replaced <select multiple> with checkbox lists in DatasetsPage, DatasetDetailsPage, and DatasetUploadAppendPage.

- Change page should show per-reviewer approval status (PR-like).
	- Done (phase 1): backend added ChangeRequest.reviewer_states, initialized on change open; approve/reject update per-reviewer state; ChangeGet returns reviewer_states with emails. Frontend renders status badges.
	- Next: consider quorum policy (e.g., require all reviewers to approve before auto-approving) and UI to reflect when overall status transitions.

- Reshape append flow
	1) Project page should not show "choose append file".
		- Done: removed append UI from `DatasetsPage`.
	2) Dataset page should show an option to append new data.
		- Done: added "Open append flow" button linking to `/projects/:id/datasets/:datasetId/append` in `DatasetDetailsPage`.
	3) New page to upload, live edit, preview, and submit change.
		- Done: created `DatasetAppendFlowPage` with upload, live edit (AgGridDialog), preview edited, and submit dialog.
	4) Submit dialog should include editable change name, comment box, multi-select approvers, and submit button.
		- Done: submit dialog includes Title, Comment, checkbox list of members, and Submit.
	5) On submit, validate; on failure return to edit page with "Validation failed"; on success create change request.
		- Done: submit performs validate-first; shows "Validation failed" on this page if validation fails; on success calls open with title/comment and reviewers.

# Issues Log

Date: 2025-08-28

- Reviewer selection before creating change requests
  - Status: Done
  - Notes: Frontend prompts for an approver (project member with role approver) before opening an append change. Backend requires reviewer_id and validates role.

- Approver must be a project member
  - Status: Done
  - Notes: Backend validates reviewer_id against project members table and enforces role = approver.

- All users can see change requests
  - Status: Done (pre-existing)
  - Notes: List/get/preview/comments endpoints allow owner, contributor, approver, viewer.

- Only assigned approver can approve/reject
  - Status: Done
  - Notes: Approval and rejection require project role approver; if reviewer_id is set on the change, only that user can approve/reject.

- Requester can withdraw their own request
  - Status: Done
  - Notes: New endpoint POST /api/projects/:id/changes/:changeId/withdraw; only creator can withdraw pending requests.

Date: 2025-08-29

- Validate-first append flow with reviewer selection post-validation
	- Status: Done
	- Notes: Added endpoints /append/validate and /append/open (project and top-level). Frontend now validates file first, then opens reviewer picker and creates CR.

- Per-dataset append state isolation
	- Status: Done
	- Notes: Frontend now tracks selected file and pending upload_id per dataset to avoid cross-dataset bleed of filenames and actions.

- Comments should show the commenter’s email
	- Status: Done
	- Notes: Backend enriches comments list/create with user_email; UI displays it in Change Details.

- Assigned reviewer couldn’t see Approve/Reject
	- Status: Done
	- Notes: Backend auth now allows any assigned reviewer (single or multi) to approve/reject; UI shows buttons only to assigned reviewer(s).

- Show who the change is pending with (reviewer email)
	- Status: Done
	- Notes: Change details API now returns reviewer_email and reviewer_emails; UI renders them.

- Support multiple reviewers on a change
	- Status: Done
	- Notes: Added Reviewers array to ChangeRequest; AppendOpen/AppendJSON accept reviewer_ids; Datasets page and related dialogs support multi-select.

- Append flow: edit in dialog, then validate, with undo/close
	- Status: Partial
	- Notes: Added AppendJSONValidate endpoint and wired top-level route + UI to validate edited rows first and then open change with selected reviewers. Undo is currently achieved by closing the dialog without saving; a dedicated Undo control is a follow-up.
# Issues Log

Active date: 2025-08-28

## Dataset controls visibility and permissions
- Requirement 1: Viewer should only see Open and Preview data on Datasets list. Status: Done (frontend gating by role).
- Requirement 2: Only Owner and Contributor should see all other dataset options. Status: Done (frontend conditional buttons; backend already restricts destructive ops).
- Requirement 3: Only Owner can upload data; Contributor can only append. Status: Done (backend: DatasetUpload requires owner; frontend hides Upload button for non-owners, shows append for contributor/owner).

Notes:
- Admin delete remains owner-only on backend; UI hides Delete for non-owners.
- Append endpoints remain accessible to owner and contributor.

## Approvals workflow and roles
- Requirement: Owner and Contributor can raise append change requests. Approver role (assigned via Members) and Owner can approve; on approval the data should be appended to the main data. Status: Done.
	- Backend: ChangeApprove now writes approved upload content to a durable file and updates dataset LastUploadPath/LastUploadAt.
	- RBAC: Approve/Reject allowed for owner and approver. General dataset read endpoints no longer require approver.

## Viewer rename restriction

## DB-backed dataset persistence and staging (Aug 28, 2025)
- Goal: Persist datasets durably in Postgres and support approval staging.
- Done:
	- Created per-dataset main tables (ds_{dataset_id}) storing rows as JSONB (Postgres) or TEXT (SQLite).
	- Uploads ingest CSV/JSON into the main table (truncate-and-load) and save LastUploadAt.
	- Appends create staging tables (ds_{dataset_id}_stg_{change_id}) and ingest rows into staging.
	- On approval, staging rows are appended to main and the staging table is dropped; LastUploadAt updated.
	- Dataset preview/sample/stats read from DB first; fallback to file+python if needed.
	- Added a simple query endpoint POST /api/datasets/:id/query for viewer tooling (limit/offset and optional JSON contains filter when on Postgres).
- Deferred / Notes:
	- Query endpoint is minimal and not a full SQL engine; targeted for basic filtering only.
	- Existing datasets with only file paths should perform one upload post-deploy to seed DB.
	- Consider indexes on frequently filtered JSON keys.
- Requirement: Viewer must not be able to rename datasets. Status: Done (UI hides rename; backend update endpoint remains owner+contributor only).

## Metadata storage and on-demand preview (Aug 28, 2025)
- Added DatasetMeta (sys.metadata for Postgres, sys_metadata for SQLite) and auto-migration. On upload, we compute and upsert row_count, column_count, owner_name, last_update_at. DatasetStats now reads from metadata and includes pending approvals.
- On approval, after merging staging -> main, we now refresh metadata to keep totals accurate. Done.
- Frontend DatasetDetailsPage no longer auto-loads preview; it first fetches stats (owner and totals) and offers a Load preview button. Done.
- Frontend DatasetViewerPage now shows metadata-derived totals and owner, and loads data on demand with an optional JSON filter. Done.
- Next: audit remaining pages to replace preview-driven totals with metadata where applicable; add tests for metadata upsert on upload and approval.

## Frontend UX tweaks (Aug 28, 2025)
- Start on Auth page if logged out; navigate to Projects after login. Done.
- Projects tab hidden until logged in; appears after login. Done.
- Temporarily hide "Data operations (beta)" panel. Done (gated off in DatasetsPage).
- Show upload progress bar during file uploads (create + per-dataset upload). Done (XHR with progress + modal overlay).
- Show "Last updated" date on dataset details page. Done.

## Preview and messaging improvements (Aug 29, 2025)
- Add dismissible [x] button on all success/failure messages. Done (Alert component; integrated across pages).
- In Datasets page, Preview data opens in a popup (dialog) instead of any inline table. Done (always uses AgGridDialog; no inline table).
- Maintain column order in previews based on dataset schema. Done (orderColumnsBySchema utility applied for previews).
- Simplify preview dialog UI: no pagination/exports/row selection when showing only 50 rows; show only Close. Done (AgGridDialog compact mode).

## Follow-ups (Aug 29, 2025)
- Dataset details preview should be a popup, not inline. Done (opens AgGridDialog compact on Load preview).
- After initial upload, hide the Upload data option; only allow Append thereafter. Done (UI hides Upload when last_upload_at exists).

## Upload and preview fixes (Aug 29, 2025)
- Upload progress bar reaches 100% before file fully processed. Fixed.
	- Change: During XMLHttpRequest upload progress, clamp visual progress to 99% and show "Uploading…"; set 100% only after server response (success). Updated in `frontend/src/pages/DatasetsPage.tsx` (uploadWithProgress).
- PM2.5 column not visible in preview dialog despite source data. Fixed.
	- Root cause: Columns with dots (e.g., "PM2.5") were used as field keys; ag-Grid field path resolution can mis-handle dotted keys.
	- Change: Use valueGetter/valueSetter with the literal column name so special characters are read/written correctly. Updated in `frontend/src/components/AgGridDialog.tsx`.

	## Viewer and persistence updates (Aug 29, 2025)
	- Consistent column order everywhere. Done.
		- Applied schema-based ordering via `orderColumnsBySchema` wherever previews are loaded; dialog rendering uses the ordered columns.
	- Editing is allowed only in append flows. Done.
		- Set `allowEdit={false}` for Dataset list/detail previews and Dataset Viewer; kept editing enabled only in Append flow dialog.
	- Temporary upload table naming: <project_name>.upload.<dataset_name>. Done (metadata only).
		- Metadata `table_location` added to `DatasetMeta` and computed in backend; exposed via `/datasets/:id/stats` for UI.
	- Show table location in Dataset open tab. Done.
		- Displayed under metadata on dataset details page using `stats.table_location`.

		## Members and layout fixes (Aug 29, 2025)
		- Remove Approver from the Add member role dropdown. Done.
		- Owner cannot remove themselves. Done (hide Remove on owner record).
		- Keep Datasets and Members page widths consistent to avoid layout jump. Done (both use max-w-4xl).
