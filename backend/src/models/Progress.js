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

export async function saveProgress({ userId, manualId, pdfCompleted, videoProgress, seconds, page, pageCount }) {
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
         WHEN (manual_progress.pdf_completed OR EXCLUDED.pdf_completed OR (
           GREATEST(manual_progress.page_count, EXCLUDED.page_count) > 0 AND
           cardinality((SELECT ARRAY(SELECT DISTINCT value FROM unnest(manual_progress.pages_viewed || EXCLUDED.pages_viewed) value))) >= GREATEST(manual_progress.page_count, EXCLUDED.page_count)
         ))
          AND GREATEST(manual_progress.video_progress, EXCLUDED.video_progress) >= 90
          AND (NOT EXISTS (SELECT 1 FROM quiz_questions qq WHERE qq.manual_id = EXCLUDED.manual_id)
            OR EXISTS (SELECT 1 FROM quiz_attempts qa WHERE qa.manual_id = EXCLUDED.manual_id AND qa.user_id = EXCLUDED.user_id AND qa.passed))
         THEN COALESCE(manual_progress.completed_at, NOW())
         ELSE manual_progress.completed_at
       END
     RETURNING user_id, manual_id, pdf_completed, video_progress, completed_at,
               first_access_at, last_access_at, total_seconds, page_count, last_page, pages_viewed`,
    [userId, manualId, Boolean(pdfCompleted), safeVideoProgress, safeSeconds, safePageCount, safePage]
  );
  return rows[0];
}

export async function getReport(user) {
  const sectorFilter = user.role === 'gerente_setor' ? user.sector_id : null;
  const { rows } = await query(
    `SELECT u.id AS user_id, u.nome AS user_name, s.nome AS sector_name,
            m.id AS manual_id, m.titulo AS manual_title,
            COALESCE(mp.pdf_completed, false) AS pdf_completed,
            COALESCE(mp.video_progress, 0)::float AS video_progress,
            mp.first_access_at, mp.last_access_at, mp.completed_at,
            COALESCE(mp.total_seconds, 0) AS total_seconds,
            COALESCE(mp.page_count, 0) AS page_count,
            COALESCE(cardinality(mp.pages_viewed), 0) AS pages_read,
            m.due_at, m.version
     FROM users u
     JOIN sectors s ON s.id = u.sector_id
     JOIN manuals m ON m.sector_id = u.sector_id
     LEFT JOIN manual_progress mp ON mp.user_id = u.id AND mp.manual_id = m.id
     WHERE u.role = 'usuario' AND ($1::int IS NULL OR u.sector_id = $1)
     ORDER BY m.titulo, u.nome`,
    [sectorFilter]
  );
  return rows;
}
