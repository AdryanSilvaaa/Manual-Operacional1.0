# Banco de Dados - Referência Detalhada

## Visão geral

O Manual Operacional Digital usa PostgreSQL. O arquivo `backend/sql/schema.sql` é a fonte oficial da estrutura e pode ser executado novamente para aplicar alterações idempotentes. A aplicação acessa o banco por meio do pacote `pg`, com consultas parametrizadas nos arquivos de `backend/src/models`.

## Mapa de relacionamentos

```text
sectors 1 ---- N users
sectors 1 ---- N manuals
systems 1 ---- N manuals
users   1 ---- N manuals (autoria)
users   N ---- N manuals (manual_progress)
manuals 1 ---- N quiz_questions
users   N ---- N manuals (quiz_attempts)
manuals 1 ---- N manual_version_history
users   N ---- N manuals (progress_version_history)
users   1 ---- N audit_logs
```

## 1. Tabela `sectors`

Representa os setores da organização. O setor é a principal fronteira de autorização dos operadores e gerentes.

| Coluna | Tipo | Regra | Finalidade |
|---|---|---|---|
| `id` | SERIAL | PK | Identificador do setor |
| `nome` | VARCHAR(120) | NOT NULL, UNIQUE | Nome exibido e usado nos cadastros |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Data de criação |

É utilizada por `users.sector_id` e `manuals.sector_id`. `findOrCreateSector` insere ou reutiliza um setor pelo nome. Um setor com manuais vinculados não pode ser excluído devido ao `ON DELETE RESTRICT` de `manuals`.

## 2. Tabela `users`

Armazena contas, credenciais, perfil e setor.

| Coluna | Tipo | Regra | Finalidade |
|---|---|---|---|
| `id` | SERIAL | PK | Identificador do usuário |
| `nome` | VARCHAR(120) | NOT NULL | Nome de exibição |
| `email` | VARCHAR(160) | UNIQUE, opcional | Compatibilidade com logins antigos |
| `identificador` | VARCHAR(160) | UNIQUE parcial | Nome usado no login |
| `senha` | TEXT | NOT NULL | Hash bcrypt, nunca senha em texto puro |
| `role` | VARCHAR(20) | CHECK | `suporte`, `gerente_setor` ou `usuario` |
| `sector_id` | INTEGER | FK, SET NULL | Setor que governa a visibilidade |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Data de cadastro |

O login pesquisa por `identificador` ou `email`. A API nunca deve devolver `senha`. Excluir um usuário remove seus progressos, tentativas e permissões; a autoria de manuais passa para nulo. A aplicação impede a exclusão da própria conta autenticada.

## 3. Tabela `systems`

Agrupa manuais por sistema ou contexto operacional.

| Coluna | Tipo | Regra | Finalidade |
|---|---|---|---|
| `id` | SERIAL | PK | Identificador |
| `nome` | VARCHAR(160) | NOT NULL | Nome do sistema |
| `resumo` | TEXT | opcional | Descrição curta |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Criação |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Última alteração |

A listagem calcula `manuals_count` conforme a visibilidade do usuário. Excluir o sistema mantém os manuais e define `manuals.system_id` como nulo.

## 4. Tabela `manuals`

Contém a versão ativa de cada treinamento.

| Coluna | Tipo | Regra | Finalidade |
|---|---|---|---|
| `id` | SERIAL | PK | Identificador |
| `titulo` | VARCHAR(180) | NOT NULL | Título do card e do leitor |
| `descricao` | TEXT | opcional | Explicação do conteúdo |
| `pdf_url` | TEXT | NOT NULL | URL local ou pública do PDF |
| `video_url` | TEXT | NOT NULL | URL local ou pública do vídeo |
| `system_id` | INTEGER | FK, SET NULL | Sistema agrupador |
| `sector_id` | INTEGER | FK, RESTRICT | Setor autorizado |
| `criado_por` | INTEGER | FK, SET NULL | Autor administrativo |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Publicação inicial |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Última alteração |
| `version` | INTEGER | DEFAULT 1 | Versão ativa |
| `due_at` | TIMESTAMP | opcional | Prazo de conclusão |
| `active` | BOOLEAN | DEFAULT TRUE | Disponibilidade para operadores |

Operadores e gerentes de setor leem apenas manuais ativos do próprio setor. Suporte possui visão global. Substituir PDF ou vídeo incrementa `version`, arquiva a versão anterior e reinicia o progresso ativo.

## 5. Tabela `manual_progress`

É a tabela central do acompanhamento. A chave primária composta garante apenas um progresso ativo por usuário e manual.

| Coluna | Tipo | Regra | Finalidade |
|---|---|---|---|
| `user_id` | INTEGER | PK, FK, CASCADE | Operador |
| `manual_id` | INTEGER | PK, FK, CASCADE | Manual |
| `pdf_completed` | BOOLEAN | DEFAULT FALSE | Todas as páginas foram visitadas |
| `video_progress` | NUMERIC(5,2) | 0 a 100 | Maior percentual assistido |
| `total_seconds` | INTEGER | DEFAULT 0 | Tempo acumulado de tela ativa |
| `first_access_at` | TIMESTAMP | DEFAULT NOW() | Primeiro acesso |
| `last_access_at` | TIMESTAMP | atualizado | Última interação |
| `completed_at` | TIMESTAMP | opcional | Conclusão integral |
| `page_count` | INTEGER | DEFAULT 0 | Quantidade de páginas |
| `last_page` | INTEGER | DEFAULT 0 | Maior página alcançada |
| `pages_viewed` | INTEGER[] | DEFAULT `{}` | Conjunto ordenado de páginas vistas |

