# Data Integration & Governance Tracker

This tracker records tasks and subtasks required to implement the Security & Governance schema and supporting application code for Oreo.io.

## Epic: Security & Governance (priority: High)
Goal: Add session tracking, audit logs, project activities, notifications, data quality rules, and validation results plus API/service layer and RBAC integration.

### Tasks
1. Create Postgres DDL migrations
   - Subtasks:
     - Add migration `001_create_user_sessions.sql` (user_sessions table)
     - Add migration `002_create_audit_logs.sql` (audit_logs table, partitioning plan)
     - Add migration `003_create_project_activities.sql` (project_activities)
     - Add migration `004_create_notifications.sql` (notifications)
     - Add migration `005_create_data_quality_rules.sql` (data_quality_rules)
     - Add migration `006_create_data_quality_results.sql` (data_quality_results)
     - Add indexes (GIN on JSONB fields, indexes on foreign keys)
     - Add sample BACKFILL script for `audit_logs` partitioning if needed

2. Backend service layer (Golang)
   - Subtasks:
     - Create `go-service/models/security.go` with GORM models for new tables using UUID PKs
     - Create `go-service/controllers/security.go` with handlers: session create/revoke/list, audit write/query, activities create/list, notifications CRUD, DQ rules CRUD, DQ results ingest/list
     - Add helper packages: `go-service/services/audit.go` (append-only audit writer), `go-service/services/notifications.go` (enqueue/send)
     - Wire routes in `server.go` under `/api/security` or appropriate groups
     - Add RBAC checks using existing `HasProjectRole` patterns

3. Migrations & DB maintenance
   - Subtasks:
     - Add SQL to `go-service/migrations/*.sql` and a small README describing how to apply (psql or goose/migrate)
     - Provide a `backfill_target_structured_fields.sql` to populate `target_database/target_schema/target_table` from existing `target_dsn`
     - Add recommended indexes and GIN indexes for JSONB

4. Tests
   - Subtasks:
     - Unit tests for `parseTargetDSN` and migration validation
     - Integration tests for session creation/revocation and audit logging (Docker compose test target)

5. API design & docs
   - Subtasks:
     - Document endpoints in `docs/api_doc.md` for security features
     - Provide request/response examples and RBAC notes

6. Operational notes
   - Subtasks:
     - Recommend external sinks (ELK/Loki) and partitioning strategies for `audit_logs` and `project_activities`
     - Add cron / background worker to compact old `user_sessions` and prune expired notifications

---

## Next immediate actions (this branch)
- Add Postgres SQL migration files for the six tables and an example backfill script.
- Add GORM models in `go-service/models/security.go`.
- Add minimal controller skeleton `go-service/controllers/security.go` and wire routes in `server.go`.
- Run `go build` in `go-service` to validate no syntax errors.

I'll proceed to add the migrations and the Go skeletons now and run a quick build check.
