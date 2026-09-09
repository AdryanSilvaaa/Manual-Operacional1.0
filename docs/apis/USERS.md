# API de usuários

Base: `/api/users`. Todas as rotas exigem JWT e perfil `suporte` (ou legado `gerente`).

## `GET /`

Lista usuários em ordem alfabética. Cada item contém `id`, `nome`, `identificador`, `email`, `role`, `sector_id`, `setor` e `created_at`. A senha nunca é retornada.

## `PUT /:id`

Atualiza integralmente os campos administrativos aceitos.

```json
{
  "nome": "Maria Silva",
  "identificador": "maria.silva",
  "role": "gerente_setor",
  "setor": "Operações"
}
```

Todos os quatro campos são obrigatórios. O setor é criado ou reutilizado pelo nome. Retorna `200`, `400` para entrada inválida ou `404` quando o usuário não existe.

## `DELETE /:id`

Exclui o usuário e retorna `204`. Não é permitido excluir a própria conta autenticada (`400`). Pela integridade do banco, permissões, progresso e tentativas de quiz são removidos em cascata; autoria e auditoria mantêm os registros com `user_id`/`criado_por` nulo.
