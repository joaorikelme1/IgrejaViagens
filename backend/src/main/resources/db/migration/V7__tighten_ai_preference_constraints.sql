ALTER TABLE trip_traveler_preference
    DROP CONSTRAINT IF EXISTS ck_trip_traveler_preference_floor;

ALTER TABLE trip_traveler_preference
    ADD CONSTRAINT ck_trip_traveler_preference_floor
        CHECK (preferred_bus_floor IS NULL OR preferred_bus_floor BETWEEN 1 AND 2);
