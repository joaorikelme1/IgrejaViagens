UPDATE ai_plan
SET status = 'FAILED',
    error_code = 'EXTERNAL_PROVIDER_REMOVED',
    updated_at = CURRENT_TIMESTAMP
WHERE status IN ('DRAFT', 'GENERATING');
