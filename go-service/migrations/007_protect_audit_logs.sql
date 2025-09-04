-- 007_protect_audit_logs.sql
-- Prevent updates or deletes on audit_logs to enforce append-only behavior.
-- This migration creates a trigger function that raises an exception on UPDATE/DELETE
-- and attaches it to the audit_logs table.

BEGIN;

-- Create or replace a trigger function that will block updates/deletes
CREATE OR REPLACE FUNCTION audit_prevent_mods()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only and cannot be modified or deleted';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Remove any existing trigger with the same name to allow re-running safely
DROP TRIGGER IF EXISTS audit_logs_prevent_mods ON audit_logs;

-- Attach the trigger to block UPDATE and DELETE operations
CREATE TRIGGER audit_logs_prevent_mods
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION audit_prevent_mods();

COMMIT;
