-- Prumo - banco PostgreSQL completo
-- Execute: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/sql/schema.sql
-- O script é transacional e pode ser reexecutado para atualizar instalações antigas.
--
-- Este arquivo é a fonte única do banco. Para duplicar o projeto, rode só ele num banco vazio
-- (no Neon, cole o conteúdo inteiro no Query Tool do pgAdmin). Toda mudança de banco entra aqui,
-- sempre de forma que possa ser reexecutada (IF NOT EXISTS, DROP CONSTRAINT IF EXISTS etc.).
--
-- Histórico das mudanças já incluídas abaixo:
--   - Setores: tabela user_sectors (usuário em um ou mais setores).
--   - Provas: tabelas exams, exam_questions, exam_submissions e exam_answers.
--   - Perfil editor_conteudo: restrição users_role_check com suporte, editor_conteudo, gerente_setor e usuario.
--   - Manual com PDF e/ou vídeo: pdf_url e video_url opcionais + restrição manuals_pdf_or_video_check
--     (também em manual_version_history).
--   - Aparência white label (cores e logos): tabela app_settings, chave 'branding'.
--   - Manual em vários setores: tabela manual_sectors (manuals.sector_id fica com o primeiro setor).
--   - Prova bloqueada ao sair da página: exam_submissions.status (em_andamento, enviada, encerrada)
--     e started_at; submitted_at fica nulo enquanto a prova está em andamento.
--   - Prova do manual: exams.manual_id (uma prova por manual) e exams.required (obrigatória ou não);
--     ends_at passa a aceitar nulo; prova de manual nunca expira (ends_at sempre nulo).
--   - Modelos de prova: exam_templates e exam_template_questions (por setor), exams.template_id
--     e exam_assignees (prova aplicada só a colaboradores escolhidos).
--   - Perfis de acesso (nov/2026): suporte vira admin; novos admin_cadastros (cria usuários, setores e sistemas,
--     sem painel) e gestor_area (painel e resultados dos seus setores, sem publicar). As permissões de cada perfil
--     ficam em backend/src/utils/access.js; aqui só a lista de perfis válidos.
--   - Unidades (nov/2026): tabelas units, user_units e manual_units e exams.unit_id. O setor é comum à rede e a
--     unidade é um segundo filtro. Na migração, todos os usuários existentes entram na unidade 'Matriz' e os
--     manuais existentes ficam para todas as unidades (sem linhas em manual_units).
--   - Endereço da unidade (nov/2026): cep, logradouro, numero, complemento, bairro, cidade e uf em units (opcionais).
--   - Revisão de segurança (nov/2026): users.must_change_password (senha provisória precisa ser trocada no
--     primeiro acesso), admin padrão criado só quando não existe e índices nas chaves estrangeiras de usuário.
BEGIN;

