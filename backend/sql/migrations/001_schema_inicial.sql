-- 001_schema_inicial.sql
--
-- Schema do Manual Operacional Digital (backend Google Cloud), conforme a
-- seção 2 do documento de execução:
--
--   Departamento -> Sistema -> Manual
--
--   departamentos  id, nome
--   sistemas       id, nome, departamento_id      (pertence a UM departamento)
--   usuarios       id, email, senha_hash, papel, departamento_id
--   manuais        id, titulo, objeto_key, sistema_id  (depto = o do sistema)
--
-- Decisões registradas:
--  * papel ∈ (administrador, gerente, usuario). Administrador é global e tem
--    departamento_id NULO; gerente e usuário exigem departamento_id. A regra é
--    garantida por CHECK no banco, além da validação da API (T11).
--  * Pendência 2 (exclusão em cascata): adotada a opção (a) — BLOQUEAR a
--    exclusão enquanto houver vínculos. Por isso todas as FKs são
--    ON DELETE RESTRICT. Afeta T8 (departamentos) e T9 (sistemas).
--  * O departamento de um manual NÃO é replicado: deriva sempre do sistema,
--    evitando divergência entre as duas colunas.
--
-- Aplicar:  psql "$DATABASE_URL" -f sql/migrations/001_schema_inicial.sql
-- É idempotente (IF NOT EXISTS) e roda dentro de uma transação.

BEGIN;

-- ---------------------------------------------------------------- departamentos
CREATE TABLE IF NOT EXISTS departamentos (
  id            SERIAL PRIMARY KEY,
  nome          VARCHAR(120) NOT NULL UNIQUE,
  criado_em     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------- sistemas
-- Cada sistema pertence a exatamente um departamento (não é global).
CREATE TABLE IF NOT EXISTS sistemas (
  id              SERIAL PRIMARY KEY,
  nome            VARCHAR(160) NOT NULL,
  departamento_id INTEGER      NOT NULL
                  REFERENCES departamentos(id) ON DELETE RESTRICT,
  criado_em       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- Dois sistemas de mesmo nome podem existir em departamentos diferentes.
  CONSTRAINT sistemas_nome_por_departamento UNIQUE (departamento_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_sistemas_departamento
  ON sistemas (departamento_id);

-- --------------------------------------------------------------------- usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id              SERIAL PRIMARY KEY,
  email           VARCHAR(160) NOT NULL UNIQUE,
  senha_hash      TEXT         NOT NULL,
  papel           VARCHAR(20)  NOT NULL,
  departamento_id INTEGER      REFERENCES departamentos(id) ON DELETE RESTRICT,
  criado_em       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT usuarios_papel_valido
    CHECK (papel IN ('administrador', 'gerente', 'usuario')),

  -- Administrador é global (sem departamento); gerente e usuário exigem um.
  CONSTRAINT usuarios_departamento_por_papel CHECK (
    (papel = 'administrador' AND departamento_id IS NULL)
    OR (papel IN ('gerente', 'usuario') AND departamento_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_usuarios_departamento
  ON usuarios (departamento_id);

-- ---------------------------------------------------------------------- manuais
-- Todo manual é vinculado a exatamente um sistema; seu departamento é o do
-- sistema (join com sistemas). objeto_key é a chave no Cloud Storage — o
-- arquivo nunca passa pela API.
CREATE TABLE IF NOT EXISTS manuais (
  id            SERIAL PRIMARY KEY,
  titulo        VARCHAR(180) NOT NULL,
  objeto_key    TEXT         NOT NULL,
  sistema_id    INTEGER      NOT NULL
                REFERENCES sistemas(id) ON DELETE RESTRICT,
  criado_em     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manuais_sistema
  ON manuais (sistema_id);

COMMIT;
