# Referência da API

## Convenções

- URL local: `http://localhost:4000`.
- Endpoints autenticados exigem `Authorization: Bearer <token>`.
- JSON usa `Content-Type: application/json`.
- Upload de manuais usa `multipart/form-data`; o cliente não deve definir manualmente o boundary.
- Datas são strings ISO 8601.
- Exclusões bem-sucedidas retornam `204 No Content`.
- Erros normalmente retornam `{ "message": "descrição" }`.

## Perfis

| Código | Significado |
|---|---|
| `usuario` | Operador comum |
| `gerente_setor` | Gerente restrito ao setor |
| `suporte` | Administração global |

Na tabela abaixo, **Gerência** significa `gerente_setor` ou `suporte`; **Suporte** significa `suporte`.

## Autenticação

### `POST /api/auth/login`

Público. Autentica e retorna JWT com validade de oito horas.

```json
{
  "identificador": "admin",
  "senha": "admin123"
}
```

Resposta `200`:

```json
{
  "token": "eyJ...",
  "user": {
    "id": 1,
    "nome": "Suporte Admin",
    "identificador": "admin",
    "role": "suporte"
  }
}
```

Erros: `400` campos ausentes, `401` credenciais inválidas, `429` bloqueio após cinco falhas.

### `GET /api/auth/me`

Autenticado. Retorna o usuário atual, incluindo `sector_id` e `setor` quando disponíveis.

### `PUT /api/auth/password`

Autenticado. Troca a própria senha.

```json
{
  "currentPassword": "senha-atual",
  "newPassword": "NovaSenha2026"
}
```

A nova senha exige oito caracteres, uma letra e um número. Sucesso: `204`.

### `POST /api/auth/register`

Suporte. Cria usuário e cria/reutiliza o setor informado.

```json
{
  "nome": "Maria Operadora",
  "identificador": "maria.operadora",
  "senha": "Treino2026",
  "role": "usuario",
  "setor": "Faturamento"
}
```

Resposta: `201` com o usuário sem senha.

## Usuários

### `GET /api/users`

Suporte. Lista usuários com setor, perfil e datas.

### `PUT /api/users/{id}`

Suporte. Atualiza os campos administrativos.

```json
{
  "nome": "Maria Aparecida",
  "identificador": "maria",
  "role": "gerente_setor",
  "setor": "Faturamento"
}
```

Todos os campos acima são obrigatórios.

### `DELETE /api/users/{id}`

Suporte. Retorna `204`. A própria conta autenticada não pode ser excluída.

## Sistemas

### `GET /api/systems`

Qualquer usuário autenticado. Lista sistemas e `manuals_count`, considerando a visibilidade do perfil.

### `POST /api/systems`

Suporte.

```json
{
  "nome": "Sistema Hospitalar",
  "resumo": "Procedimentos do prontuário"
}
```

Resposta: `201`.

### `PUT /api/systems/{id}`

Suporte. Aceita `nome` e/ou `resumo`.

### `DELETE /api/systems/{id}`

Suporte. Retorna `204`. Manuais vinculados permanecem com `system_id` nulo.

## Setores

### `GET /api/sectors`

Gerência. Lista os setores em ordem alfabética.

### `POST /api/sectors`

Suporte.

```json
{
  "nome": "Recepção"
}
```

Cria ou reutiliza o setor pelo nome. Resposta: `201`.

## Manuais

### `GET /api/manuals`

Autenticado. Parâmetro opcional `systemId`:

```http
GET /api/manuals?systemId=3
```

Operadores e gerentes de setor recebem somente manuais ativos do próprio setor. Suporte possui visão global. Cada item pode incluir `progress_percent`, `first_access_at` e `completed_at` do usuário autenticado.

### `GET /api/manuals/{id}`

Autenticado. Retorna o manual quando o usuário possui acesso pelo setor ou perfil global.

### `POST /api/manuals`

Gerência. Requisição `multipart/form-data`:

| Campo | Tipo | Obrigatório | Observação |
|---|---|---:|---|
| `titulo` | texto | Sim | Até 180 caracteres no banco |
| `descricao` | texto | Não | Descrição livre |
| `systemId` | número | Sim | Sistema existente |
| `setor` | texto | Sim para suporte | Para gerente, o backend força seu próprio setor |
| `dueAt` | data ISO/local | Não | Prazo de conclusão |
| `pdf` | arquivo | Sim | `application/pdf` |
| `video` | arquivo | Sim | MP4, WebM ou QuickTime |
| `quiz` | JSON em texto | Não | Array de perguntas |

