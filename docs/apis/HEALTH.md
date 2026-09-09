# API de saúde

## `GET /health`

Verifica se o processo HTTP está respondendo. Não consulta o banco e não exige autenticação.

Resposta `200`:

```json
{
  "status": "ok",
  "service": "Manual Operacional Digital API"
}
```

Esse endpoint confirma apenas a disponibilidade do Express; ele não garante conexão com PostgreSQL ou Supabase.
