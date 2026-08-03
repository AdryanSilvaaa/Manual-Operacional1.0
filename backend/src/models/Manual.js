/**
 * Consultas e regras de visibilidade dos manuais por perfil, setor e sistema.
 * Mudanças nos WHERE afetam autorização; mudanças no CRUD afetam os registros persistidos.
 */
import { query } from '../config/db.js';

export async function listManualsForUser(user, systemId = null) {
  if (user.role === 'gerente') {
    const { rows } = await query(
      `SELECT m.*, u.nome AS criado_por_nome
       FROM manuals m LEFT JOIN users u ON u.id = m.criado_por
       WHERE ($1::int IS NULL OR m.system_id = $1) ORDER BY m.created_at DESC`,
      [systemId]
    );
    return rows;
  }

  const { rows } = await query(
    `SELECT m.*, u.nome AS criado_por_nome
     FROM manuals m LEFT JOIN users u ON u.id = m.criado_por
     WHERE ($2::int IS NULL OR m.system_id = $2) AND m.sector_id = $1
     ORDER BY m.created_at DESC`,
    [user.sector_id, systemId]
  );
  return rows;
}

// Protege a abertura direta de um manual com a mesma regra de setor da listagem.
export async function getManualForUser(id, user) {
  const { rows } = await query(
    `SELECT m.*, u.nome AS criado_por_nome FROM manuals m
     LEFT JOIN users u ON u.id = m.criado_por WHERE m.id = $1`, [id]
  );
  const manual = rows[0];
  if (!manual || user.role === 'gerente') return manual;
  return Number(manual.sector_id) === Number(user.sector_id) ? manual : null;
}

// Associa o manual a um unico setor, que passa a ser sua regra de autorizacao.
export async function createManual({ titulo, descricao, pdfUrl, videoUrl, systemId, sectorId, criadoPor }) {
  const { rows } = await query(
    `INSERT INTO manuals (titulo, descricao, pdf_url, video_url, system_id, sector_id, criado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [titulo, descricao, pdfUrl, videoUrl, systemId, sectorId, criadoPor]
  );
  return rows[0];
}

export async function updateManual(id, { titulo, descricao, pdfUrl, videoUrl, systemId, sectorId }) {
  const hasSystemId = systemId !== undefined;
  const hasSectorId = sectorId !== undefined;
  const { rows } = await query(
    `UPDATE manuals SET titulo = COALESCE($1, titulo), descricao = COALESCE($2, descricao),
       pdf_url = COALESCE($3, pdf_url), video_url = COALESCE($4, video_url),
       system_id = CASE WHEN $5 THEN $6 ELSE system_id END,
       sector_id = CASE WHEN $7 THEN $8 ELSE sector_id END, updated_at = NOW()
     WHERE id = $9 RETURNING *`,
    [titulo, descricao, pdfUrl, videoUrl, hasSystemId, systemId || null, hasSectorId, sectorId || null, id]
  );
  return rows[0];
}

export async function deleteManual(id) {
  await query('DELETE FROM manuals WHERE id = $1', [id]);
}
