ALTER TABLE trip
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE trip
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS trip_traveler_preference (
    id VARCHAR(255) PRIMARY KEY,
    trip_id VARCHAR(255) NOT NULL,
    user_cpf VARCHAR(255) NOT NULL,
    mobility_requirement VARCHAR(40) NOT NULL DEFAULT 'NONE',
    seat_region VARCHAR(40) NOT NULL DEFAULT 'ANY',
    preferred_bus_floor INTEGER,
    preferred_room_type VARCHAR(100),
    include_in_ai_planning BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_trip_traveler_preference_trip
        FOREIGN KEY (trip_id) REFERENCES trip (id) ON DELETE CASCADE,
    CONSTRAINT fk_trip_traveler_preference_user
        FOREIGN KEY (user_cpf) REFERENCES app_user (cpf) ON DELETE CASCADE,
    CONSTRAINT uk_trip_traveler_preference UNIQUE (trip_id, user_cpf),
    CONSTRAINT ck_trip_traveler_preference_floor
        CHECK (preferred_bus_floor IS NULL OR preferred_bus_floor > 0)
);

CREATE TABLE IF NOT EXISTS trip_traveler_preference_companion (
    preference_id VARCHAR(255) NOT NULL,
    companion_cpf VARCHAR(255) NOT NULL,
    CONSTRAINT fk_preference_companion_preference
        FOREIGN KEY (preference_id) REFERENCES trip_traveler_preference (id) ON DELETE CASCADE,
    CONSTRAINT fk_preference_companion_user
        FOREIGN KEY (companion_cpf) REFERENCES app_user (cpf) ON DELETE CASCADE,
    CONSTRAINT uk_preference_companion UNIQUE (preference_id, companion_cpf)
);

CREATE TABLE IF NOT EXISTS trip_traveler_preference_separation (
    preference_id VARCHAR(255) NOT NULL,
    separated_from_cpf VARCHAR(255) NOT NULL,
    CONSTRAINT fk_preference_separation_preference
        FOREIGN KEY (preference_id) REFERENCES trip_traveler_preference (id) ON DELETE CASCADE,
    CONSTRAINT fk_preference_separation_user
        FOREIGN KEY (separated_from_cpf) REFERENCES app_user (cpf) ON DELETE CASCADE,
    CONSTRAINT uk_preference_separation UNIQUE (preference_id, separated_from_cpf)
);

CREATE TABLE IF NOT EXISTS ai_plan (
    id VARCHAR(255) PRIMARY KEY,
    trip_id VARCHAR(255) NOT NULL,
    created_by_cpf VARCHAR(255),
    status VARCHAR(40) NOT NULL,
    provider VARCHAR(100),
    model VARCHAR(100),
    prompt_version VARCHAR(100),
    snapshot_hash VARCHAR(64) NOT NULL,
    result_json TEXT,
    input_tokens BIGINT,
    output_tokens BIGINT,
    estimated_cost NUMERIC(18, 8),
    error_code VARCHAR(100),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    applied_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_ai_plan_trip
        FOREIGN KEY (trip_id) REFERENCES trip (id) ON DELETE CASCADE,
    CONSTRAINT fk_ai_plan_creator
        FOREIGN KEY (created_by_cpf) REFERENCES app_user (cpf) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_trip_traveler_preference_trip
    ON trip_traveler_preference (trip_id);
CREATE INDEX IF NOT EXISTS idx_ai_plan_trip_created
    ON ai_plan (trip_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_plan_status
    ON ai_plan (status);
