-- 1) index to speed up dataset lookups by project
CREATE INDEX IF NOT EXISTS idx_datasets_project_id ON datasets(project_id);

-- 2) add foreign key constraint if not present (use DO block to conditionally execute)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_datasets_project'
  ) THEN
    EXECUTE 'ALTER TABLE datasets ADD CONSTRAINT fk_datasets_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE';
  END IF;
END
$$;

-- 3) add dataset_count column to projects (nullable safe default 0)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS dataset_count integer DEFAULT 0;

-- 4) backfill dataset_count with current counts
UPDATE projects p SET dataset_count = COALESCE((SELECT COUNT(*) FROM datasets d WHERE d.project_id = p.id), 0);

-- 5) create or replace trigger function to maintain dataset_count
CREATE OR REPLACE FUNCTION projects_dataset_count_trigger() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE projects SET dataset_count = dataset_count + 1 WHERE id = NEW.project_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE projects SET dataset_count = GREATEST(dataset_count - 1, 0) WHERE id = OLD.project_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.project_id != OLD.project_id THEN
      UPDATE projects SET dataset_count = dataset_count + 1 WHERE id = NEW.project_id;
      UPDATE projects SET dataset_count = GREATEST(dataset_count - 1, 0) WHERE id = OLD.project_id;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 6) attach trigger to datasets table (if not already attached)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_datasets_count') THEN
    EXECUTE 'CREATE TRIGGER trg_datasets_count AFTER INSERT OR DELETE OR UPDATE ON datasets FOR EACH ROW EXECUTE FUNCTION projects_dataset_count_trigger()';
  END IF;
END
$$;
