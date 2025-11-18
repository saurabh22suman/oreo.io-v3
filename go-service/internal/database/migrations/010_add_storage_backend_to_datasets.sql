-- Adds storage_backend column to datasets to support per-dataset backend selection
ALTER TABLE IF EXISTS datasets ADD COLUMN IF NOT EXISTS storage_backend VARCHAR(50);
