-- 005_create_data_quality_rules.sql
CREATE TABLE IF NOT EXISTS data_quality_rules (
    id BIGSERIAL PRIMARY KEY,
    dataset_id BIGINT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL,
    definition JSONB NOT NULL,
    severity TEXT NOT NULL DEFAULT 'block',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dq_rules_dataset_id ON data_quality_rules(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dq_rules_definition_gin ON data_quality_rules USING GIN (definition);
