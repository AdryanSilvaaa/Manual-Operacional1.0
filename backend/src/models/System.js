import { query } from '../config/db.js';

export async function listSystemsForUser(user) {
  if (user.role === 'gerente') {
    const { rows } = await query(
      `SELECT s.*, COUNT(m.id)::int AS manuals_count
       FROM systems s
       LEFT JOIN manuals m ON m.system_id = s.id
       GROUP BY s.id
       ORDER BY s.nome ASC`
    );
    return rows;
  }

  const { rows } = await query(
    `SELECT DISTINCT s.*, COUNT(DISTINCT m.id)::int AS manuals_count
     FROM systems s
     JOIN manuals m ON m.system_id = s.id
     LEFT JOIN permissions p ON p.manual_id = m.id
     WHERE p.user_id = $1 OR NOT EXISTS (
       SELECT 1 FROM permissions p2 WHERE p2.manual_id = m.id
     )
     GROUP BY s.id
     ORDER BY s.nome ASC`,
    [user.id]
  );
  return rows;
}

export async function createSystem({ nome, resumo }) {
  const { rows } = await query(
    `INSERT INTO systems (nome, resumo)
     VALUES ($1, $2)
     RETURNING *`,
    [nome, resumo]
  );
  return rows[0];
}

export async function updateSystem(id, { nome, resumo }) {
  const { rows } = await query(
    `UPDATE systems
     SET nome = COALESCE($1, nome),
         resumo = COALESCE($2, resumo),
         updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [nome, resumo, id]
  );
  return rows[0];
}

export async function deleteSystem(id) {
  await query('DELETE FROM systems WHERE id = $1', [id]);
}
