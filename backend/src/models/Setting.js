/**
 * Configurações gerais da aplicação guardadas no banco (tabela app_settings), uma linha por chave.
 * Hoje guarda a aparência (chave "branding"): cores e logos escolhidas pelo suporte.
 */
import { query } from '../config/db.js';

export async function getSetting(key) {
  const { rows } = await query('SELECT value, updated_at FROM app_settings WHERE key = $1', [key]);
  return rows[0] || null;
}

export async function saveSetting(key, value, userId) {
  const { rows } = await query(
    `INSERT INTO app_settings (key, value, updated_by) VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
     RETURNING value, updated_at`,
    [key, JSON.stringify(value), userId || null]
  );
  return rows[0];
}
