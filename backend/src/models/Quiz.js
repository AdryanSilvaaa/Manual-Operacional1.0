import { query, withTransaction } from '../config/db.js';
import { calculateQuizResult } from '../utils/security.js';

export async function replaceQuestions(manualId, questions = []) {
  await withTransaction(async (client) => {
    await client.query('DELETE FROM quiz_questions WHERE manual_id = $1', [manualId]);
    for (const [position, question] of questions.entries()) {
      await client.query(
        `INSERT INTO quiz_questions (manual_id, prompt, options, correct_option, position)
         VALUES ($1, $2, $3::jsonb, $4, $5)`,
        [manualId, question.prompt, JSON.stringify(question.options), Number(question.correctOption), position]
      );
    }
  });
}

export async function listQuestions(manualId, includeAnswers = false) {
  const answerColumn = includeAnswers ? ', correct_option' : '';
  const { rows } = await query(`SELECT id, prompt, options, position${answerColumn} FROM quiz_questions WHERE manual_id = $1 ORDER BY position`, [manualId]);
  return rows;
}

export async function submitAttempt(userId, manualId, answers) {
  const questions = await listQuestions(manualId, true);
  if (!questions.length) return { score: 100, passed: true };
  const { correct, score, passed, total } = calculateQuizResult(questions, answers);
  await query('INSERT INTO quiz_attempts (user_id, manual_id, score, passed, answers) VALUES ($1, $2, $3, $4, $5::jsonb)', [userId, manualId, score, passed, JSON.stringify(answers)]);
  if (passed) {
    await query(
      `UPDATE manual_progress SET completed_at = COALESCE(completed_at, NOW()), last_access_at = NOW()
       WHERE user_id = $1 AND manual_id = $2 AND pdf_completed = TRUE AND video_progress >= 90`,
      [userId, manualId]
    );
  }
  return { score, passed, correct, total };
}
