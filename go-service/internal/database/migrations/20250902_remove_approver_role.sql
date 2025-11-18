-- Migration: remove 'approver' role, keep only owner/contributor/viewer
-- 1) Migrate existing approver roles to viewer
UPDATE project_roles SET role = 'viewer' WHERE LOWER(role) = 'approver';

-- 2) Enforce allowed roles via CHECK constraint
-- Drop existing constraint if present (name may vary; use IF EXISTS and common names)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name='project_roles' AND constraint_type='CHECK' AND constraint_name='project_roles_role_check'
    ) THEN
        EXECUTE 'ALTER TABLE project_roles DROP CONSTRAINT project_roles_role_check';
    END IF;
EXCEPTION WHEN undefined_table THEN
    -- table may not exist yet in early setups
    NULL;
END $$;

-- Create new CHECK constraint
ALTER TABLE project_roles
    ADD CONSTRAINT project_roles_role_check CHECK (LOWER(role) IN ('owner','contributor','viewer'));
