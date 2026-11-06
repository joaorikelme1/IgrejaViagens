CREATE UNIQUE INDEX IF NOT EXISTS uk_ai_plan_active_trip
    ON ai_plan (trip_id)
    WHERE status IN ('DRAFT', 'GENERATING');
