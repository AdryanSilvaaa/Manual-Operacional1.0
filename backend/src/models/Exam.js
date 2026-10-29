/**
 * Consultas PostgreSQL das provas, perguntas, entregas e resultados.
 * A regra de acesso são os setores do usuário: sector_id NULL na prova vale para todos os setores.
 */
import { query, withTransaction } from '../config/db.js';
import { SUBMISSION_STATUS } from '../utils/exam.js';

function groupBy(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row[key])) groups.set(row[key], []);
    groups.get(row[key]).push(row);
  }
  return groups;
}

/** Grava a prova e suas perguntas na mesma transação. */
export async function createExam({ titulo, descricao, sectorId, criadoPor, startsAt, endsAt, questions }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO exams (titulo, descricao, sector_id, criado_por, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [titulo, descricao, sectorId, criadoPor, startsAt, endsAt]
    );
    const exam = rows[0];
    for (const [position, question] of questions.entries()) {
      await client.query(
        `INSERT INTO exam_questions (exam_id, position, type, prompt, options, correct_option)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
        [exam.id, position, question.type, question.prompt,
          question.options ? JSON.stringify(question.options) : null, question.correctOption]
      );
    }
    return { ...exam, question_count: questions.length };
  });
}

/** Provas abertas agora em um dos setores do colaborador (ou para todos) e que ele ainda não entregou. */
export async function listAvailableExams(user) {
  const { rows } = await query(
    `SELECT e.id, e.titulo, e.descricao, e.starts_at, e.ends_at,
            (SELECT COUNT(*)::int FROM exam_questions q WHERE q.exam_id = e.id) AS question_count
     FROM exams e
     WHERE (e.sector_id IS NULL OR e.sector_id = ANY($1::int[])) AND e.active AND NOW() BETWEEN e.starts_at AND e.ends_at
       AND NOT EXISTS (SELECT 1 FROM exam_submissions s WHERE s.exam_id = e.id AND s.user_id = $2)
     ORDER BY e.ends_at ASC`,
    [user.sector_ids, user.id]
  );
  return rows;
}

export async function findExamById(id) {
  const { rows } = await query('SELECT * FROM exams WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function listExamQuestions(examId, includeAnswers = false) {
  const answerColumn = includeAnswers ? ', correct_option' : '';
  const { rows } = await query(
    `SELECT id, position, type, prompt, options${answerColumn}
     FROM exam_questions WHERE exam_id = $1 ORDER BY position`,
    [examId]
  );
  return rows;
}

/** Entrega do colaborador nesta prova (em andamento, enviada ou encerrada), ou null se ele ainda não começou. */
export async function findSubmission(examId, userId) {
  const { rows } = await query('SELECT id, status FROM exam_submissions WHERE exam_id = $1 AND user_id = $2', [examId, userId]);
  return rows[0] || null;
}

/** Registra o início da prova. Devolve null se o colaborador já tinha começado (restrição UNIQUE). */
export async function startSubmission(examId, userId) {
  const { rows } = await query(
    `INSERT INTO exam_submissions (exam_id, user_id, objective_total, objective_correct, status, started_at, submitted_at)
     VALUES ($1, $2, 0, 0, $3, NOW(), NULL) ON CONFLICT (exam_id, user_id) DO NOTHING RETURNING id`,
    [examId, userId, SUBMISSION_STATUS.IN_PROGRESS]
  );
  return rows[0] || null;
}

/**
 * Finaliza a prova (enviada ou encerrada) com as respostas. Só altera entrega ainda em andamento;
 * se ela já terminou, lança erro com código 23505, o mesmo de entrega duplicada.
 */
export async function finishSubmission({ examId, userId, status, objectiveTotal, objectiveCorrect, answers }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO exam_submissions (exam_id, user_id, objective_total, objective_correct, status, submitted_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (exam_id, user_id) DO UPDATE SET objective_total = EXCLUDED.objective_total,
         objective_correct = EXCLUDED.objective_correct, status = EXCLUDED.status, submitted_at = NOW()
       WHERE exam_submissions.status = '${SUBMISSION_STATUS.IN_PROGRESS}'
       RETURNING *`,
      [examId, userId, objectiveTotal, objectiveCorrect, status]
    );
    if (!rows[0]) throw Object.assign(new Error('Prova já finalizada'), { code: '23505' });
    for (const answer of answers) {
      await client.query(
        `INSERT INTO exam_answers (submission_id, question_id, selected_option, answer_text)
         VALUES ($1, $2, $3, $4)`,
        [rows[0].id, answer.questionId, answer.selectedOption, answer.answerText]
      );
    }
    return rows[0];
  });
}

