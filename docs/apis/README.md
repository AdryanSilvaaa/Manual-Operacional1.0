# APIs por domínio

Referência modular da API HTTP do Manual Operacional Digital, conferida diretamente nas rotas, controladores, middlewares e modelos do backend.

## Convenções comuns

- URL local: `http://localhost:4000`.
- Corpo JSON: `Content-Type: application/json`.
- Rotas protegidas: `Authorization: Bearer <token>`.
- Erro padrão: `{ "message": "descrição" }`.
- Identificadores de rota são inteiros, embora o Express os receba inicialmente como texto.
- Datas são valores ISO 8601 produzidos pelo PostgreSQL.
- Resposta sem corpo usa HTTP `204`.

## Perfis

| Perfil | Capacidades principais |
|---|---|
| `suporte` | Administração completa de usuários, setores, sistemas e manuais |
| `gerente_setor` | Publicação de manual no próprio setor e acesso ao painel do setor |
| `usuario` | Consulta de conteúdo do próprio setor, progresso e questionários |
| `gerente` | Perfil legado ainda aceito em alguns middlewares e consultas |

## Arquivos

| Domínio | Base | Documento |
|---|---|---|
| Saúde | `/health` | [HEALTH.md](HEALTH.md) |
| Autenticação | `/api/auth` | [AUTH.md](AUTH.md) |
| Usuários | `/api/users` | [USERS.md](USERS.md) |
| Setores | `/api/sectors` | [SECTORS.md](SECTORS.md) |
| Sistemas | `/api/systems` | [SYSTEMS.md](SYSTEMS.md) |
| Manuais | `/api/manuals` | [MANUALS.md](MANUALS.md) |
| Progresso | `/api/progress` | [PROGRESS.md](PROGRESS.md) |
| Questionários | `/api/quiz` | [QUIZ.md](QUIZ.md) |

Consulte também a especificação executável [OpenAPI](../openapi.yaml) e a [referência consolidada](../API.md).
