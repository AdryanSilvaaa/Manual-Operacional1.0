/**
 * Consultas PostgreSQL dos modelos de prova (exam_templates e exam_template_questions).
 * Regra de acesso: o modelo é do setor de quem o criou; gerente de setor vê só os dos seus setores,
 * suporte e editor de conteúdo veem todos. Para aplicar, a tela Criar Prova copia as perguntas para uma prova nova.
 */
import { query, withTransaction } from '../config/db.js';
import { insertQuestions } from './Exam.js';

const TEMPLATE_COLUMNS = `t.id, t.titulo, t.descricao, t.sector_id, s.nome AS sector_name, t.criado_por, u.nome AS criado_por_nome,
  t.created_at, t.updated_at,
  (SELECT COUNT(*)::int FROM exam_template_questions q WHERE q.template_id = t.id) AS question_count,
  (SELECT COUNT(*)::int FROM exams e WHERE e.template_id = t.id) AS applied_count`;
const TEMPLATE_FROM = `FROM exam_templates t JOIN sectors s ON s.id = t.sector_id LEFT JOIN users u ON u.id = t.criado_por`;

/** sectorIds nulo = todos os setores (suporte e editor de conteúdo). */
export async function listTemplates(sectorIds) {
  const { rows } = await query(
    `SELECT ${TEMPLATE_COLUMNS} ${TEMPLATE_FROM}
     WHERE $1::int[] IS NULL OR t.sector_id = ANY($1::int[])
     ORDER BY t.titulo`,
    [sectorIds]
  );
  return rows;
}

/** Modelo com as perguntas (inclui a alternativa correta, pois só gestores acessam). */
export async function getTemplate(id) {
  const { rows } = await query(`SELECT ${TEMPLATE_COLUMNS} ${TEMPLATE_FROM} WHERE t.id = $1`, [id]);
  if (!rows[0]) return null;
  const { rows: questions } = await query(
    `SELECT id, position, type, prompt, options, correct_option
     FROM exam_template_questions WHERE template_id = $1 ORDER BY position`,
    [id]
  );
  return { ...rows[0], questions };
}

export async function createTemplate({ titulo, descricao, sectorId, criadoPor, questions }) {
  return withTransaction(async (client) => {
    const execute = client.query.bind(client);
    const { rows } = await execute(
      `INSERT INTO exam_templates (titulo, descricao, sector_id, criado_por) VALUES ($1, $2, $3, $4) RETURNING *`,
      [titulo, descricao, sectorId, criadoPor]
    );
    await insertQuestions(execute, 'exam_template_questions', 'template_id', rows[0].id, questions);
    return { ...rows[0], question_count: questions.length };
  });
}

/** Troca título, descrição e todas as perguntas. Provas já aplicadas não mudam (as perguntas delas são cópias). */
export async function updateTemplate(id, { titulo, descricao, questions }) {
  return withTransaction(async (client) => {
    const execute = client.query.bind(client);
    const { rows } = await execute(
      `UPDATE exam_templates SET titulo = $1, descricao = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [titulo, descricao, id]
    );
    if (!rows[0]) return null;
    await execute('DELETE FROM exam_template_questions WHERE template_id = $1', [id]);
    await insertQuestions(execute, 'exam_template_questions', 'template_id', id, questions);
    return { ...rows[0], question_count: questions.length };
  });
}

/** Excluir o modelo não apaga as provas aplicadas: exams.template_id fica nulo (ON DELETE SET NULL). */
export async function deleteTemplate(id) {
  await query('DELETE FROM exam_templates WHERE id = $1', [id]);
}