/**
 * Resultados por prova: suporte vê todas. Gerente de setor vê as dos seus setores e as de todos os setores,
 * mas só conta e lista os colaboradores que pertencem a um dos setores dele.
 */
export async function listExamResults(user) {
  const sectorFilter = user.role === 'gerente_setor' ? user.sector_ids : null;
  const { rows: exams } = await query(
    `SELECT e.id, e.titulo, e.descricao, e.starts_at, e.ends_at, e.active, e.created_at,
            COALESCE(s.nome, 'Todos os setores') AS sector_name, u.nome AS criado_por_nome,
            (SELECT COUNT(*)::int FROM users c
             WHERE c.role = 'usuario' AND EXISTS (
               SELECT 1 FROM user_sectors cs WHERE cs.user_id = c.id
                 AND (e.sector_id IS NULL OR cs.sector_id = e.sector_id)
                 AND ($1::int[] IS NULL OR cs.sector_id = ANY($1::int[])))) AS collaborators
     FROM exams e
     LEFT JOIN sectors s ON s.id = e.sector_id
     LEFT JOIN users u ON u.id = e.criado_por
     WHERE ($1::int[] IS NULL OR e.sector_id IS NULL OR e.sector_id = ANY($1::int[]))
     ORDER BY e.starts_at DESC`,
    [sectorFilter]
  );
  if (!exams.length) return [];

  const examIds = exams.map((exam) => exam.id);
  const [{ rows: questions }, { rows: submissions }, { rows: answers }] = await Promise.all([
    query(
      `SELECT id, exam_id, position, type, prompt, options, correct_option
       FROM exam_questions WHERE exam_id = ANY($1::int[]) ORDER BY exam_id, position`, [examIds]
    ),
    query(
      // Quem começou e não voltou fica em andamento até o fim do período; depois disso aparece como encerrada.
      `SELECT sb.id, sb.exam_id, sb.user_id, u.nome AS user_name, sb.objective_total, sb.objective_correct,
              sb.started_at, sb.submitted_at,
              CASE WHEN sb.status = '${SUBMISSION_STATUS.IN_PROGRESS}' AND NOW() > e.ends_at
                THEN '${SUBMISSION_STATUS.CLOSED}' ELSE sb.status END AS status
       FROM exam_submissions sb JOIN users u ON u.id = sb.user_id JOIN exams e ON e.id = sb.exam_id
       WHERE sb.exam_id = ANY($1::int[]) AND ($2::int[] IS NULL OR EXISTS (
         SELECT 1 FROM user_sectors us WHERE us.user_id = sb.user_id AND us.sector_id = ANY($2::int[])))
       ORDER BY u.nome`, [examIds, sectorFilter]
    ),
    query(
      `SELECT a.submission_id, a.question_id, a.selected_option, a.answer_text
       FROM exam_answers a JOIN exam_submissions sb ON sb.id = a.submission_id
       WHERE sb.exam_id = ANY($1::int[])`, [examIds]
    )
  ]);

  // Agrupa uma vez por chave em vez de filtrar a lista inteira para cada prova e entrega.
  const questionsByExam = groupBy(questions, 'exam_id');
  const submissionsByExam = groupBy(submissions, 'exam_id');
  const answersBySubmission = groupBy(answers, 'submission_id');

  return exams.map((exam) => ({
    ...exam,
    questions: questionsByExam.get(exam.id) || [],
    submissions: (submissionsByExam.get(exam.id) || []).map((submission) => ({
      ...submission,
      answers: answersBySubmission.get(submission.id) || []
    }))
  }));
}
