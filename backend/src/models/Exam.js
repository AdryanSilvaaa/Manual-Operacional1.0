/**
 * Consultas PostgreSQL das provas, perguntas, entregas e resultados.
 * A regra de acesso são os setores e as unidades do usuário: sector_id NULL na prova vale para todos os setores
 * e unit_id NULL para todas as unidades. A prova de manual segue os setores e as unidades do manual.
 */
import { query, withTransaction } from '../config/db.js';
import { SUBMISSION_STATUS } from '../utils/exam.js';
import { PERMISSIONS, rolesWith, seesAllSectors, seesAllUnits } from '../utils/access.js';
import { examInUserUnit, manualInUnits, manualInUserUnits, userInUnits } from '../utils/unitSql.js';

function groupBy(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row[key])) groups.set(row[key], []);
    groups.get(row[key]).push(row);
  }
  return groups;
}

/**
 * Grava a prova e as perguntas com o executor de uma transação já aberta (client.query).
 * Usado ao aplicar um modelo de prova e no cadastro do manual, que grava manual e prova juntos.
 */
export async function insertExam(execute, {
  titulo, descricao, sectorId = null, unitId = null, criadoPor, startsAt, endsAt, questions,
  manualId = null, required = false, templateId = null, assigneeIds = []
}) {
  const { rows } = await execute(
    `INSERT INTO exams (titulo, descricao, sector_id, criado_por, starts_at, ends_at, manual_id, required, template_id, unit_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [titulo, descricao, sectorId, criadoPor, startsAt, endsAt, manualId, Boolean(required), templateId, unitId]
  );
  const exam = rows[0];
  await insertQuestions(execute, 'exam_questions', 'exam_id', exam.id, questions);
  // Prova aplicada a colaboradores específicos: só eles a recebem.
  if (assigneeIds.length) {
    await execute('INSERT INTO exam_assignees (exam_id, user_id) SELECT $1, UNNEST($2::int[]) ON CONFLICT DO NOTHING', [exam.id, assigneeIds]);
  }
  return { ...exam, question_count: questions.length, assignee_count: assigneeIds.length };
}

/** Grava as perguntas na ordem recebida em exam_questions ou exam_template_questions (mesmas colunas). */
export async function insertQuestions(execute, table, ownerColumn, ownerId, questions) {
  for (const [position, question] of questions.entries()) {
    await execute(
      `INSERT INTO ${table} (${ownerColumn}, position, type, prompt, options, correct_option)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [ownerId, position, question.type, question.prompt,
        question.options ? JSON.stringify(question.options) : null, question.correctOption]
    );
  }
}

// Prova aberta agora: ativa, já começou e dentro do prazo (prova de manual pode não ter prazo final).
const EXAM_OPEN = `e.active AND NOW() >= e.starts_at AND (e.ends_at IS NULL OR NOW() <= e.ends_at)`;

/**
 * Provas abertas agora que o colaborador ainda não entregou: as avulsas de um dos setores dele (ou de todos)
 * na unidade dele (ou em todas) e as provas de manual de um manual ativo dos setores e unidades dele, liberadas só depois de ele concluir o manual.
 * As obrigatórias vêm primeiro.
 */
