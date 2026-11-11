# Perfis de acesso do Prumo

Regra do produto (vale para qualquer cliente). Atualizado em 11/11/2026.

## Perfis

| Perfil | Valor em `users.role` | Setores | Resumo |
|---|---|---|---|
| Admin | `admin` | Opcional (vê todos) | Acesso total, inclusive aparência e usuários Admin. |
| Administrador de cadastros | `admin_cadastros` | Obrigatório | Cria e altera usuários, setores e sistemas. No resto é um colaborador comum: lê os manuais do seu setor e faz provas. Não vê painel nem resultados. Não cria, altera nem exclui Admin. |
| Editor de conteúdo | `editor_conteudo` | Opcional (vê todos) | Publica manuais e provas e acompanha o painel em todos os setores. Sem cadastros. |
| Gestor de área | `gestor_area` | Obrigatório (um ou vários) | Acompanha o painel e os resultados de provas dos seus setores. Não publica. |
| Gerente de setor | `gerente_setor` | Obrigatório | Publica manuais e provas e acompanha o painel nos seus setores. |
| Usuário comum | `usuario` | Obrigatório | Lê os manuais dos seus setores e faz provas. |

O antigo perfil `suporte` (e o legado `gerente`) virou `admin` na migração.

## Matriz de permissões

| Permissão | Admin | Adm. cadastros | Editor | Gestor de área | Gerente de setor | Usuário |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Cadastrar usuários (`manage_users`) | ✓ | ✓ | | | | |
| Cadastrar/alterar usuários Admin (`manage_admins`) | ✓ | | | | | |
| Cadastrar setores (`manage_sectors`) | ✓ | ✓ | | | | |
| Cadastrar unidades (`manage_units`) | ✓ | ✓ | | | | |
| Cadastrar sistemas (`manage_systems`) | ✓ | ✓ | | | | |
| Aparência (`manage_branding`) | ✓ | | | | | |
| Publicar manuais e provas (`publish_content`) | ✓ | | ✓ | | ✓ (seus setores) | |
| Aplicar prova a todos os setores (`apply_exam_all_sectors`) | ✓ | | | | | |
| Painel de uso e resultados (`view_reports`) | ✓ | | ✓ | ✓ (seus setores) | ✓ (seus setores) | |
| Enxergar todos os setores (`all_sectors`) | ✓ | | ✓ | | | |
| Enxergar todas as unidades (`all_units`) | ✓ | | ✓ | | | |
| Fazer provas (`take_exams`) | | ✓ | | | | ✓ |

Regras extras:
- Ninguém altera o próprio perfil (evita alguém aumentar o próprio acesso ou o Admin se trancar para fora).
- A troca de perfil fica registrada em `audit_logs` (`user_role_changed`).
- Unidades (filiais): ver [Unidades.md](Unidades.md). Quem não tem `all_units` só vê e acompanha o que é das suas unidades.
- Perfil, setores e unidades são lidos do banco a cada requisição: mudar o perfil de alguém vale na hora, sem novo login, e um usuário excluído perde o acesso mesmo com o token ainda válido.

## Onde fica no código

- Backend: `backend/src/utils/access.js` (`ROLES`, `PERMISSIONS`, `ROLE_PERMISSIONS`, `can`). As rotas usam `requirePermission(...)` de `backend/src/middleware/auth.js`.
- Frontend: `frontend/src/constants/roles.js` (espelho da matriz; só esconde telas e botões, quem garante o acesso é o backend).
- Banco: restrição `users_role_check` em `backend/sql/schema.sql`. `users.role` é `VARCHAR(20)`.

## Como criar um perfil novo

1. Acrescente o perfil em `ROLES`, `ROLE_PERMISSIONS` e `ROLE_LABELS` de `backend/src/utils/access.js`.
2. Faça o mesmo em `frontend/src/constants/roles.js` (e a descrição em `ROLE_DESCRIPTIONS`).
3. Inclua o valor na restrição `users_role_check` do `schema.sql` e rode `npm run db:migrate`.
4. Se a planilha de importação deve aceitar o nome, inclua os apelidos em `IMPORT_ROLES` (`backend/src/controllers/userController.js`).
5. Rode `npm test` no backend (o teste confere a lista de perfis).
