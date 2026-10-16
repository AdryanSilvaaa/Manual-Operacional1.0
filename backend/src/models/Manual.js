/**
 * Consultas e regras de visibilidade dos manuais por perfil, setor e sistema.
 * Mudanças nos WHERE afetam autorização; mudanças no CRUD afetam os registros persistidos.
 */
import { query, withTransaction } from '../config/db.js';
import { hasSector, isSupport } from '../utils/access.js';

export async function listManualsForUser(user, systemId = null) {
  if (isSupport(user)) {
    const { rows } = await query(
      `SELECT m.*, u.nome AS criado_por_nome, mp.first_access_at, mp.completed_at,
              ROUND((CASE WHEN COALESCE(mp.page_count, 0) > 0
                THEN LEAST(cardinality(mp.pages_viewed)::numeric / mp.page_count * 50, 50)
                ELSE 0 END + LEAST(COALESCE(mp.video_progress, 0), 100) / 2))::int AS progress_percent
       FROM manuals m LEFT JOIN users u ON u.id = m.criado_por
       LEFT JOIN manual_progress mp ON mp.manual_id = m.id AND mp.user_id = $2
       WHERE ($1::int IS NULL OR m.system_id = $1) ORDER BY m.created_at DESC`,
      [systemId, user.id]
    );
    return rows;
  }

  const { rows } = await query(
    `SELECT m.*, u.nome AS criado_por_nome, mp.first_access_at, mp.completed_at,
            ROUND((CASE WHEN COALESCE(mp.page_count, 0) > 0
              THEN LEAST(cardinality(mp.pages_viewed)::numeric / mp.page_count * 50, 50)
              ELSE 0 END + LEAST(COALESCE(mp.video_progress, 0), 100) / 2))::int AS progress_percent
     FROM manuals m LEFT JOIN users u ON u.id = m.criado_por
     LEFT JOIN manual_progress mp ON mp.manual_id = m.id AND mp.user_id = $3
     WHERE ($2::int IS NULL OR m.system_id = $2) AND m.sector_id = ANY($1::int[]) AND m.active = TRUE
     ORDER BY m.created_at DESC`,
    [user.sector_ids, systemId, user.id]
  );
  return rows;
}

// Protege a abertura direta de um manual com a mesma regra de setores da listagem.
export async function getManualForUser(id, user) {
  const { rows } = await query(
    `SELECT m.*, u.nome AS criado_por_nome FROM manuals m
     LEFT JOIN users u ON u.id = m.criado_por WHERE m.id = $1`, [id]
  );
  const manual = rows[0];
  if (!manual || isSupport(user)) return manual;
  return manual.active && hasSector(user, manual.sector_id) ? manual : null;
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

async function executeManualUpdate(execute, id, { titulo, descricao, pdfUrl, videoUrl, systemId, sectorId, active }) {
  const hasSystemId = systemId !== undefined;
  const hasSectorId = sectorId !== undefined;
  const { rows } = await execute(
    `UPDATE manuals SET titulo = COALESCE($1, titulo), descricao = COALESCE($2, descricao),
       pdf_url = COALESCE($3, pdf_url), video_url = COALESCE($4, video_url),
       system_id = CASE WHEN $5 THEN $6 ELSE system_id END,
       sector_id = CASE WHEN $7 THEN $8 ELSE sector_id END,
       active = COALESCE($9, active),
       version = CASE WHEN $3::text IS NOT NULL OR $4::text IS NOT NULL THEN version + 1 ELSE version END,
       updated_at = NOW()
     WHERE id = $10 RETURNING *`,
    [titulo, descricao, pdfUrl, videoUrl, hasSystemId, systemId || null, hasSectorId, sectorId || null, active, id]
  );
  return rows[0];
}

export async function updateManual(id, data) {
  return executeManualUpdate(query, id, data);
}

export async function deleteManual(id) {
  await query('DELETE FROM manuals WHERE id = $1', [id]);
}

export async function archiveCurrentVersion(id) {
  return withTransaction(async (client) => {
    await archiveVersionWith(client.query.bind(client), id);
  });
}

async function archiveVersionWith(execute, id) {
  await execute(
    `INSERT INTO manual_version_history (manual_id, version, titulo, descricao, pdf_url, video_url)
     SELECT id, version, titulo, descricao, pdf_url, video_url FROM manuals WHERE id = $1
     ON CONFLICT (manual_id, version) DO NOTHING`, [id]
  );
  await execute(
    `INSERT INTO progress_version_history (user_id, manual_id, version, snapshot)
     SELECT mp.user_id, mp.manual_id, m.version, to_jsonb(mp) FROM manual_progress mp
     JOIN manuals m ON m.id = mp.manual_id WHERE mp.manual_id = $1`, [id]
  );
  await execute('DELETE FROM manual_progress WHERE manual_id = $1', [id]);
}

/** Arquiva a versão anterior e atualiza o manual como uma única operação atômica. */
export async function archiveAndUpdateManual(id, data) {
  return withTransaction(async (client) => {
    const execute = client.query.bind(client);
    await archiveVersionWith(execute, id);
    return executeManualUpdate(execute, id, data);
  });
}
