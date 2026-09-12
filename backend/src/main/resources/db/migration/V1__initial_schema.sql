CREATE TABLE IF NOT EXISTS app_user (
    cpf VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    password VARCHAR(255),
    role VARCHAR(255),
    birthdate VARCHAR(255),
    first_login BOOLEAN NOT NULL,
    married BOOLEAN NOT NULL,
    spouse_name VARCHAR(255),
    has_kids BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS trip (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    destination VARCHAR(255),
    departure_place VARCHAR(255),
    departure_time VARCHAR(255),
    date DATE,
    max_people INTEGER,
    price DOUBLE PRECISION,
    arrecadation_goal DOUBLE PRECISION,
    rules VARCHAR(1000),
    buses_json TEXT,
    hotels_json TEXT,
    travelers_json TEXT
);

CREATE TABLE IF NOT EXISTS payment (
    id VARCHAR(255) PRIMARY KEY,
    user_cpf VARCHAR(255) NOT NULL,
    trip_id VARCHAR(255) NOT NULL,
    total_installments INTEGER NOT NULL,
    paid_installments INTEGER NOT NULL,
    due_day INTEGER NOT NULL,
    locked BOOLEAN NOT NULL,
    receipts_json TEXT
);

CREATE TABLE IF NOT EXISTS room (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(255),
    capacity INTEGER NOT NULL,
    name VARCHAR(255),
    hotel_id VARCHAR(255),
    trip_id VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS room_occupants (
    room_id VARCHAR(255) NOT NULL,
    occupants VARCHAR(255),
    CONSTRAINT fk_room_occupants_room
        FOREIGN KEY (room_id) REFERENCES room (id)
);

CREATE TABLE IF NOT EXISTS seat (
    id VARCHAR(255) PRIMARY KEY,
    trip_id VARCHAR(255) NOT NULL,
    bus_id VARCHAR(255) NOT NULL,
    floor INTEGER NOT NULL,
    seat_number INTEGER NOT NULL,
    user_cpf VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS bus (
    id VARCHAR(255) PRIMARY KEY,
    floors INTEGER NOT NULL,
    seats INTEGER NOT NULL,
    seats_floor1 INTEGER NOT NULL,
    seats_floor2 INTEGER NOT NULL,
    trip_id VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS user_kids (
    user_cpf VARCHAR(255) NOT NULL,
    kids VARCHAR(255),
    CONSTRAINT fk_user_kids_user
        FOREIGN KEY (user_cpf) REFERENCES app_user (cpf)
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM payment
        GROUP BY user_cpf, trip_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Existem pagamentos duplicados por viajante e viagem.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uk_payment_user_trip'
    ) THEN
        ALTER TABLE payment
            ADD CONSTRAINT uk_payment_user_trip UNIQUE (user_cpf, trip_id);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM seat
        GROUP BY trip_id, bus_id, floor, seat_number
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Existem ocupacoes duplicadas na mesma posicao de assento.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM seat
        GROUP BY trip_id, user_cpf
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Existem viajantes com mais de um assento na mesma viagem.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uk_seat_trip_position'
    ) THEN
        ALTER TABLE seat
            ADD CONSTRAINT uk_seat_trip_position
            UNIQUE (trip_id, bus_id, floor, seat_number);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uk_seat_trip_traveler'
    ) THEN
        ALTER TABLE seat
            ADD CONSTRAINT uk_seat_trip_traveler UNIQUE (trip_id, user_cpf);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_user_cpf ON payment (user_cpf);
CREATE INDEX IF NOT EXISTS idx_payment_trip_id ON payment (trip_id);
CREATE INDEX IF NOT EXISTS idx_room_trip_id ON room (trip_id);
CREATE INDEX IF NOT EXISTS idx_seat_trip_id ON seat (trip_id);
CREATE INDEX IF NOT EXISTS idx_seat_user_cpf ON seat (user_cpf);
CREATE INDEX IF NOT EXISTS idx_bus_trip_id ON bus (trip_id);
