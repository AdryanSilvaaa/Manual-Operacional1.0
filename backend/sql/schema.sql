CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('gerente', 'usuario')),
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
  criado_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE manuals
ADD COLUMN IF NOT EXISTS system_id INTEGER REFERENCES systems(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manual_id INTEGER NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
  UNIQUE (user_id, manual_id)
);

CREATE INDEX IF NOT EXISTS idx_permissions_user_id ON permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_manual_id ON permissions(manual_id);
CREATE INDEX IF NOT EXISTS idx_manuals_system_id ON manuals(system_id);
