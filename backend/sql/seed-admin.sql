-- Senha inicial: admin123
-- Hash gerado com bcrypt. Troque a senha depois do primeiro acesso.
INSERT INTO users (nome, email, identificador, senha, role)
VALUES (
  'Gerente Admin',
  'admin@manual.local',
  'admin',
  '$2a$10$aEV41I/MA/qN00fWXu5UCuO/kPA0KT.DG5Br/zho02MdrowLgDIeC',
  'suporte'
)
ON CONFLICT (email) DO UPDATE
SET identificador = COALESCE(users.identificador, EXCLUDED.identificador);