export async function listAvailableExams(user) {
  const { rows } = await query(
    `SELECT e.id, e.titulo, e.descricao, e.starts_at, e.ends_at, e.manual_id, e.required, m.titulo AS manual_titulo,
            (SELECT COUNT(*)::int FROM exam_questions q WHERE q.exam_id = e.id) AS question_count
     FROM exams e
     LEFT JOIN manuals m ON m.id = e.manual_id
     WHERE ${EXAM_OPEN}
       AND NOT EXISTS (SELECT 1 FROM exam_submissions s WHERE s.exam_id = e.id AND s.user_id = $2)
       AND (
         -- Avulsa aplicada a colaboradores específicos: só eles. Sem escolhidos: o setor da prova (ou todos).
         (e.manual_id IS NULL AND EXISTS (SELECT 1 FROM exam_assignees a WHERE a.exam_id = e.id AND a.user_id = $2))
         OR (e.manual_id IS NULL AND NOT EXISTS (SELECT 1 FROM exam_assignees a WHERE a.exam_id = e.id)
           AND (e.sector_id IS NULL OR e.sector_id = ANY($1::int[]))
           AND (e.unit_id IS NULL OR e.unit_id = ANY($3::int[])))
         OR (e.manual_id IS NOT NULL AND m.active
           AND EXISTS (SELECT 1 FROM manual_sectors ms WHERE ms.manual_id = e.manual_id AND ms.sector_id = ANY($1::int[]))
           AND ${manualInUnits('$3', 'e.manual_id')}
           AND EXISTS (SELECT 1 FROM manual_progress mp
                       WHERE mp.manual_id = e.manual_id AND mp.user_id = $2 AND mp.completed_at IS NOT NULL))
       )
     ORDER BY e.required DESC, e.ends_at ASC NULLS LAST, e.id`,
    [user.sector_ids || [], user.id, user.unit_ids || []]
  );
  return rows;
}

/** Prova com colaboradores escolhidos (hasAssignees) e se este usuário é um deles (isAssignee). */
export async function getExamAssignment(examId, userId) {
  const { rows } = await query(
    `SELECT EXISTS (SELECT 1 FROM exam_assignees WHERE exam_id = $1) AS has_assignees,
            EXISTS (SELECT 1 FROM exam_assignees WHERE exam_id = $1 AND user_id = $2) AS is_assignee`,
    [examId, userId]
  );
  return { hasAssignees: rows[0].has_assignees, isAssignee: rows[0].is_assignee };
}

/**
 * Situação do colaborador diante da prova de um manual: hasAccess (o manual é de um dos setores e das unidades dele e está ativo)
 * e completed (ele já concluiu 100% do conteúdo, o que libera a prova).
 */
