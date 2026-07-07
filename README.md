# Manual Operacional Digital

Sistema web com React.js no frontend, Node.js + Express no backend e PostgreSQL.

## Recursos

- Login com JWT.
- Perfil gerente e usuario comum.
- Gerente cadastra usuarios e manuais com upload de PDF e video.
- Usuarios visualizam apenas manuais liberados para eles.
- URLs dos arquivos sao salvas no banco; arquivos ficam no Supabase Storage ou, em desenvolvimento, na pasta `backend/uploads`.

## Como rodar

### 1. Banco de dados

Crie o banco PostgreSQL e execute:

```bash
psql "$DATABASE_URL" -f backend/sql/schema.sql
psql "$DATABASE_URL" -f backend/sql/seed-admin.sql
```

Usuario inicial:

- Email: `admin@manual.local`
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
  src/components
  src/context
  src/pages
backend/
  src/config
  src/controllers
  src/middleware
  src/models
  src/routes
  sql/
```
