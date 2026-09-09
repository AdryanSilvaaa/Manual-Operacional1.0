# API de autenticação e sessão

Base: `/api/auth`.

## `POST /login`

Pública. Autentica por `identificador`; por compatibilidade, o e-mail legado também pode ser usado.

```json
{ "identificador": "admin", "senha": "admin123" }
```

Resposta `200`: `{ "token": "<jwt>", "user": { "id": 1, "nome": "Suporte Admin", "identificador": "admin", "role": "suporte" } }`. O JWT expira em 8 horas e contém `id`, `nome`, `role` e `sector_id`. Respostas: `400` para campos ausentes, `401` para credenciais inválidas e `429` após cinco falhas para a combinação IP/identificador; o bloqueio dura 15 minutos e fica apenas na memória do processo.

## `GET /me`

Autenticada. Retorna o usuário atual com `id`, `nome`, `identificador`, `email`, `role`, `sector_id`, `setor` e `created_at`. Pode responder `401` se o token estiver ausente, inválido ou expirado.

## `PUT /password`

Autenticada. Altera a senha do próprio usuário.

```json
{ "currentPassword": "admin123", "newPassword": "NovaSenha2026" }
```

A nova senha deve ter no mínimo 8 caracteres, uma letra e um número. Retorna `204`; usa `400` para senha atual incorreta ou nova senha fraca.

## `POST /register`

Exclusiva de `suporte` (e do perfil legado `gerente`). Cria usuário e cria/reutiliza o setor informado.

```json
{
  "nome": "Maria Silva",
  "identificador": "maria.silva",
  "senha": "Treino2026",
  "role": "usuario",
  "setor": "Operações"
}
```

`role` aceita `suporte`, `gerente_setor` ou `usuario`; se omitida, usa `usuario`. Retorna `201` sem expor o hash da senha. Campos obrigatórios inválidos retornam `400`; falta de permissão retorna `403`.
