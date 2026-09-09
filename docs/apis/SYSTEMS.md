# API de sistemas

Base: `/api/systems`. “Sistema” é o agrupador funcional de manuais.

## `GET /`

Qualquer usuário autenticado. Retorna sistemas em ordem alfabética com `id`, `nome`, `resumo`, datas e `manuals_count`. Para `suporte`, a contagem inclui todos os manuais; para os demais, somente manuais ativos do próprio setor.

## `POST /`

Exige `suporte`. Corpo: `{ "nome": "ERP", "resumo": "Rotinas do ERP" }`. `nome` é obrigatório. Retorna o registro com `201`.

## `PUT /:id`

Exige `suporte`. Corpo parcial com `nome` e/ou `resumo`; valores omitidos são preservados e `updated_at` é renovado. Retorna `200` ou `404`.

## `DELETE /:id`

Exige `suporte`. Retorna `204`. Se houver manual vinculado, a chave estrangeira `ON DELETE RESTRICT` impede a exclusão e a API retorna `409`.
