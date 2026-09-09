# API de progresso e painel

Base: `/api/progress`.

## `GET /:manualId`

Autenticada e sujeita à visibilidade do manual. Retorna o progresso do usuário atual. Se ainda não existe registro, devolve valores iniciais (`pdf_completed: false`, vídeo/segundos/páginas em zero e `pages_viewed: []`).

## `PUT /:manualId`

Autenticada. Corpo:

```json
{
  "pdfCompleted": false,
  "videoProgress": 72.5,
  "seconds": 15,
  "page": 4,
  "pageCount": 12
}
```

A atualização é cumulativa: páginas já vistas não somem, percentuais não diminuem e `seconds` aceita no máximo 60 por chamada. `videoProgress` é limitado a 0–100. O PDF conclui quando todas as páginas foram registradas (ou por confirmação explícita). O manual conclui quando PDF está completo, vídeo alcança 90% e, se existir questionário, há uma tentativa aprovada.

## `GET /report`

Exige `suporte` ou `gerente_setor`. Retorna uma linha por combinação operador/manual com usuário, setor, manual, versão, prazo, páginas, vídeo, segundos e datas de acesso/conclusão. `gerente_setor` recebe apenas seu setor; `suporte` recebe todos. É a fonte do painel e da exportação CSV feita pelo frontend.
