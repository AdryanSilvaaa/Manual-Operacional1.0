/**
 * Consultas e regras de visibilidade dos manuais por perfil, setor, unidade e sistema.
 * Mudanças nos WHERE afetam autorização; mudanças no CRUD afetam os registros persistidos.
 */
import { query, withTransaction } from '../config/db.js';
import { hasSector, reachesUserUnits, seesAllSectors, seesAllUnits } from '../utils/access.js';
import { insertExam } from './Exam.js';
import { manualInUnits } from '../utils/unitSql.js';

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
        WHERE ms.manual_id = m.id ORDER BY s.nome) AS sector_names,
  ARRAY(SELECT mu.unit_id FROM manual_units mu WHERE mu.manual_id = m.id ORDER BY mu.unit_id) AS unit_ids,
  ARRAY(SELECT un.nome FROM manual_units mu JOIN units un ON un.id = mu.unit_id
        WHERE mu.manual_id = m.id ORDER BY un.nome) AS unit_names`;


// Prova do manual (no máximo uma, pelo índice único em exams.manual_id) e a entrega do usuário nela.
// exam_status nulo = ainda não fez; exam_open diz se a prova está ativa e dentro do prazo.
const examJoin = (userParam) => `LEFT JOIN LATERAL (
    SELECT e.id AS exam_id, e.required AS exam_required,
           (e.active AND NOW() >= e.starts_at AND (e.ends_at IS NULL OR NOW() <= e.ends_at)) AS exam_open,
           (SELECT sb.status FROM exam_submissions sb WHERE sb.exam_id = e.id AND sb.user_id = ${userParam}) AS exam_status
    FROM exams e WHERE e.manual_id = m.id) ex ON TRUE`;
const EXAM_COLUMNS = 'ex.exam_id, ex.exam_required, ex.exam_open, ex.exam_status';

// Admin e editor de conteúdo veem todos os manuais (inclusive inativos). Os demais, os ativos dos seus setores
// que sejam das suas unidades ou de todas as unidades.
export async function listManualsForUser(user, systemId = null) {
  if (seesAllSectors(user) && seesAllUnits(user)) {
    const { rows } = await query(
      `SELECT m.*, u.nome AS criado_por_nome, mp.first_access_at, mp.completed_at,
              ${PROGRESS_PERCENT}, ${SECTOR_COLUMNS}, ${EXAM_COLUMNS}
       FROM manuals m LEFT JOIN users u ON u.id = m.criado_por
       LEFT JOIN manual_progress mp ON mp.manual_id = m.id AND mp.user_id = $2
       ${examJoin('$2')}
       WHERE ($1::int IS NULL OR m.system_id = $1) ORDER BY m.created_at DESC`,
      [systemId, user.id]
    );
    return rows;
  }

  const { rows } = await query(
    `SELECT m.*, u.nome AS criado_por_nome, mp.first_access_at, mp.completed_at,
            ${PROGRESS_PERCENT}, ${SECTOR_COLUMNS}, ${EXAM_COLUMNS}
     FROM manuals m LEFT JOIN users u ON u.id = m.criado_por
     LEFT JOIN manual_progress mp ON mp.manual_id = m.id AND mp.user_id = $3
     ${examJoin('$3')}
     WHERE ($2::int IS NULL OR m.system_id = $2) AND m.active = TRUE
       AND ($4::boolean OR EXISTS (SELECT 1 FROM manual_sectors ms WHERE ms.manual_id = m.id AND ms.sector_id = ANY($1::int[])))
       AND ($5::boolean OR ${manualInUnits('$6')})
     ORDER BY m.created_at DESC`,
    [user.sector_ids || [], systemId, user.id, seesAllSectors(user), seesAllUnits(user), user.unit_ids || []]
  );
  return rows;
}

// Protege a abertura direta de um manual com a mesma regra de setores e unidades da listagem.
export async function getManualForUser(id, user) {
  const { rows } = await query(
    `SELECT m.*, u.nome AS criado_por_nome, ${SECTOR_COLUMNS}, ${EXAM_COLUMNS} FROM manuals m
     LEFT JOIN users u ON u.id = m.criado_por ${examJoin('$2')} WHERE m.id = $1`, [id, user?.id || null]
  );
  const manual = rows[0];
  if (!manual || (seesAllSectors(user) && seesAllUnits(user))) return manual;
  const sectorOk = seesAllSectors(user) || manual.sector_ids.some((sectorId) => hasSector(user, sectorId));
  return manual.active && sectorOk && reachesUserUnits(user, manual.unit_ids) ? manual : null;
}

// Troca a lista de setores do manual; quem tem qualquer um deles passa a ver o manual.
async function replaceManualSectors(execute, manualId, sectorIds) {
  await execute('DELETE FROM manual_sectors WHERE manual_id = $1', [manualId]);
  await execute(
    'INSERT INTO manual_sectors (manual_id, sector_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING',
    [manualId, sectorIds]
  );
}

// Troca as unidades do manual; lista vazia = todas as unidades.
async function replaceManualUnits(execute, manualId, unitIds) {
  await execute('DELETE FROM manual_units WHERE manual_id = $1', [manualId]);
  if (unitIds.length) {
    await execute(
      'INSERT INTO manual_units (manual_id, unit_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING',
      [manualId, unitIds]
    );
  }
}

// Cria o manual já ligado a um ou mais setores, às unidades (vazio = todas) e, se vier, à prova do manual, numa transação.
export async function createManual({ titulo, descricao, pdfUrl, videoUrl, systemId, sectorIds, unitIds = [], criadoPor, exam = null }) {
  return withTransaction(async (client) => {
    const execute = client.query.bind(client);
    const { rows } = await execute(
      `INSERT INTO manuals (titulo, descricao, pdf_url, video_url, system_id, sector_id, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [titulo, descricao, pdfUrl, videoUrl, systemId, sectorIds[0], criadoPor]
    );
    await replaceManualSectors(execute, rows[0].id, sectorIds);
    await replaceManualUnits(execute, rows[0].id, unitIds);
    const createdExam = exam ? await insertExam(execute, { ...exam, manualId: rows[0].id, criadoPor }) : null;
    return { ...rows[0], sector_ids: sectorIds, unit_ids: unitIds, exam_id: createdExam?.id || null, exam_required: createdExam?.required ?? null };
  });
}

