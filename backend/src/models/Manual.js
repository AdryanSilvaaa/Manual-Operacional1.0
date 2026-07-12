import { query } from '../config/db.js';

export async function listManualsForUser(user, systemId = null) {
  if (user.role === 'gerente') {
    const { rows } = await query(
      `SELECT m.*, u.nome AS criado_por_nome
       FROM manuals m
       LEFT JOIN users u ON u.id = m.criado_por
       WHERE ($1::int IS NULL OR m.system_id = $1)
       ORDER BY m.created_at DESC`,
      [systemId]
    );
    return rows;
  }

  const { rows } = await query(
    `SELECT DISTINCT m.*, u.nome AS criado_por_nome
     FROM manuals m
     LEFT JOIN permissions p ON p.manual_id = m.id
     LEFT JOIN users u ON u.id = m.criado_por
     WHERE ($2::int IS NULL OR m.system_id = $2)
       AND (p.user_id = $1 OR NOT EXISTS (
       SELECT 1 FROM permissions p2 WHERE p2.manual_id = m.id
     ))
     ORDER BY m.created_at DESC`,
    [user.id, systemId]
  );
  return rows;
}

export async function getManualForUser(id, user) {
  const { rows } = await query(
    `SELECT m.*, u.nome AS criado_por_nome
     FROM manuals m
     LEFT JOIN users u ON u.id = m.criado_por
     WHERE m.id = $1`,
    [id]
  );

  const manual = rows[0];
  if (!manual || user.role === 'gerente') {
    return manual;
  }

  const permission = await query(
    `SELECT 1 FROM permissions WHERE manual_id = $1 AND user_id = $2
     UNION
     SELECT 1 WHERE NOT EXISTS (
       SELECT 1 FROM permissions WHERE manual_id = $1
     )`,
    [id, user.id]
  );

  return permission.rowCount > 0 ? manual : null;
}

export async function createManual({ titulo, descricao, pdfUrl, videoUrl, systemId, criadoPor }) {
  const { rows } = await query(
    `INSERT INTO manuals (titulo, descricao, pdf_url, video_url, system_id, criado_por)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [titulo, descricao, pdfUrl, videoUrl, systemId, criadoPor]
  );
  return rows[0];
}

export async function updateManual(id, { titulo, descricao, pdfUrl, videoUrl, systemId }) {
  const hasSystemId = systemId !== undefined;
  const { rows } = await query(
    `UPDATE manuals
     SET titulo = COALESCE($1, titulo),
         descricao = COALESCE($2, descricao),
         pdf_url = COALESCE($3, pdf_url),
         video_url = COALESCE($4, video_url),
         system_id = CASE WHEN $5 THEN $6 ELSE system_id END,
         updated_at = NOW()
     WHERE id = $7
     RETURNING *`,
    [titulo, descricao, pdfUrl, videoUrl, hasSystemId, systemId || null, id]
  );
  return rows[0];
}

export async function deleteManual(id) {
  await query('DELETE FROM manuals WHERE id = $1', [id]);
}

export async function replaceManualPermissions(manualId, userIds) {
  await query('DELETE FROM permissions WHERE manual_id = $1', [manualId]);

  for (const userId of userIds) {
    await query(
      'INSERT INTO permissions (manual_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [manualId, userId]
    );
  }
}
