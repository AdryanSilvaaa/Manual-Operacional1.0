/**
 * Aplica backend/sql/schema.sql no banco do DATABASE_URL (npm run db:migrate).
 * O schema é idempotente e transacional: pode rodar quantas vezes quiser; se algo falhar, nada é aplicado.
 * Rode sempre que atualizar o código (antes de subir o backend), inclusive no deploy do Google Cloud.
 * Dispensa o psql instalado na máquina.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const schemaPath = new URL('../sql/schema.sql', import.meta.url);

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não definido. Configure o backend/.env antes de rodar a migração.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined,
  application_name: 'manual-operacional-migrate'
});

try {
  const sql = await readFile(schemaPath, 'utf8');
  await client.connect();
  // Sem parâmetros, o pg envia o arquivo inteiro de uma vez (BEGIN ... COMMIT do próprio schema).
  await client.query(sql);
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'exams' AND column_name IN ('manual_id', 'required')`
  );
  console.log(`Schema aplicado com sucesso. Colunas de prova do manual presentes: ${rows.map((r) => r.column_name).sort().join(', ') || 'nenhuma'}.`);
} catch (error) {
  console.error('Falha ao aplicar o schema (nenhuma alteração foi gravada):', error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