// removePdf/removeVideo tiram o arquivo do manual sem criar versão: o progresso na parte que fica é mantido.
// unitIds undefined mantém as unidades; [] passa o manual para todas as unidades.
async function executeManualUpdate(execute, id, { titulo, descricao, pdfUrl, videoUrl, systemId, sectorIds, unitIds, active, removePdf = false, removeVideo = false }) {
  const hasSystemId = systemId !== undefined;
  const hasSectorId = sectorIds !== undefined;
  const { rows } = await execute(
    `UPDATE manuals SET titulo = COALESCE($1, titulo), descricao = COALESCE($2, descricao),
       pdf_url = CASE WHEN $11::boolean THEN NULL ELSE COALESCE($3, pdf_url) END,
       video_url = CASE WHEN $12::boolean THEN NULL ELSE COALESCE($4, video_url) END,
       system_id = CASE WHEN $5 THEN $6 ELSE system_id END,
       sector_id = CASE WHEN $7 THEN $8 ELSE sector_id END,
       active = COALESCE($9, active),
       version = CASE WHEN $3::text IS NOT NULL OR $4::text IS NOT NULL THEN version + 1 ELSE version END,
       updated_at = NOW()
     WHERE id = $10 RETURNING *`,
    [titulo, descricao, pdfUrl, videoUrl, hasSystemId, systemId || null, hasSectorId, sectorIds?.[0] || null, active, id, Boolean(removePdf), Boolean(removeVideo)]
  );
  if (rows[0] && hasSectorId) await replaceManualSectors(execute, id, sectorIds);
  if (rows[0] && unitIds !== undefined) await replaceManualUnits(execute, id, unitIds);
  if (rows[0] && (removePdf || removeVideo)) await completeProgressAfterRemoval(execute, id);
  return rows[0];
}

