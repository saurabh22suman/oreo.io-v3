-- 006_create_data_quality_results.sql
CREATE TABLE IF NOT EXISTS data_quality_results (
    id BIGSERIAL PRIMARY KEY,
    upload_id BIGINT NOT NULL REFERENCES dataset_uploads(id) ON DELETE CASCADE,
    rule_id BIGINT NOT NULL REFERENCES data_quality_rules(id),
    passed BOOLEAN NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dq_results_upload_id ON data_quality_results(upload_id);
CREATE INDEX IF NOT EXISTS idx_dq_results_rule_id ON data_quality_results(rule_id);
CREATE INDEX IF NOT EXISTS idx_dq_results_details_gin ON data_quality_results USING GIN (details);