O `UPSERT` combina páginas sem duplicação, nunca reduz o vídeo e limita segundos por requisição. `completed_at` é preenchido quando o PDF terminou, o vídeo chegou a 90% e o questionário, se existir, foi aprovado.

## 6. Tabela `quiz_questions`

| Coluna | Tipo | Regra | Finalidade |
|---|---|---|---|
| `id` | SERIAL | PK | Identificador da pergunta |
| `manual_id` | INTEGER | FK, CASCADE | Manual do questionário |
| `prompt` | TEXT | NOT NULL | Enunciado |
| `options` | JSONB | NOT NULL | Array de alternativas |
| `correct_option` | INTEGER | NOT NULL | Índice zero-based da correta |
| `position` | INTEGER | DEFAULT 0 | Ordem de apresentação |

A rota de consulta omite `correct_option`. Ao publicar perguntas, a aplicação substitui todas as perguntas anteriores do manual.

## 7. Tabela `quiz_attempts`

| Coluna | Tipo | Regra | Finalidade |
|---|---|---|---|
| `id` | SERIAL | PK | Tentativa |
| `user_id` | INTEGER | FK, CASCADE | Operador |
| `manual_id` | INTEGER | FK, CASCADE | Manual |
| `score` | INTEGER | NOT NULL | Nota percentual |
| `passed` | BOOLEAN | NOT NULL | Nota igual ou superior a 70% |
| `answers` | JSONB | NOT NULL | Mapa pergunta/alternativa |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Data da tentativa |

Todas as tentativas são preservadas. A conclusão procura qualquer tentativa aprovada do usuário para o manual.

## 8. Tabela `audit_logs`

| Coluna | Tipo | Regra | Finalidade |
|---|---|---|---|
| `id` | BIGSERIAL | PK | Evento |
| `user_id` | INTEGER | FK, SET NULL | Autor, se conhecido |
| `action` | VARCHAR(80) | NOT NULL | Código do evento |
| `entity_type` | VARCHAR(80) | opcional | Tipo da entidade |
| `entity_id` | VARCHAR(80) | opcional | Identificador flexível |
| `details` | JSONB | DEFAULT `{}` | Metadados adicionais |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Data do evento |

Atualmente registra `login` e `password_changed`. O índice por data favorece auditorias recentes.

## 9. Tabela `manual_version_history`

| Coluna | Tipo | Regra | Finalidade |
|---|---|---|---|
| `id` | BIGSERIAL | PK | Snapshot |
| `manual_id` | INTEGER | FK, CASCADE | Manual lógico |
| `version` | INTEGER | UNIQUE com manual | Número arquivado |
| `titulo` | VARCHAR(180) | NOT NULL | Título daquela versão |
| `descricao` | TEXT | opcional | Descrição daquela versão |
| `pdf_url` | TEXT | NOT NULL | PDF antigo |
| `video_url` | TEXT | NOT NULL | Vídeo antigo |
| `archived_at` | TIMESTAMP | DEFAULT NOW() | Arquivamento |

Evita duplicar a mesma versão por meio da restrição `UNIQUE (manual_id, version)`.

## 10. Tabela `progress_version_history`

| Coluna | Tipo | Regra | Finalidade |
|---|---|---|---|
| `id` | BIGSERIAL | PK | Snapshot |
| `user_id` | INTEGER | FK, CASCADE | Operador |
| `manual_id` | INTEGER | FK, CASCADE | Manual |
| `version` | INTEGER | NOT NULL | Versão concluída/iniciada |
| `snapshot` | JSONB | NOT NULL | Cópia integral do progresso |
| `archived_at` | TIMESTAMP | DEFAULT NOW() | Arquivamento |

Preserva evidências de versões anteriores antes que `manual_progress` seja reiniciado.

## 11. Tabela `permissions`

| Coluna | Tipo | Regra | Finalidade |
|---|---|---|---|
| `id` | SERIAL | PK | Associação |
| `user_id` | INTEGER | FK, CASCADE | Usuário |
| `manual_id` | INTEGER | FK, CASCADE | Manual |

A combinação usuário/manual é única. A tabela está preparada para permissões individuais, mas as rotas atuais autorizam principalmente pelo setor.

## 12. Setor `Geral` e migrações

O schema cria o setor `Geral` para acomodar registros antigos sem setor. Também migra o perfil legado `gerente` para `suporte`, preenche `identificador` com o e-mail legado e cria índices de pesquisa e chaves estrangeiras ausentes.

## Índices e desempenho

Existem índices para identificador de usuário, setores de usuários/manuais, sistema de manual, progresso por manual, conclusão, permissões e auditoria por data. Em bases grandes, recomenda-se analisar índices adicionais em `manual_progress(last_access_at)` e `quiz_attempts(user_id, manual_id, passed)`.

## Backup e recuperação

O backup precisa reunir banco e arquivos. Com armazenamento local, copie `backend/uploads`. Com Supabase, inclua o bucket. Antes de restaurar, mantenha as URLs dos arquivos compatíveis com o ambiente restaurado.