// Sem o arquivo removido, quem já tinha cumprido a parte que ficou passa a ter o manual concluído
// (mesma regra de saveProgress: PDF lido e/ou 90% do vídeo, contando só o que o manual tem).
async function completeProgressAfterRemoval(execute, id) {
  await execute(
    `UPDATE manual_progress mp SET completed_at = NOW()
     FROM manuals m
     WHERE m.id = mp.manual_id AND mp.manual_id = $1 AND mp.completed_at IS NULL
       AND (m.pdf_url IS NULL OR mp.pdf_completed)
       AND (m.video_url IS NULL OR mp.video_progress >= 90)`,
    [id]
  );
}

export async function updateManual(id, data) {
  return withTransaction((client) => executeManualUpdate(client.query.bind(client), id, data));
}

// Tela Gerenciar manuais: ativos e inativos. Gerente de setor recebe só os manuais cujos setores são todos seus
// e cujas unidades são todas suas (ou que valem para todas as unidades).
export async function listManageableManuals(user) {
  const { rows } = await query(
    `SELECT m.id, m.titulo, m.descricao, m.system_id, sy.nome AS system_name, m.active, m.version,
            m.pdf_url IS NOT NULL AS has_pdf, m.video_url IS NOT NULL AS has_video,
            m.created_at, m.updated_at, u.nome AS criado_por_nome, ${SECTOR_COLUMNS}
     FROM manuals m LEFT JOIN users u ON u.id = m.criado_por LEFT JOIN systems sy ON sy.id = m.system_id
     WHERE (NOT $1::boolean OR (
       EXISTS (SELECT 1 FROM manual_sectors ms WHERE ms.manual_id = m.id)
       AND NOT EXISTS (SELECT 1 FROM manual_sectors ms WHERE ms.manual_id = m.id AND NOT (ms.sector_id = ANY($2::int[]))))
     ) AND (NOT $3::boolean OR
       NOT EXISTS (SELECT 1 FROM manual_units mu WHERE mu.manual_id = m.id AND NOT (mu.unit_id = ANY($4::int[]))))
     ORDER BY m.titulo`,
    [!seesAllSectors(user), user.sector_ids || [], !seesAllUnits(user), user.unit_ids || []]
  );
  return rows;
}

// Título, arquivos e setores do manual, usados para conferir quem pode editar, excluir ou remover um arquivo.
export async function getManualSectorIds(id) {
  const { rows } = await query(
    `SELECT m.id, m.titulo, m.pdf_url, m.video_url,
            ARRAY(SELECT ms.sector_id FROM manual_sectors ms WHERE ms.manual_id = m.id) AS sector_ids,
            ARRAY(SELECT mu.unit_id FROM manual_units mu WHERE mu.manual_id = m.id) AS unit_ids
     FROM manuals m WHERE m.id = $1`, [id]
  );
  return rows[0] || null;
}

// Um mesmo arquivo pode estar no manual atual e em versões arquivadas; só sai do armazenamento quando ninguém mais o usa.
export async function isFileReferenced(value) {
  const { rows } = await query(
    `SELECT EXISTS (SELECT 1 FROM manuals WHERE pdf_url = $1 OR video_url = $1)
         OR EXISTS (SELECT 1 FROM manual_version_history WHERE pdf_url = $1 OR video_url = $1) AS used`,
    [value]
  );
  return rows[0].used;
}

/** Exclui o manual; setores, unidades, progresso, prova e histórico saem junto (ON DELETE CASCADE). */
export async function deleteManual(id) {
  await query('DELETE FROM manuals WHERE id = $1', [id]);
}

// Guarda a versão atual (arquivos e progresso dos colaboradores) no histórico e zera o progresso,
// porque o conteúdo novo precisa ser lido de novo.
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
