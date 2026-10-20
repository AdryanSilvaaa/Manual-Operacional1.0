/**
 * Centraliza a conexão PostgreSQL usada por todos os models.
 * Alterar DATABASE_URL troca o banco; mudanças em query afetam toda consulta SQL.
 * O tamanho do pool e os tempos limite vêm do .env (DB_POOL_MAX, DB_STATEMENT_TIMEOUT_MS etc.).
 */
import pg from 'pg';

const { Pool } = pg;

// Valor vazio usa o padrão; 0 desliga o tempo limite (alguns poolers, como PgBouncer, recusam esses parâmetros).
const numberFromEnv = (name, fallback) => (process.env[name] === undefined || process.env[name] === '' ? fallback : Number(process.env[name]));
const optionalTimeout = (name, fallback) => numberFromEnv(name, fallback) || undefined;

// Cada instância do backend abre no máximo DB_POOL_MAX conexões. Com várias instâncias (Cloud Run),
// instâncias x DB_POOL_MAX precisa ficar abaixo do max_connections do PostgreSQL.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: numberFromEnv('DB_POOL_MAX', 10),
  idleTimeoutMillis: numberFromEnv('DB_IDLE_TIMEOUT_MS', 30000),
  connectionTimeoutMillis: numberFromEnv('DB_CONNECTION_TIMEOUT_MS', 5000),
  // Consulta travada não segura a conexão para sempre: o PostgreSQL cancela após este tempo.
  statement_timeout: optionalTimeout('DB_STATEMENT_TIMEOUT_MS', 15000),
  idle_in_transaction_session_timeout: optionalTimeout('DB_IDLE_TRANSACTION_TIMEOUT_MS', 15000),
  application_name: 'manual-operacional-api',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined
});

// Sem este listener, a queda de uma conexão ociosa (reinício do banco, rede) derruba o processo inteiro.
pool.on('error', (error) => {
  console.error('Conexão ociosa do PostgreSQL encerrada:', error.message);
});

export async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}

/** Executa operações dependentes na mesma transação e desfaz tudo em caso de erro. */
export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
