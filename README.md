# Manual Operacional Digital

Sistema web com React.js no frontend, Node.js + Express no backend e PostgreSQL.

## Documentação

- [Índice da documentação](docs/README.md)
- [Visão geral do projeto](docs/PROJETO.md)
- [Instalação e operação](docs/INSTALACAO-E-OPERACAO.md)
- [Referência da API](docs/API.md)
- [Especificação OpenAPI](docs/openapi.yaml)
- [Banco de dados](docs/BANCO-DE-DADOS.md)

## Recursos

- Login com JWT por identificador textual (não exige e-mail).
- Perfil gerente e usuario comum.
- Gerente cadastra sistemas, usuarios e manuais com upload de PDF e video.
- Gerente vincula cada manual a um sistema.
- Usuários pertencem a setores e visualizam apenas os manuais do seu setor.
- Painel gerencial com conclusão por manual e detalhamento por operador.
- Progresso de vídeo registrado pelo tempo efetivamente assistido e confirmação de leitura do PDF.
- Leitor PDF paginado com retomada, páginas visitadas e conclusão real do documento.
- Prazos, versões arquivadas, questionários com nota mínima e exportação CSV do painel.
- Troca de senha, bloqueio de tentativas de login e trilha de auditoria.
- URLs dos arquivos sao salvas no banco; arquivos ficam no Supabase Storage ou, em desenvolvimento, na pasta `backend/uploads`.

## Como rodar

### 1. Banco de dados

Crie o banco PostgreSQL e execute:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/sql/schema.sql
```

O `schema.sql` contém toda a estrutura, índices, migrações e o usuário inicial. Ele é transacional e pode ser executado novamente para atualizar uma instalação existente.

Usuario inicial:

- Usuário: `admin` (o e-mail legado `admin@manual.local` também funciona)
- Senha: `admin123`

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Configure no `.env`:

- `DATABASE_URL`
- `JWT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_BUCKET`

Se as variaveis do Supabase ficarem vazias, os uploads serao salvos localmente em `backend/uploads`.

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Acesse `http://localhost:5173`.

## Estrutura

```text
frontend/
  src/AppRoutes.jsx
  src/components
  src/constants
  src/context
  src/pages
  src/styles
  src/utils
backend/
  src/app.js
  src/server.js
  src/config
  src/controllers
  src/middleware
  src/models
  src/routes
  sql/
```

## Implantação no Google Cloud

O roteiro para armazenar PDFs e vídeos em um bucket privado, distribuir pelo Cloud CDN e preparar uploads diretos está em [`docs/ARMAZENAMENTO_GOOGLE_CLOUD.md`](docs/ARMAZENAMENTO_GOOGLE_CLOUD.md).

`app.js` configura a API sem iniciar a porta, enquanto `server.js` fica responsável apenas pela inicialização do processo. No frontend, `AppRoutes.jsx` concentra as rotas e `ProtectedRoute.jsx` aplica autenticação e permissões.

Os estilos são carregados por `src/styles.css` e separados em `tokens.css`, `base.css`, `layout.css`, `components.css`, `pages.css` e `responsive.css`.