export async function getManualExamAccess(manualId, user) {
  const { rows } = await query(
    `SELECT (m.active AND EXISTS (SELECT 1 FROM manual_sectors ms WHERE ms.manual_id = m.id AND ms.sector_id = ANY($2::int[]))
             AND ${manualInUnits('$4')}) AS has_access,
            EXISTS (SELECT 1 FROM manual_progress mp WHERE mp.manual_id = m.id AND mp.user_id = $3 AND mp.completed_at IS NOT NULL) AS completed
     FROM manuals m WHERE m.id = $1`,
    [manualId, user.sector_ids || [], user.id, user.unit_ids || []]
  );
  return { hasAccess: Boolean(rows[0]?.has_access), completed: Boolean(rows[0]?.completed) };
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
 * Resultados por prova: admin e editor de conteúdo veem todas. Gerente de setor e gestor de área veem as dos seus setores e as de todos os setores,
 * mas só conta e lista os colaboradores que pertencem a um dos setores dele.
 * Prova de manual vale para os setores do manual (manual_sectors), e não para exams.sector_id.
 * Unidades: quem não vê todas vê as provas que alcançam as suas unidades e só conta e lista colaboradores delas.
 */
export async function listExamResults(user) {
  const sectorFilter = seesAllSectors(user) ? null : user.sector_ids || [];
  const unitFilter = seesAllUnits(user) ? null : user.unit_ids || [];
  const { rows: exams } = await query(
    `SELECT e.id, e.titulo, e.descricao, e.starts_at, e.ends_at, e.active, e.created_at,
            e.manual_id, e.required, mn.titulo AS manual_titulo,
            CASE WHEN e.manual_id IS NULL THEN ARRAY[COALESCE(s.nome, 'Todos os setores')]
                 ELSE ARRAY(SELECT s2.nome FROM manual_sectors ms2 JOIN sectors s2 ON s2.id = ms2.sector_id
                            WHERE ms2.manual_id = e.manual_id ORDER BY s2.nome) END AS sector_names,
            CASE WHEN e.manual_id IS NULL THEN COALESCE(s.nome, 'Todos os setores')
                 ELSE (SELECT string_agg(s2.nome, ', ' ORDER BY s2.nome) FROM manual_sectors ms2
                       JOIN sectors s2 ON s2.id = ms2.sector_id WHERE ms2.manual_id = e.manual_id) END AS sector_name,
            CASE WHEN e.manual_id IS NULL THEN COALESCE(un.nome, 'Todas as unidades')
                 ELSE COALESCE((SELECT string_agg(u2.nome, ', ' ORDER BY u2.nome) FROM manual_units mu2
                                JOIN units u2 ON u2.id = mu2.unit_id WHERE mu2.manual_id = e.manual_id), 'Todas as unidades') END AS unit_name,
            e.unit_id, u.nome AS criado_por_nome, e.template_id,
            ARRAY(SELECT au.nome FROM exam_assignees a JOIN users au ON au.id = a.user_id
                  WHERE a.exam_id = e.id ORDER BY au.nome) AS assignee_names,
            (SELECT COUNT(*)::int FROM users c
             WHERE c.role = ANY($2::text[])
               -- Aplicada a colaboradores específicos: conta só os escolhidos.
               AND (NOT EXISTS (SELECT 1 FROM exam_assignees a WHERE a.exam_id = e.id)
                    OR EXISTS (SELECT 1 FROM exam_assignees a WHERE a.exam_id = e.id AND a.user_id = c.id))
               -- Unidade: prova avulsa da unidade dele (ou de todas); prova de manual das unidades do manual (ou de todas).
               AND CASE WHEN e.manual_id IS NULL THEN ${examInUserUnit('c.id')} ELSE ${manualInUserUnits('c.id', 'e.manual_id')} END
               AND ($3::int[] IS NULL OR ${userInUnits('c.id', '$3')})
               AND EXISTS (
               SELECT 1 FROM user_sectors cs WHERE cs.user_id = c.id
                 AND CASE WHEN e.manual_id IS NULL THEN (e.sector_id IS NULL OR cs.sector_id = e.sector_id)
                          ELSE EXISTS (SELECT 1 FROM manual_sectors ms3 WHERE ms3.manual_id = e.manual_id AND ms3.sector_id = cs.sector_id) END
                 AND ($1::int[] IS NULL OR cs.sector_id = ANY($1::int[])))) AS collaborators
     FROM exams e
     LEFT JOIN sectors s ON s.id = e.sector_id
     LEFT JOIN units un ON un.id = e.unit_id
     LEFT JOIN users u ON u.id = e.criado_por
     LEFT JOIN manuals mn ON mn.id = e.manual_id
     WHERE ($1::int[] IS NULL
        OR (e.manual_id IS NULL AND (e.sector_id IS NULL OR e.sector_id = ANY($1::int[])))
        OR (e.manual_id IS NOT NULL AND EXISTS (SELECT 1 FROM manual_sectors ms4 WHERE ms4.manual_id = e.manual_id AND ms4.sector_id = ANY($1::int[]))))
       AND ($3::int[] IS NULL
        OR (e.manual_id IS NULL AND (e.unit_id IS NULL OR e.unit_id = ANY($3::int[])))
        OR (e.manual_id IS NOT NULL AND ${manualInUnits('$3', 'e.manual_id')}))
     ORDER BY e.starts_at DESC`,
    [sectorFilter, rolesWith(PERMISSIONS.TAKE_EXAMS), unitFilter]
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
              CASE WHEN sb.status = '${SUBMISSION_STATUS.IN_PROGRESS}' AND e.ends_at IS NOT NULL AND NOW() > e.ends_at
                THEN '${SUBMISSION_STATUS.CLOSED}' ELSE sb.status END AS status
       FROM exam_submissions sb JOIN users u ON u.id = sb.user_id JOIN exams e ON e.id = sb.exam_id
       WHERE sb.exam_id = ANY($1::int[]) AND ($2::int[] IS NULL OR EXISTS (
         SELECT 1 FROM user_sectors us WHERE us.user_id = sb.user_id AND us.sector_id = ANY($2::int[])))
         AND ($3::int[] IS NULL OR ${userInUnits('sb.user_id', '$3')})
       ORDER BY u.nome`, [examIds, sectorFilter, unitFilter]
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
