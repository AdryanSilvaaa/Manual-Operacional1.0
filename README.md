# Manual Operacional Digital

Sistema web com React.js no frontend, Node.js + Express no backend e PostgreSQL.

## Documentação

Toda a documentação está em [`docs/`](docs/Indice-da-Documentacao.pdf), organizada em:

- [Geral](docs/Geral/Visao-Geral.pdf): visão do produto, regras de negócio, instalação e implantação no Google Cloud.
- [Front-end](docs/Front-end/Front-end.pdf): telas, rotas, perfis e componentes.
- [Back-end](docs/Back-end/Back-end.pdf): arquitetura da API e [referência dos endpoints](docs/Back-end/API/Referencia-da-API.pdf) com [OpenAPI](docs/Back-end/API/openapi.yaml).
- [Banco de Dados](docs/Banco%20de%20Dados/Banco-de-Dados.pdf): tabelas, relacionamentos, exclusões e versionamento.

## Recursos

- Login com JWT por identificador textual (não exige e-mail).
- Perfis: suporte (administração geral), gerente de setor e usuário comum (operador).
- Suporte cadastra sistemas, setores, usuários e manuais; gerente de setor publica manuais no próprio setor.
- Cada manual (PDF + vídeo) é vinculado a um sistema e a um setor.
- Usuários pertencem a setores e visualizam apenas os manuais do seu setor.
- Painel gerencial com conclusão por manual e detalhamento por operador.
- Progresso de vídeo registrado pelo tempo efetivamente assistido e confirmação de leitura do PDF.
- Leitor PDF paginado com retomada, páginas visitadas e conclusão real do documento.
- Provas por setor (múltipla escolha e resposta aberta) com aviso ao colaborador e aba Resultados de Provas no painel.
- Versões arquivadas e exportação CSV do painel.
- Troca de senha, bloqueio de tentativas de login e trilha de auditoria.
- URLs dos arquivos sao salvas no banco; arquivos ficam no Supabase Storage ou, em desenvolvimento, na pasta `backend/uploads`.

## Como rodar

### 1. Banco de dados

Crie o banco PostgreSQL e execute:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/sql/schema.sql
```

O `schema.sql` contém toda a estrutura, índices, migrações e o usuário inicial (não há arquivo de seed separado). Ele é transacional e pode ser executado novamente para atualizar uma instalação existente.

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

O plano de hospedagem (bucket privado, Cloud CDN e Cloud Run) está em [`docs/Geral/Implantacao-Google-Cloud.pdf`](docs/Geral/Implantacao-Google-Cloud.pdf).

`app.js` configura a API sem iniciar a porta, enquanto `server.js` fica responsável apenas pela inicialização do processo. No frontend, `AppRoutes.jsx` concentra as rotas e `ProtectedRoute.jsx` aplica autenticação e permissões.

Os estilos são carregados por `src/styles.css` e separados em `tokens.css`, `base.css`, `layout.css`, `components.css`, `pages.css` e `responsive.css`.
