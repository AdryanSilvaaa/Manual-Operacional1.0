# Banco de dados

O projeto usa PostgreSQL. A definição oficial está em `backend/sql/schema.sql` e foi escrita para ser executada novamente sem recriar tabelas existentes.

## Relacionamentos

```text
sectors 1 --- N users
sectors 1 --- N manuals
systems 1 --- N manuals
users   1 --- N manuals (criado_por)
users   N --- N manuals (manual_progress)
manuals 1 --- N quiz_questions
users   N --- N manuals (quiz_attempts)
manuals 1 --- N manual_version_history
users   N --- N manuals (progress_version_history)
users   1 --- N audit_logs
```

## Tabelas

### `sectors`

Cadastro único de setores. O nome é exclusivo.

### `users`

Contém nome, identificador de login, hash bcrypt da senha, perfil e setor. Perfis válidos: `suporte`, `gerente_setor` e `usuario`.

### `systems`

Agrupadores funcionais dos manuais, com nome e resumo.

### `manuals`

Versão ativa do manual. Armazena metadados, URLs do PDF/vídeo, sistema, setor, autor, prazo, número da versão e situação ativa.

### `manual_progress`

Uma linha por usuário e manual. Guarda:

- páginas vistas, página atual e total de páginas;
- conclusão do PDF;
- maior percentual assistido do vídeo;
- tempo acumulado, primeiro e último acesso;
- data de conclusão integral.

### `quiz_questions`

Perguntas do manual. `options` é um array JSON e `correct_option` é o índice numérico da alternativa correta.

### `quiz_attempts`

Histórico de respostas, nota e aprovação. Não há limite de tentativas no modelo atual.

### `manual_version_history`

Snapshot dos metadados e arquivos da versão anterior antes de uma substituição de PDF ou vídeo.

### `progress_version_history`

Snapshot JSON do progresso dos operadores antes de o progresso da versão ativa ser reiniciado.

### `audit_logs`

Eventos de segurança e administração. Atualmente recebe login e troca de senha.

### `permissions`

Tabela de associação usuário/manual preservada no schema. A regra operacional corrente usa o setor; esta tabela ainda não é consultada pelos endpoints principais.

## Exclusões

- Excluir usuário remove seus progressos, tentativas e permissões.
- Excluir manual remove progressos, perguntas, tentativas e históricos relacionados.
- Excluir sistema preserva manuais, definindo `system_id` como nulo.
- Excluir setor é restringido quando existem manuais vinculados.
- O autor de um manual pode se tornar nulo se o usuário for excluído.

## Versionamento

Quando PDF ou vídeo é substituído pela API:

1. a versão atual é copiada para `manual_version_history`;
2. os progressos atuais são copiados para `progress_version_history`;
3. o progresso ativo é apagado;
4. a coluna `version` é incrementada;
5. operadores precisam concluir novamente o novo conteúdo.

## Backup

Um backup completo deve incluir o PostgreSQL e os arquivos. Se o armazenamento for local, copie também `backend/uploads`. Com Supabase, inclua o bucket configurado em `SUPABASE_BUCKET` na política de recuperação.

