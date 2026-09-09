# API de setores

Base: `/api/sectors`.

## `GET /`

Exige JWT e perfil capaz de gerenciar manuais: `suporte`, `gerente_setor` ou legado `gerente`. Retorna `[{ "id": 1, "nome": "Geral" }]` em ordem alfabética.

## `POST /`

Exige `suporte` (ou legado `gerente`). Corpo: `{ "nome": "Operações" }`. Espaços externos são removidos. Se o nome já existir, o registro existente é devolvido; caso contrário, é criado. Retorna `201` ou `400` quando o nome estiver vazio.

Não há endpoints de alteração ou exclusão de setor na implementação atual.