CREATE TABLE IF NOT EXISTS sectors (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS systems (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(160) NOT NULL,
  resumo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(160) UNIQUE,
  identificador VARCHAR(160),
  senha TEXT NOT NULL,
  role VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manuals (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(180) NOT NULL,
  descricao TEXT,
  pdf_url TEXT,
  video_url TEXT,
  system_id INTEGER,
  sector_id INTEGER,
  criado_por INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Colunas introduzidas depois da primeira versão.
ALTER TABLE users ADD COLUMN IF NOT EXISTS identificador VARCHAR(160);
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
-- TRUE = a senha foi definida por outra pessoa (cadastro, importação ou redefinição) e precisa ser trocada.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE manuals ADD COLUMN IF NOT EXISTS system_id INTEGER;
ALTER TABLE manuals ADD COLUMN IF NOT EXISTS sector_id INTEGER;
ALTER TABLE manuals ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE manuals ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
-- O manual pode ter só PDF, só vídeo ou os dois, mas não pode ficar sem nenhum.
ALTER TABLE manuals ALTER COLUMN pdf_url DROP NOT NULL;
ALTER TABLE manuals ALTER COLUMN video_url DROP NOT NULL;
ALTER TABLE manuals DROP CONSTRAINT IF EXISTS manuals_pdf_or_video_check;
ALTER TABLE manuals ADD CONSTRAINT manuals_pdf_or_video_check CHECK (pdf_url IS NOT NULL OR video_url IS NOT NULL);

-- Destinos neutros para relacionamentos ausentes em registros legados.
INSERT INTO sectors (nome) VALUES ('Geral') ON CONFLICT (nome) DO NOTHING;
INSERT INTO systems (nome, resumo)
SELECT 'Geral', 'Sistema padrão para dados migrados'
WHERE NOT EXISTS (SELECT 1 FROM systems WHERE nome = 'Geral');

-- Converte os perfis legados (gerente e suporte viram admin) antes de aplicar a nova restrição.
-- Perfis: admin, admin_cadastros, editor_conteudo, gestor_area, gerente_setor e usuario (até 20 caracteres).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role = 'admin' WHERE role IN ('gerente', 'suporte');
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'admin_cadastros', 'editor_conteudo', 'gestor_area', 'gerente_setor', 'usuario'));

UPDATE users
SET identificador = COALESCE(NULLIF(BTRIM(email), ''), 'usuario_' || id)
WHERE identificador IS NULL OR BTRIM(identificador) = '';

UPDATE manuals
SET sector_id = (SELECT id FROM sectors WHERE nome = 'Geral')
WHERE sector_id IS NULL;

UPDATE manuals
SET system_id = (SELECT id FROM systems WHERE nome = 'Geral' ORDER BY id LIMIT 1)
WHERE system_id IS NULL;

ALTER TABLE users ALTER COLUMN identificador SET NOT NULL;
ALTER TABLE manuals ALTER COLUMN system_id SET NOT NULL;
ALTER TABLE manuals ALTER COLUMN sector_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_identificador_unique ON users (identificador);

-- Relações explícitas e compatíveis com as regras da aplicação.
ALTER TABLE manuals DROP CONSTRAINT IF EXISTS manuals_system_id_fkey;
ALTER TABLE manuals ADD CONSTRAINT manuals_system_id_fkey
  FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE RESTRICT;
ALTER TABLE manuals DROP CONSTRAINT IF EXISTS manuals_sector_id_fkey;
ALTER TABLE manuals ADD CONSTRAINT manuals_sector_id_fkey
  FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE RESTRICT;
ALTER TABLE manuals DROP CONSTRAINT IF EXISTS manuals_criado_por_fkey;
ALTER TABLE manuals ADD CONSTRAINT manuals_criado_por_fkey
  FOREIGN KEY (criado_por) REFERENCES users(id) ON DELETE SET NULL;

-- Setores de cada manual (um ou mais): quem tem qualquer um deles vê o manual.
-- manuals.sector_id continua obrigatório e guarda o primeiro setor escolhido.
CREATE TABLE IF NOT EXISTS manual_sectors (
  manual_id INTEGER NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
  sector_id INTEGER NOT NULL REFERENCES sectors(id) ON DELETE RESTRICT,
  PRIMARY KEY (manual_id, sector_id)
);
-- Manuais criados antes desta tabela passam a valer para o setor que já tinham.
INSERT INTO manual_sectors (manual_id, sector_id)
SELECT id, sector_id FROM manuals
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manual_id INTEGER NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
  UNIQUE (user_id, manual_id)
);

CREATE TABLE IF NOT EXISTS manual_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manual_id INTEGER NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
  pdf_completed BOOLEAN NOT NULL DEFAULT FALSE,
  video_progress NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (video_progress BETWEEN 0 AND 100),
  total_seconds INTEGER NOT NULL DEFAULT 0 CHECK (total_seconds >= 0),
  page_count INTEGER NOT NULL DEFAULT 0 CHECK (page_count >= 0),
  last_page INTEGER NOT NULL DEFAULT 0 CHECK (last_page >= 0),
  pages_viewed INTEGER[] NOT NULL DEFAULT '{}',
  first_access_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_access_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, manual_id)
);
ALTER TABLE manual_progress ADD COLUMN IF NOT EXISTS page_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE manual_progress ADD COLUMN IF NOT EXISTS last_page INTEGER NOT NULL DEFAULT 0;
ALTER TABLE manual_progress ADD COLUMN IF NOT EXISTS pages_viewed INTEGER[] NOT NULL DEFAULT '{}';

-- Setores de cada usuário. Os perfis podem ter vários; admin e editor de conteúdo não precisam de nenhum.
-- O acesso a manuais, provas e painel considera todos os setores do usuário.
CREATE TABLE IF NOT EXISTS user_sectors (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sector_id INTEGER NOT NULL REFERENCES sectors(id) ON DELETE RESTRICT,
  PRIMARY KEY (user_id, sector_id)
);

