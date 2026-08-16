-- Estrutura e migrações idempotentes do PostgreSQL.
-- Altere colunas/restrições aqui junto dos models; filtros e índices afetam acesso e desempenho.
CREATE TABLE IF NOT EXISTS sectors (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(160) UNIQUE,
  identificador VARCHAR(160) UNIQUE,
  senha TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('suporte', 'gerente_setor', 'usuario')),
  sector_id INTEGER REFERENCES sectors(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS systems (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(160) NOT NULL,
  resumo TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manuals (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(180) NOT NULL,
  descricao TEXT,
  pdf_url TEXT NOT NULL,
  video_url TEXT NOT NULL,
  system_id INTEGER REFERENCES systems(id) ON DELETE SET NULL,
  sector_id INTEGER REFERENCES sectors(id) ON DELETE RESTRICT,
  criado_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE manuals
ADD COLUMN IF NOT EXISTS system_id INTEGER REFERENCES systems(id) ON DELETE SET NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS identificador VARCHAR(160);
ALTER TABLE users ADD COLUMN IF NOT EXISTS sector_id INTEGER REFERENCES sectors(id) ON DELETE SET NULL;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Migra o perfil legado de gerente para suporte, que possui administracao completa.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
CHECK (role IN ('suporte', 'gerente_setor', 'usuario'));
UPDATE users SET role = 'suporte' WHERE role = 'gerente';

ALTER TABLE manuals ADD COLUMN IF NOT EXISTS sector_id INTEGER REFERENCES sectors(id) ON DELETE RESTRICT;

-- Mantem os registros ja existentes utilizaveis apos a migracao para setores.
INSERT INTO sectors (nome) VALUES ('Geral') ON CONFLICT (nome) DO NOTHING;
UPDATE users SET identificador = email WHERE identificador IS NULL AND email IS NOT NULL;
UPDATE users SET sector_id = (SELECT id FROM sectors WHERE nome = 'Geral')
WHERE sector_id IS NULL AND role = 'usuario';
UPDATE manuals SET sector_id = (SELECT id FROM sectors WHERE nome = 'Geral')
WHERE sector_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_identificador_unique
ON users (identificador) WHERE identificador IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_sector_id_fkey') THEN
    ALTER TABLE users ADD CONSTRAINT users_sector_id_fkey
    FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manual_id INTEGER NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
  UNIQUE (user_id, manual_id)
);

CREATE INDEX IF NOT EXISTS idx_permissions_user_id ON permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_manual_id ON permissions(manual_id);
CREATE INDEX IF NOT EXISTS idx_manuals_system_id ON manuals(system_id);
CREATE INDEX IF NOT EXISTS idx_manuals_sector_id ON manuals(sector_id);
CREATE INDEX IF NOT EXISTS idx_users_sector_id ON users(sector_id);

CREATE TABLE IF NOT EXISTS manual_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manual_id INTEGER NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
  pdf_completed BOOLEAN NOT NULL DEFAULT FALSE,
  video_progress NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (video_progress BETWEEN 0 AND 100),
  total_seconds INTEGER NOT NULL DEFAULT 0,
  first_access_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_access_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  PRIMARY KEY (user_id, manual_id)
);

CREATE INDEX IF NOT EXISTS idx_manual_progress_manual_id ON manual_progress(manual_id);
CREATE INDEX IF NOT EXISTS idx_manual_progress_completed_at ON manual_progress(completed_at);

-- Evolução do treinamento: publicação, prazo, versão e acompanhamento real do PDF.
ALTER TABLE manuals ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE manuals ADD COLUMN IF NOT EXISTS due_at TIMESTAMP;
ALTER TABLE manuals ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE manual_progress ADD COLUMN IF NOT EXISTS page_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE manual_progress ADD COLUMN IF NOT EXISTS last_page INTEGER NOT NULL DEFAULT 0;
ALTER TABLE manual_progress ADD COLUMN IF NOT EXISTS pages_viewed INTEGER[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS quiz_questions (
  id SERIAL PRIMARY KEY,
  manual_id INTEGER NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_option INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manual_id INTEGER NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  answers JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80),
  entity_id VARCHAR(80),
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS manual_version_history (
  id BIGSERIAL PRIMARY KEY,
  manual_id INTEGER NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  titulo VARCHAR(180) NOT NULL,
  descricao TEXT,
  pdf_url TEXT NOT NULL,
  video_url TEXT NOT NULL,
  archived_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (manual_id, version)
);

CREATE TABLE IF NOT EXISTS progress_version_history (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manual_id INTEGER NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  archived_at TIMESTAMP NOT NULL DEFAULT NOW()
);
