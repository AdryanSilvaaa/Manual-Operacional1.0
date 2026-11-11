/**
 * Consultas dos sistemas e contagem de manuais visíveis por perfil/setor.
 * Alterar filtros desta camada afeta a visibilidade exibida no frontend.
 */
import { query } from '../config/db.js';
import { seesAllSectors, seesAllUnits } from '../utils/access.js';
import { manualInUnits } from '../utils/unitSql.js';

// Retorna todos os sistemas; apenas a quantidade de manuais considera os setores e as unidades do usuário.
export async function listSystemsForUser(user) {
  const { rows } = await query(
    `SELECT s.*, COUNT(m.id) FILTER (WHERE ($1::boolean OR (m.active = TRUE AND EXISTS (
       SELECT 1 FROM manual_sectors ms WHERE ms.manual_id = m.id AND ms.sector_id = ANY($2::int[])
     ))) AND ($3::boolean OR (m.active = TRUE AND ${manualInUnits('$4')})))::int AS manuals_count
     FROM systems s LEFT JOIN manuals m ON m.system_id = s.id
     GROUP BY s.id ORDER BY s.nome ASC`,
    [seesAllSectors(user), user.sector_ids || [], seesAllUnits(user), user.unit_ids || []]
  );
  return rows;
}

export async function createSystem({ nome, resumo }) {
  const { rows } = await query('INSERT INTO systems (nome, resumo) VALUES ($1, $2) RETURNING *', [nome, resumo]);
  return rows[0];
}

export async function updateSystem(id, { nome, resumo }) {
  const { rows } = await query(
    `UPDATE systems SET nome = COALESCE($1, nome), resumo = COALESCE($2, resumo), updated_at = NOW()
     WHERE id = $3 RETURNING *`, [nome, resumo, id]
  );
  return rows[0];
}

export async function deleteSystem(id) {
  await query('DELETE FROM systems WHERE id = $1', [id]);
}