-- Provas por setor: gerente de setor cria para o próprio setor; admin escolhe um setor ou todos.
-- sector_id NULL significa prova para todos os setores (ou, com manual_id, para os setores do manual).
CREATE TABLE IF NOT EXISTS exams (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(180) NOT NULL CHECK (BTRIM(titulo) <> ''),
  descricao TEXT,
  sector_id INTEGER REFERENCES sectors(id) ON DELETE RESTRICT,
  criado_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

-- Prova do manual: cadastrada junto com o manual e liberada quando o colaborador conclui 100% do conteúdo.
-- required = TRUE: ele precisa fazer a prova assim que concluir; FALSE: a prova aparece e pode ser feita depois.
-- Quem vê a prova são os setores do manual (manual_sectors), por isso sector_id fica nulo nela.
-- Excluir o manual exclui a prova, as entregas e as respostas (mesmo comportamento do progresso).
ALTER TABLE exams ADD COLUMN IF NOT EXISTS manual_id INTEGER REFERENCES manuals(id) ON DELETE CASCADE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS required BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE exams ALTER COLUMN ends_at DROP NOT NULL;
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_manual_sector_check;
ALTER TABLE exams ADD CONSTRAINT exams_manual_sector_check CHECK (manual_id IS NULL OR sector_id IS NULL);
-- Prova avulsa tem prazo final; prova de manual nunca expira e fica disponível até o colaborador fazer.
-- O UPDATE tira o prazo das provas de manual criadas antes desta regra.
UPDATE exams SET ends_at = NULL WHERE manual_id IS NOT NULL AND ends_at IS NOT NULL;
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_ends_at_required_check;
ALTER TABLE exams ADD CONSTRAINT exams_ends_at_required_check CHECK ((manual_id IS NULL) = (ends_at IS NOT NULL));
-- required só faz sentido na prova de manual.
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_required_manual_check;
ALTER TABLE exams ADD CONSTRAINT exams_required_manual_check CHECK (NOT required OR manual_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_exams_manual_id_unique ON exams(manual_id) WHERE manual_id IS NOT NULL;

-- Até 10 perguntas por prova: múltipla escolha (alternativas A a D) ou resposta aberta.
CREATE TABLE IF NOT EXISTS exam_questions (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 9),
  type VARCHAR(20) NOT NULL CHECK (type IN ('multipla_escolha', 'aberta')),
  prompt TEXT NOT NULL CHECK (BTRIM(prompt) <> ''),
  options JSONB,
  correct_option INTEGER,
  CHECK (
    (type = 'multipla_escolha' AND jsonb_typeof(options) = 'array' AND jsonb_array_length(options) = 4
      AND correct_option BETWEEN 0 AND 3)
    OR (type = 'aberta' AND options IS NULL AND correct_option IS NULL)
  ),
  UNIQUE (exam_id, position)
);

-- Uma entrega por colaborador e prova. A nota considera só as perguntas de múltipla escolha.
CREATE TABLE IF NOT EXISTS exam_submissions (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  objective_total INTEGER NOT NULL CHECK (objective_total BETWEEN 0 AND 10),
  objective_correct INTEGER NOT NULL CHECK (objective_correct BETWEEN 0 AND objective_total),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_id, user_id)
);

-- A prova começa ao clicar em "Iniciar prova" (status em_andamento). Termina enviada pelo colaborador
-- ou encerrada quando ele sai da página antes de enviar (entra com as respostas marcadas até ali).
ALTER TABLE exam_submissions ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'enviada';
ALTER TABLE exam_submissions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE exam_submissions ALTER COLUMN submitted_at DROP NOT NULL;
ALTER TABLE exam_submissions DROP CONSTRAINT IF EXISTS exam_submissions_status_check;
ALTER TABLE exam_submissions ADD CONSTRAINT exam_submissions_status_check
  CHECK (status IN ('em_andamento', 'enviada', 'encerrada'));

