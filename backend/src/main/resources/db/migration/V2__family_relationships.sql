ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS spouse_cpf VARCHAR(11);

CREATE TABLE IF NOT EXISTS user_child_cpfs (
    user_cpf VARCHAR(255) NOT NULL,
    child_cpf VARCHAR(11) NOT NULL,
    CONSTRAINT fk_user_child_cpfs_user
        FOREIGN KEY (user_cpf) REFERENCES app_user (cpf) ON DELETE CASCADE,
    CONSTRAINT fk_user_child_cpfs_child
        FOREIGN KEY (child_cpf) REFERENCES app_user (cpf) ON DELETE CASCADE,
    CONSTRAINT uk_user_child_cpfs UNIQUE (user_cpf, child_cpf)
);

CREATE INDEX IF NOT EXISTS idx_app_user_spouse_cpf ON app_user (spouse_cpf);
CREATE INDEX IF NOT EXISTS idx_user_child_cpfs_child_cpf ON user_child_cpfs (child_cpf);

-- Reconcilia somente nomes que identificam um unico cadastro. Nomes repetidos
-- permanecem sem vinculo para evitar associar familias incorretamente.
UPDATE app_user u
SET spouse_cpf = (
    SELECT MIN(c.cpf)
    FROM app_user c
    WHERE c.cpf <> u.cpf
      AND LOWER(TRIM(c.name)) = LOWER(TRIM(u.spouse_name))
)
WHERE u.married = TRUE
  AND u.spouse_cpf IS NULL
  AND u.spouse_name IS NOT NULL
  AND TRIM(u.spouse_name) <> ''
  AND (
      SELECT COUNT(*)
      FROM app_user c
      WHERE c.cpf <> u.cpf
        AND LOWER(TRIM(c.name)) = LOWER(TRIM(u.spouse_name))
  ) = 1
  AND (
      SELECT COUNT(*)
      FROM app_user other_u
      WHERE other_u.married = TRUE
        AND LOWER(TRIM(other_u.spouse_name)) = LOWER(TRIM(u.spouse_name))
  ) = 1;

ALTER TABLE app_user
    ADD CONSTRAINT fk_app_user_spouse
    FOREIGN KEY (spouse_cpf) REFERENCES app_user (cpf) ON DELETE SET NULL;

-- Completa o lado inverso somente quando existe um unico vinculo de entrada.
UPDATE app_user s
SET spouse_cpf = (
        SELECT MIN(u.cpf)
        FROM app_user u
        WHERE u.spouse_cpf = s.cpf
    ),
    spouse_name = (
        SELECT MIN(u.name)
        FROM app_user u
        WHERE u.spouse_cpf = s.cpf
    ),
    married = TRUE
WHERE s.spouse_cpf IS NULL
  AND (
      SELECT COUNT(*)
      FROM app_user u
      WHERE u.spouse_cpf = s.cpf
  ) = 1;
