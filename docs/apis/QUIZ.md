# API de questionários

Base: `/api/quiz`. Ambas as rotas exigem JWT e acesso ao manual.

## `GET /:manualId`

Lista perguntas por `position`. A resposta contém `id`, `prompt`, `options` e `position`; `correct_option` é deliberadamente omitido.

## `POST /:manualId/attempts`

Registra uma tentativa. `answers` é um objeto cujas chaves são IDs de pergunta e os valores são índices de alternativas.

```json
{ "answers": { "10": 1, "11": 0, "12": 2 } }
```

Resposta: `{ "score": 67, "passed": false, "correct": 2, "total": 3 }`. A nota é percentual inteiro e a aprovação exige pelo menos 70%. Todas as tentativas ficam armazenadas. Se não houver perguntas, o resultado é nota 100 e aprovado, sem inserir tentativa. Ao aprovar, a conclusão do manual é atualizada caso PDF e vídeo já cumpram os requisitos.

As perguntas são criadas ou substituídas como parte do cadastro de manual; não existe rota pública separada de administração de perguntas.
