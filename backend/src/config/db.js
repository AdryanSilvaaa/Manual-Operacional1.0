/**
 * Centraliza a conexão PostgreSQL usada por todos os models.
 * Alterar DATABASE_URL troca o banco; mudanças em query afetam toda consulta SQL.
 */
import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
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
