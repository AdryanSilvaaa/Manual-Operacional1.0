# API de manuais e uploads

Base: `/api/manuals`. PDF e vídeo podem ficar no Supabase Storage ou em `/uploads` no modo local.

## `GET /`

Autenticada. Filtro opcional: `?systemId=3`. `suporte` enxerga todos os manuais; demais perfis veem somente manuais ativos do próprio setor. A resposta inclui dados do manual, autor, acesso/conclusão do usuário e `progress_percent`, calculado como 50% da cobertura das páginas + 50% do progresso do vídeo.

## `GET /:id`

Autenticada. Retorna um manual permitido ao usuário. Usa `404` tanto para inexistência quanto para ausência de acesso, evitando revelar conteúdo de outro setor.

## `POST /`

Exige `suporte` ou `gerente_setor`. Requisição `multipart/form-data`:

| Campo | Tipo | Regra |
|---|---|---|
| `titulo` | texto | obrigatório |
| `descricao` | texto | opcional |
| `systemId` | inteiro | obrigatório |
| `setor` | texto | obrigatório para suporte; gerente sempre usa seu próprio setor |
| `dueAt` | data ISO | opcional |
| `pdf` | arquivo | obrigatório, `application/pdf` |
| `video` | arquivo | obrigatório, MP4, WebM ou QuickTime |
| `quiz` | JSON em texto | opcional; array de perguntas |

Cada arquivo tem limite de 500 MiB. Uma pergunta usa `{ "prompt": "...", "options": ["A", "B"], "correctOption": 0 }`. Retorna `201`; entrada/arquivos inválidos retornam `400` ou erro de upload.

## `PUT /:id`

Exige `suporte`. Também usa `multipart/form-data`; todos os campos são opcionais: `titulo`, `descricao`, `systemId`, `setor`, `dueAt`, `active`, `pdf` e `video`. `active` é interpretado como verdadeiro somente quando seu texto é `true`. Ao trocar PDF ou vídeo, a versão atual e os progressos são arquivados, o progresso corrente é reiniciado e `version` é incrementada. Retorna `200` ou `404`.

## `DELETE /:id`

Exige `suporte`; retorna `204`. A exclusão remove em cascata permissões, progresso, perguntas, tentativas e históricos relacionados. Os objetos já enviados ao storage não são apagados por essa rota.

## Arquivos locais

Quando Supabase não está configurado, os uploads são servidos por `GET /uploads/<pasta>/<arquivo>`. PDFs passam por uma sanitização pontual que neutraliza chamadas conhecidas de impressão automática; os demais bytes são preservados.