Exemplo do campo `quiz`:

```json
[
  {
    "prompt": "Qual é o primeiro passo?",
    "options": ["Abrir o sistema", "Encerrar", "Imprimir", "Ignorar"],
    "correctOption": 0
  }
]
```

Limite por arquivo: 500 MB. O backend neutraliza instruções conhecidas de impressão automática dentro de PDFs.

Exemplo com `curl`:

```bash
curl -X POST http://localhost:4000/api/manuals \
  -H "Authorization: Bearer TOKEN" \
  -F "titulo=Cadastro de paciente" \
  -F "systemId=1" \
  -F "setor=Recepção" \
  -F "dueAt=2026-09-01T18:00" \
  -F "pdf=@manual.pdf;type=application/pdf" \
  -F "video=@treinamento.mp4;type=video/mp4"
```

### `PUT /api/manuals/{id}`

Suporte. `multipart/form-data`. Aceita `titulo`, `descricao`, `systemId`, `setor`, `dueAt`, `active`, `pdf` e `video`.

Substituir PDF ou vídeo arquiva a versão e o progresso correntes, incrementa `version` e reinicia o progresso ativo dos operadores.

### `DELETE /api/manuals/{id}`

Suporte. Exclui o manual e dependências; retorna `204`.

## Progresso

### `GET /api/progress/{manualId}`

Autenticado. Retorna o progresso do usuário autenticado.

```json
{
  "user_id": 5,
  "manual_id": 9,
  "pdf_completed": false,
  "video_progress": 34.5,
  "total_seconds": 180,
  "page_count": 10,
  "last_page": 4,
  "pages_viewed": [1, 2, 3, 4],
  "first_access_at": "2026-08-13T12:00:00.000Z",
  "last_access_at": "2026-08-13T12:10:00.000Z",
  "completed_at": null
}
```

### `PUT /api/progress/{manualId}`

Autenticado. Atualização incremental enviada pelo leitor/player.

```json
{
  "page": 4,
  "pageCount": 10,
  "videoProgress": 34.5,
  "seconds": 30
}
```

Regras:

- `videoProgress` nunca diminui;
- `seconds` é limitado a 60 por requisição;
- páginas não são duplicadas;
- o PDF conclui somente com todas as páginas;
- o manual conclui com PDF, 90% do vídeo e aprovação no quiz quando houver.

### `GET /api/progress/report`

Gerência. Cruza operadores comuns com os manuais do setor. Gerente recebe o próprio setor; suporte recebe todos.

Campos principais: `user_id`, `user_name`, `sector_name`, `manual_id`, `manual_title`, `pdf_completed`, `video_progress`, `first_access_at`, `last_access_at`, `completed_at`, `total_seconds`, `page_count`, `pages_read`, `due_at` e `version`.

## Questionários

### `GET /api/quiz/{manualId}`

Autenticado. Retorna perguntas e alternativas sem expor `correct_option`.

```json
[
  {
    "id": 12,
    "prompt": "Qual é o primeiro passo?",
    "options": ["Abrir", "Fechar", "Imprimir", "Ignorar"],
    "position": 0
  }
]
```

### `POST /api/quiz/{manualId}/attempts`

Autenticado. As chaves de `answers` são IDs das perguntas e os valores são índices das alternativas.

```json
{
  "answers": {
    "12": 0,
    "13": 2
  }
}
```

Resposta:

```json
{
  "score": 100,
  "passed": true,
  "correct": 2,
  "total": 2
}
```

## Saúde e arquivos

### `GET /health`

Público. Verifica apenas se o processo HTTP está respondendo.

### `GET /uploads/{pasta}/{arquivo}`

Público quando o armazenamento local está ativo. Serve PDFs e vídeos salvos em `backend/uploads`.

## Códigos de resposta

| Código | Uso |
|---:|---|
| `200` | Consulta ou atualização bem-sucedida |
| `201` | Recurso criado |
| `204` | Operação sem corpo de resposta |
| `400` | Dados inválidos ou regra de negócio |
| `401` | Autenticação ausente/inválida |
| `403` | Perfil sem permissão |
| `404` | Recurso ou rota não encontrada |
| `429` | Excesso de tentativas de login |
| `500` | Erro interno ou infraestrutura |

