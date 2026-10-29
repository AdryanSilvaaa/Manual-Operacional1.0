import { query } from '../config/db.js';

export async function getProgress(userId, manualId) {
  const { rows } = await query(
    `SELECT user_id, manual_id, pdf_completed, video_progress, completed_at,
            first_access_at, last_access_at, total_seconds, page_count, last_page, pages_viewed
     FROM manual_progress WHERE user_id = $1 AND manual_id = $2`,
    [userId, manualId]
  );
  return rows[0] || null;
}

// hasPdf/hasVideo dizem o que o manual tem: a conclusão exige só as partes existentes (PDF lido e/ou 90% do vídeo).
export async function saveProgress({ userId, manualId, pdfCompleted, videoProgress, seconds, page, pageCount, hasPdf = true, hasVideo = true }) {
  const safeVideoProgress = Math.max(0, Math.min(100, Number(videoProgress) || 0));
  const safeSeconds = Math.max(0, Math.min(60, Number(seconds) || 0));
  const safePageCount = Math.max(0, Number(pageCount) || 0);
  const safePage = Math.max(0, Math.min(safePageCount || Number(page) || 0, Number(page) || 0));
  const { rows } = await query(
    `INSERT INTO manual_progress
       (user_id, manual_id, pdf_completed, video_progress, total_seconds, page_count, last_page, pages_viewed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $7 > 0 THEN ARRAY[$7] ELSE '{}' END)
     ON CONFLICT (user_id, manual_id) DO UPDATE SET
       pdf_completed = manual_progress.pdf_completed OR EXCLUDED.pdf_completed OR (
         GREATEST(manual_progress.page_count, EXCLUDED.page_count) > 0 AND
         cardinality((SELECT ARRAY(SELECT DISTINCT value FROM unnest(manual_progress.pages_viewed || EXCLUDED.pages_viewed) value))) >= GREATEST(manual_progress.page_count, EXCLUDED.page_count)
       ),
       video_progress = GREATEST(manual_progress.video_progress, EXCLUDED.video_progress),
       total_seconds = manual_progress.total_seconds + EXCLUDED.total_seconds,
       last_access_at = NOW(),
       page_count = GREATEST(manual_progress.page_count, EXCLUDED.page_count),
       last_page = GREATEST(manual_progress.last_page, EXCLUDED.last_page),
       pages_viewed = (SELECT ARRAY(SELECT DISTINCT value FROM unnest(manual_progress.pages_viewed || EXCLUDED.pages_viewed) value ORDER BY value)),
       completed_at = CASE
         WHEN (NOT $8::boolean OR manual_progress.pdf_completed OR EXCLUDED.pdf_completed OR (
           GREATEST(manual_progress.page_count, EXCLUDED.page_count) > 0 AND
           cardinality((SELECT ARRAY(SELECT DISTINCT value FROM unnest(manual_progress.pages_viewed || EXCLUDED.pages_viewed) value))) >= GREATEST(manual_progress.page_count, EXCLUDED.page_count)
         ))
          AND (NOT $9::boolean OR GREATEST(manual_progress.video_progress, EXCLUDED.video_progress) >= 90)
         THEN COALESCE(manual_progress.completed_at, NOW())
         ELSE manual_progress.completed_at
       END
     RETURNING user_id, manual_id, pdf_completed, video_progress, completed_at,
               first_access_at, last_access_at, total_seconds, page_count, last_page, pages_viewed`,
    [userId, manualId, Boolean(pdfCompleted), safeVideoProgress, safeSeconds, safePageCount, safePage, Boolean(hasPdf), Boolean(hasVideo)]
  );
  return rows[0];
}

// Uma linha por pessoa (qualquer perfil) e manual: os manuais dos setores dela, inclusive não iniciados,
// mais os que ela abriu fora deles (o suporte, que não tem setor, entra pelos manuais que leu).
// Gerente de setor vê só quem é dos próprios setores, nos manuais desses setores.
// sector_names: setores do manual pelos quais a pessoa o recebe (ou todos os do manual, se ela o abriu por fora).
export async function getReport(user) {
  const sectorFilter = user.role === 'gerente_setor' ? user.sector_ids : null;
  const { rows } = await query(
    `WITH pairs AS (
       SELECT us.user_id, ms.manual_id
       FROM user_sectors us JOIN manual_sectors ms ON ms.sector_id = us.sector_id
       UNION
       SELECT user_id, manual_id FROM manual_progress
     )
     SELECT u.id AS user_id, u.nome AS user_name, u.role AS user_role,
            sn.names AS sector_names, array_to_string(sn.names, ', ') AS sector_name,
            m.id AS manual_id, m.titulo AS manual_title,
            COALESCE(mp.pdf_completed, false) AS pdf_completed,
            COALESCE(mp.video_progress, 0)::float AS video_progress,
            mp.first_access_at, mp.last_access_at, mp.completed_at,
            COALESCE(mp.total_seconds, 0) AS total_seconds,
            COALESCE(mp.page_count, 0) AS page_count,
            COALESCE(cardinality(mp.pages_viewed), 0) AS pages_read,
            m.pdf_url IS NOT NULL AS has_pdf, m.video_url IS NOT NULL AS has_video,
            m.version
     FROM pairs p
     JOIN users u ON u.id = p.user_id
     JOIN manuals m ON m.id = p.manual_id
     CROSS JOIN LATERAL (SELECT COALESCE(
       NULLIF(ARRAY(SELECT s.nome FROM manual_sectors ms
                    JOIN user_sectors x ON x.sector_id = ms.sector_id AND x.user_id = u.id
                    JOIN sectors s ON s.id = ms.sector_id
                    WHERE ms.manual_id = m.id AND ($1::int[] IS NULL OR ms.sector_id = ANY($1::int[]))
                    ORDER BY s.nome), '{}'),
       ARRAY(SELECT s.nome FROM manual_sectors ms JOIN sectors s ON s.id = ms.sector_id
             WHERE ms.manual_id = m.id ORDER BY s.nome)
     ) AS names) sn
     LEFT JOIN manual_progress mp ON mp.user_id = u.id AND mp.manual_id = m.id
     WHERE $1::int[] IS NULL OR EXISTS (
       SELECT 1 FROM manual_sectors ms JOIN user_sectors x ON x.sector_id = ms.sector_id
       WHERE ms.manual_id = m.id AND x.user_id = u.id AND ms.sector_id = ANY($1::int[])
     )
     ORDER BY m.titulo, u.nome`,
    [sectorFilter]
  );
  return rows;
}
