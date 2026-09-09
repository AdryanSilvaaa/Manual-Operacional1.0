# Dicionário das tabelas do banco de dados

Fonte de verdade: `backend/sql/schema.sql`. Banco: PostgreSQL. O script é transacional e reexecutável.

## Visão relacional

```text
sectors 1 ── N users
sectors 1 ── N manuals N ── 1 systems
users   1 ── N manuals (autoria)
users   N ── N manuals (permissions)
users   N ── N manuals (manual_progress)
manuals 1 ── N quiz_questions
users   N ── N manuals (quiz_attempts)
users   1 ── N audit_logs
manuals 1 ── N manual_version_history
users   N ── N manuals (progress_version_history)
```

## `sectors`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `SERIAL` | PK |
| `nome` | `VARCHAR(120)` | obrigatório, único |
| `created_at` | `TIMESTAMPTZ` | obrigatório, padrão `NOW()` |

Agrupa usuários e manuais. O schema garante o setor neutro `Geral`.

## `systems`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `SERIAL` | PK |
| `nome` | `VARCHAR(160)` | obrigatório |
| `resumo` | `TEXT` | opcional |
| `created_at` | `TIMESTAMPTZ` | padrão `NOW()` |
| `updated_at` | `TIMESTAMPTZ` | padrão `NOW()`, mantido pela aplicação |

Um sistema com manuais não pode ser removido (`RESTRICT`).

## `users`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `SERIAL` | PK |
| `nome` | `VARCHAR(120)` | obrigatório |
| `email` | `VARCHAR(160)` | opcional, único |
| `identificador` | `VARCHAR(160)` | obrigatório, índice único |
| `senha` | `TEXT` | hash bcrypt obrigatório |
| `role` | `VARCHAR(20)` | `suporte`, `gerente_setor` ou `usuario` |
| `sector_id` | `INTEGER` | FK `sectors.id`, `ON DELETE SET NULL` |
| `created_at` | `TIMESTAMPTZ` | padrão `NOW()` |

O seed interno cria/atualiza a conta inicial `admin`. O papel legado `gerente` é migrado para `suporte` no schema, embora o código ainda o reconheça em compatibilidade.

## `manuals`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `SERIAL` | PK |
| `titulo` | `VARCHAR(180)` | obrigatório |
| `descricao` | `TEXT` | opcional |
| `pdf_url` | `TEXT` | obrigatório |
| `video_url` | `TEXT` | obrigatório |
| `system_id` | `INTEGER` | FK `systems.id`, obrigatório, `RESTRICT` |
| `sector_id` | `INTEGER` | FK `sectors.id`, obrigatório, `RESTRICT` |
| `criado_por` | `INTEGER` | FK `users.id`, `SET NULL` |
| `version` | `INTEGER` | obrigatório, padrão 1 |
| `due_at` | `TIMESTAMPTZ` | prazo opcional |
| `active` | `BOOLEAN` | padrão verdadeiro |
| `created_at` | `TIMESTAMPTZ` | padrão `NOW()` |
| `updated_at` | `TIMESTAMPTZ` | padrão `NOW()` |

Índices: `system_id`, `sector_id` e `active`.

## `permissions`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `SERIAL` | PK |
| `user_id` | `INTEGER` | FK usuário, cascata |
| `manual_id` | `INTEGER` | FK manual, cascata |

Possui unicidade composta (`user_id`, `manual_id`) e índices individuais. A tabela existe no schema, mas a autorização atual usa o setor do usuário/manual e não consulta essas permissões.

## `manual_progress`

| Coluna | Tipo | Regras |
|---|---|---|
| `user_id` | `INTEGER` | PK composta, FK usuário, cascata |
| `manual_id` | `INTEGER` | PK composta, FK manual, cascata |
| `pdf_completed` | `BOOLEAN` | padrão falso |
| `video_progress` | `NUMERIC(5,2)` | 0 a 100 |
| `total_seconds` | `INTEGER` | não negativo |
| `page_count` | `INTEGER` | não negativo |
| `last_page` | `INTEGER` | não negativo |
| `pages_viewed` | `INTEGER[]` | padrão array vazio |
| `first_access_at` | `TIMESTAMPTZ` | padrão `NOW()` |
| `last_access_at` | `TIMESTAMPTZ` | padrão `NOW()` |
| `completed_at` | `TIMESTAMPTZ` | opcional |

Índices adicionais em `manual_id` e `completed_at`.

## `quiz_questions`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `SERIAL` | PK |
| `manual_id` | `INTEGER` | FK manual, cascata |
| `prompt` | `TEXT` | obrigatório e não vazio |
| `options` | `JSONB` | array com pelo menos 2 itens |
| `correct_option` | `INTEGER` | índice válido dentro de `options` |
| `position` | `INTEGER` | não negativo, padrão 0 |

Unicidade (`manual_id`, `position`) e índice em `manual_id`.

## `quiz_attempts`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `SERIAL` | PK |
| `user_id` | `INTEGER` | FK usuário, cascata |
| `manual_id` | `INTEGER` | FK manual, cascata |
| `score` | `INTEGER` | 0 a 100 |
| `passed` | `BOOLEAN` | obrigatório |
| `answers` | `JSONB` | array ou objeto |
| `created_at` | `TIMESTAMPTZ` | padrão `NOW()` |

Índice composto em (`user_id`, `manual_id`).

## `audit_logs`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `BIGSERIAL` | PK |
| `user_id` | `INTEGER` | FK usuário, `SET NULL` |
| `action` | `VARCHAR(80)` | obrigatório |
| `entity_type` | `VARCHAR(80)` | opcional |
| `entity_id` | `VARCHAR(80)` | opcional |
| `details` | `JSONB` | objeto, padrão `{}` |
| `created_at` | `TIMESTAMPTZ` | padrão `NOW()` |

Índice decrescente em `created_at`. Atualmente registra login e troca de senha.

## `manual_version_history`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `BIGSERIAL` | PK |
| `manual_id` | `INTEGER` | FK manual, cascata |
| `version` | `INTEGER` | maior que zero |
| `titulo`, `descricao` | texto | snapshot descritivo |
| `pdf_url`, `video_url` | `TEXT` | URLs da versão arquivada |
| `archived_at` | `TIMESTAMPTZ` | padrão `NOW()` |

Unicidade (`manual_id`, `version`) e índice em `manual_id`.

## `progress_version_history`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `BIGSERIAL` | PK |
| `user_id` | `INTEGER` | FK usuário, cascata |
| `manual_id` | `INTEGER` | FK manual, cascata |
| `version` | `INTEGER` | maior que zero |
| `snapshot` | `JSONB` | objeto com progresso arquivado |
| `archived_at` | `TIMESTAMPTZ` | padrão `NOW()` |

Índice em `manual_id`. Antes de uma troca de mídia, a aplicação copia o progresso corrente para esta tabela e limpa `manual_progress`.

## Regras de exclusão resumidas

| Registro excluído | Efeito |
|---|---|
| Usuário | setor vira nulo; autoria/auditoria viram nulas; permissões, progresso, tentativas e histórico de progresso são removidos |
| Manual | dados dependentes são removidos em cascata |
| Sistema | bloqueado enquanto houver manuais |
| Setor | bloqueado enquanto houver manuais; nos usuários, a referência pode virar nula |

## Observações operacionais

- `updated_at` não possui trigger; é atualizado pelos models da aplicação.
- URLs de mídia ficam no banco, mas os bytes ficam no Supabase ou em `backend/uploads`.
- O schema não remove objetos do storage quando registros são apagados.
- A tabela `permissions` é atualmente estrutural/legada e não participa da regra de visibilidade.
