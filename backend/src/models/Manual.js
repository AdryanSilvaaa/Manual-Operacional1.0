/**
 * Consultas e regras de visibilidade dos manuais por perfil, setor e sistema.
 * Mudanças nos WHERE afetam autorização; mudanças no CRUD afetam os registros persistidos.
 */
import { query, withTransaction } from '../config/db.js';
import { hasSector, seesAllSectors } from '../utils/access.js';

// Percentual do manual: média entre páginas lidas do PDF e vídeo assistido, contando só o que o manual tem
// (um manual pode ter só PDF, só vídeo ou os dois).
const PROGRESS_PERCENT = `ROUND(100 * (
    CASE WHEN m.pdf_url IS NOT NULL AND COALESCE(mp.page_count, 0) > 0
      THEN LEAST(cardinality(mp.pages_viewed)::numeric / mp.page_count, 1) ELSE 0 END
  + CASE WHEN m.video_url IS NOT NULL THEN LEAST(COALESCE(mp.video_progress, 0), 100) / 100 ELSE 0 END
  ) / GREATEST((m.pdf_url IS NOT NULL)::int + (m.video_url IS NOT NULL)::int, 1))::int AS progress_percent`;

// Um manual vale para um ou mais setores (tabela manual_sectors); manuals.sector_id guarda só o primeiro escolhido.
const SECTOR_COLUMNS = `ARRAY(SELECT ms.sector_id FROM manual_sectors ms WHERE ms.manual_id = m.id ORDER BY ms.sector_id) AS sector_ids,
  ARRAY(SELECT s.nome FROM manual_sectors ms JOIN sectors s ON s.id = ms.sector_id
        WHERE ms.manual_id = m.id ORDER BY s.nome) AS sector_names`;

export async function listManualsForUser(user, systemId = null) {
  if (seesAllSectors(user)) {
    const { rows } = await query(
      `SELECT m.*, u.nome AS criado_por_nome, mp.first_access_at, mp.completed_at,
              ${PROGRESS_PERCENT}, ${SECTOR_COLUMNS}
       FROM manuals m LEFT JOIN users u ON u.id = m.criado_por
       LEFT JOIN manual_progress mp ON mp.manual_id = m.id AND mp.user_id = $2
       WHERE ($1::int IS NULL OR m.system_id = $1) ORDER BY m.created_at DESC`,
      [systemId, user.id]
    );
    return rows;
  }

  const { rows } = await query(
    `SELECT m.*, u.nome AS criado_por_nome, mp.first_access_at, mp.completed_at,
            ${PROGRESS_PERCENT}, ${SECTOR_COLUMNS}
     FROM manuals m LEFT JOIN users u ON u.id = m.criado_por
     LEFT JOIN manual_progress mp ON mp.manual_id = m.id AND mp.user_id = $3
     WHERE ($2::int IS NULL OR m.system_id = $2) AND m.active = TRUE
       AND EXISTS (SELECT 1 FROM manual_sectors ms WHERE ms.manual_id = m.id AND ms.sector_id = ANY($1::int[]))
     ORDER BY m.created_at DESC`,
    [user.sector_ids, systemId, user.id]
  );
  return rows;
}

// Protege a abertura direta de um manual com a mesma regra de setores da listagem.
export async function getManualForUser(id, user) {
  const { rows } = await query(
    `SELECT m.*, u.nome AS criado_por_nome, ${SECTOR_COLUMNS} FROM manuals m
     LEFT JOIN users u ON u.id = m.criado_por WHERE m.id = $1`, [id]
  );
  const manual = rows[0];
  if (!manual || seesAllSectors(user)) return manual;
  return manual.active && manual.sector_ids.some((sectorId) => hasSector(user, sectorId)) ? manual : null;
}

// Troca a lista de setores do manual; quem tem qualquer um deles passa a ver o manual.
async function replaceManualSectors(execute, manualId, sectorIds) {
  await execute('DELETE FROM manual_sectors WHERE manual_id = $1', [manualId]);
  await execute(
    'INSERT INTO manual_sectors (manual_id, sector_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING',
    [manualId, sectorIds]
  );
}

// Cria o manual já ligado a um ou mais setores, na mesma transação.
export async function createManual({ titulo, descricao, pdfUrl, videoUrl, systemId, sectorIds, criadoPor }) {
  return withTransaction(async (client) => {
    const execute = client.query.bind(client);
    const { rows } = await execute(
      `INSERT INTO manuals (titulo, descricao, pdf_url, video_url, system_id, sector_id, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [titulo, descricao, pdfUrl, videoUrl, systemId, sectorIds[0], criadoPor]
    );
    await replaceManualSectors(execute, rows[0].id, sectorIds);
    return { ...rows[0], sector_ids: sectorIds };
  });
}

async function executeManualUpdate(execute, id, { titulo, descricao, pdfUrl, videoUrl, systemId, sectorIds, active }) {
  const hasSystemId = systemId !== undefined;
  const hasSectorId = sectorIds !== undefined;
  const { rows } = await execute(
    `UPDATE manuals SET titulo = COALESCE($1, titulo), descricao = COALESCE($2, descricao),
       pdf_url = COALESCE($3, pdf_url), video_url = COALESCE($4, video_url),
       system_id = CASE WHEN $5 THEN $6 ELSE system_id END,
       sector_id = CASE WHEN $7 THEN $8 ELSE sector_id END,
       active = COALESCE($9, active),
       version = CASE WHEN $3::text IS NOT NULL OR $4::text IS NOT NULL THEN version + 1 ELSE version END,
       updated_at = NOW()
     WHERE id = $10 RETURNING *`,
    [titulo, descricao, pdfUrl, videoUrl, hasSystemId, systemId || null, hasSectorId, sectorIds?.[0] || null, active, id]
  );
  if (rows[0] && hasSectorId) await replaceManualSectors(execute, id, sectorIds);
  return rows[0];
}

export async function updateManual(id, data) {
  return withTransaction((client) => executeManualUpdate(client.query.bind(client), id, data));
}

// Tela Gerenciar manuais: ativos e inativos. Gerente de setor recebe só os manuais cujos setores são todos seus.
export async function listManageableManuals(user) {
  const { rows } = await query(
    `SELECT m.id, m.titulo, m.descricao, m.system_id, sy.nome AS system_name, m.active, m.version,
            m.pdf_url IS NOT NULL AS has_pdf, m.video_url IS NOT NULL AS has_video,
            m.created_at, m.updated_at, u.nome AS criado_por_nome, ${SECTOR_COLUMNS}
     FROM manuals m LEFT JOIN users u ON u.id = m.criado_por LEFT JOIN systems sy ON sy.id = m.system_id
     WHERE NOT $1::boolean OR (
       EXISTS (SELECT 1 FROM manual_sectors ms WHERE ms.manual_id = m.id)
       AND NOT EXISTS (SELECT 1 FROM manual_sectors ms WHERE ms.manual_id = m.id AND NOT (ms.sector_id = ANY($2::int[]))))
     ORDER BY m.titulo`,
    [!seesAllSectors(user), user.sector_ids || []]
  );
  return rows;
}

// Título e setores do manual, usados para conferir quem pode editar ou excluir.
export async function getManualSectorIds(id) {
  const { rows } = await query(
    `SELECT m.id, m.titulo, ARRAY(SELECT ms.sector_id FROM manual_sectors ms WHERE ms.manual_id = m.id) AS sector_ids
     FROM manuals m WHERE m.id = $1`, [id]
  );
  return rows[0] || null;
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
