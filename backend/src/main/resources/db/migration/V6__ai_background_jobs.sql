ALTER TABLE ai_plan
    ADD COLUMN IF NOT EXISTS provider_response_id VARCHAR(255);

ALTER TABLE ai_plan
    ADD COLUMN IF NOT EXISTS provider_request_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS uk_ai_plan_provider_response
    ON ai_plan (provider_response_id)
    WHERE provider_response_id IS NOT NULL;
