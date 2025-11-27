-- 008_create_jobs_table.sql
-- Jobs table for background processing (schema inference, fetch tasks)

BEGIN;

CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type varchar(200) NOT NULL,
  status varchar(50) NOT NULL DEFAULT 'pending',
  metadata jsonb NULL,
  result jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);

COMMIT;