-- Modelos de prova: perguntas guardadas para reaplicar (ex.: colaborador novo). Cada modelo pertence a um setor
-- e só quem é desse setor o vê (admin e editor de conteúdo veem todos). Ao aplicar, as perguntas são copiadas
-- para exam_questions: editar ou excluir o modelo depois não altera provas e resultados já existentes.
CREATE TABLE IF NOT EXISTS exam_templates (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(180) NOT NULL CHECK (BTRIM(titulo) <> ''),
  descricao TEXT,
  sector_id INTEGER NOT NULL REFERENCES sectors(id) ON DELETE RESTRICT,
  criado_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mesmas regras de exam_questions (até 10, múltipla escolha A a D ou aberta).
CREATE TABLE IF NOT EXISTS exam_template_questions (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES exam_templates(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 9),
  type VARCHAR(20) NOT NULL CHECK (type IN ('multipla_escolha', 'aberta')),
  prompt TEXT NOT NULL CHECK (BTRIM(prompt) <> ''),
  options JSONB,
  correct_option INTEGER,
  CHECK (
    (type = 'multipla_escolha' AND jsonb_typeof(options) = 'array' AND jsonb_array_length(options) = 4
      AND correct_option BETWEEN 0 AND 3)
    OR (type = 'aberta' AND options IS NULL AND correct_option IS NULL)
  ),
  UNIQUE (template_id, position)
);

-- De qual modelo a prova saiu (nulo se foi criada do zero ou se o modelo foi excluído).
ALTER TABLE exams ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES exam_templates(id) ON DELETE SET NULL;

-- Prova aplicada a colaboradores específicos: com linhas aqui, só eles veem a prova; sem linhas, vale o setor.
CREATE TABLE IF NOT EXISTS exam_assignees (
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (exam_id, user_id)
);

CREATE TABLE IF NOT EXISTS exam_answers (
  submission_id INTEGER NOT NULL REFERENCES exam_submissions(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
  selected_option INTEGER CHECK (selected_option BETWEEN 0 AND 3),
  answer_text TEXT,
  PRIMARY KEY (submission_id, question_id)
);

-- Unidades (filiais / endereços) da empresa. Regra do produto: o setor é comum a todas as unidades e a unidade
-- é um segundo filtro. O colaborador vê o manual quando é de um dos setores do manual E de uma das unidades do
-- manual; manual sem nenhuma linha em manual_units vale para todas as unidades.
CREATE TABLE IF NOT EXISTS units (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL CHECK (BTRIM(nome) <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Nome único sem diferenciar maiúsculas ("Matriz" e "matriz" são a mesma unidade).
CREATE UNIQUE INDEX IF NOT EXISTS idx_units_nome_unique ON units (LOWER(nome));

-- Endereço completo da unidade (todos opcionais). CEP só com os 8 dígitos; UF com a sigla em maiúsculas.
ALTER TABLE units ADD COLUMN IF NOT EXISTS cep VARCHAR(8);
ALTER TABLE units ADD COLUMN IF NOT EXISTS logradouro VARCHAR(160);
ALTER TABLE units ADD COLUMN IF NOT EXISTS numero VARCHAR(20);
ALTER TABLE units ADD COLUMN IF NOT EXISTS complemento VARCHAR(80);
ALTER TABLE units ADD COLUMN IF NOT EXISTS bairro VARCHAR(80);
ALTER TABLE units ADD COLUMN IF NOT EXISTS cidade VARCHAR(80);
ALTER TABLE units ADD COLUMN IF NOT EXISTS uf CHAR(2);
ALTER TABLE units ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE units DROP CONSTRAINT IF EXISTS units_cep_check;
ALTER TABLE units ADD CONSTRAINT units_cep_check CHECK (cep IS NULL OR cep ~ '^[0-9]{8}$');
ALTER TABLE units DROP CONSTRAINT IF EXISTS units_uf_check;
ALTER TABLE units ADD CONSTRAINT units_uf_check CHECK (uf IS NULL OR uf ~ '^[A-Z]{2}$');

-- Unidades de cada usuário (uma ou mais). Admin e editor de conteúdo enxergam todas e não precisam de nenhuma.
CREATE TABLE IF NOT EXISTS user_units (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  PRIMARY KEY (user_id, unit_id)
);

-- Unidades em que o manual vale. Nenhuma linha = todas as unidades (conteúdo da rede inteira).
CREATE TABLE IF NOT EXISTS manual_units (
  manual_id INTEGER NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  PRIMARY KEY (manual_id, unit_id)
);

-- Prova avulsa (aplicada de um modelo) para uma unidade; nulo = todas as unidades.
-- A prova de manual segue as unidades do manual, por isso unit_id fica nulo nela.
ALTER TABLE exams ADD COLUMN IF NOT EXISTS unit_id INTEGER REFERENCES units(id) ON DELETE RESTRICT;
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_manual_unit_check;
ALTER TABLE exams ADD CONSTRAINT exams_manual_unit_check CHECK (manual_id IS NULL OR unit_id IS NULL);

-- Migração das instalações que ainda não tinham unidades: cria a 'Matriz' e coloca nela todos os usuários
-- que ainda não têm unidade. Só roda enquanto não existir nenhuma unidade, para não recolocar na Matriz quem
-- foi tirado dela depois. Os manuais existentes ficam sem linhas em manual_units, ou seja, para todas as unidades.
DO $$
DECLARE
  matriz_id INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM units) THEN
    INSERT INTO units (nome) VALUES ('Matriz') RETURNING id INTO matriz_id;
    INSERT INTO user_units (user_id, unit_id) SELECT id, matriz_id FROM users ON CONFLICT DO NOTHING;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80),
  entity_id VARCHAR(80),
  details JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(details) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Configurações gerais (ex.: aparência white label com cores e logos, chave 'branding').
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(60) PRIMARY KEY,
  value JSONB NOT NULL CHECK (jsonb_typeof(value) = 'object'),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manual_version_history (
  id BIGSERIAL PRIMARY KEY,
  manual_id INTEGER NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  titulo VARCHAR(180) NOT NULL,
  descricao TEXT,
  pdf_url TEXT,
  video_url TEXT,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (manual_id, version)
);

ALTER TABLE manual_version_history ALTER COLUMN pdf_url DROP NOT NULL;
ALTER TABLE manual_version_history ALTER COLUMN video_url DROP NOT NULL;

CREATE TABLE IF NOT EXISTS progress_version_history (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manual_id INTEGER NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permissions_user_id ON permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_manual_id ON permissions(manual_id);
CREATE INDEX IF NOT EXISTS idx_manuals_system_id ON manuals(system_id);
CREATE INDEX IF NOT EXISTS idx_manuals_sector_id ON manuals(sector_id);
CREATE INDEX IF NOT EXISTS idx_manuals_active ON manuals(active);
CREATE INDEX IF NOT EXISTS idx_user_sectors_sector_id ON user_sectors(sector_id);
CREATE INDEX IF NOT EXISTS idx_manual_sectors_sector_id ON manual_sectors(sector_id);
CREATE INDEX IF NOT EXISTS idx_manual_progress_manual_id ON manual_progress(manual_id);
CREATE INDEX IF NOT EXISTS idx_manual_progress_completed_at ON manual_progress(completed_at);
CREATE INDEX IF NOT EXISTS idx_exams_sector_period ON exams(sector_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_exam_submissions_user_id ON exam_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_templates_sector_id ON exam_templates(sector_id);
CREATE INDEX IF NOT EXISTS idx_exam_assignees_user_id ON exam_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_exams_template_id ON exams(template_id);
CREATE INDEX IF NOT EXISTS idx_user_units_unit_id ON user_units(unit_id);
CREATE INDEX IF NOT EXISTS idx_manual_units_unit_id ON manual_units(unit_id);
CREATE INDEX IF NOT EXISTS idx_exams_unit_id ON exams(unit_id) WHERE unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manual_version_history_manual_id ON manual_version_history(manual_id);
CREATE INDEX IF NOT EXISTS idx_progress_version_history_manual_id ON progress_version_history(manual_id);
-- Índices nas chaves estrangeiras para usuário/pergunta: aceleram a exclusão de usuário (ON DELETE CASCADE/SET NULL)
-- e as consultas por autor, sem varrer a tabela inteira.
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_manuals_criado_por ON manuals(criado_por);
CREATE INDEX IF NOT EXISTS idx_exams_criado_por ON exams(criado_por);
CREATE INDEX IF NOT EXISTS idx_exam_templates_criado_por ON exam_templates(criado_por);
CREATE INDEX IF NOT EXISTS idx_progress_version_history_user_id ON progress_version_history(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_answers_question_id ON exam_answers(question_id);

-- Acesso inicial: admin / admin123 (senha provisória: o sistema obriga a troca no primeiro login).
-- O admin padrão só é criado quando ainda não existe (por e-mail ou identificador). Reexecuções não alteram
-- nome, perfil nem senha de quem já existe.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@manual.local' OR identificador = 'admin') THEN
    INSERT INTO users (nome, email, identificador, senha, role, must_change_password)
    VALUES ('Suporte Admin', 'admin@manual.local', 'admin',
      '$2a$10$aEV41I/MA/qN00fWXu5UCuO/kPA0KT.DG5Br/zho02MdrowLgDIeC', 'admin', TRUE);
  END IF;
END $$;

-- Qualquer conta que ainda use a senha padrão admin123 é obrigada a trocá-la.
UPDATE users SET must_change_password = TRUE
WHERE senha = '$2a$10$aEV41I/MA/qN00fWXu5UCuO/kPA0KT.DG5Br/zho02MdrowLgDIeC' AND must_change_password = FALSE;

COMMIT;
