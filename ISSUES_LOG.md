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
