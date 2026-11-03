/** Regras de prova compartilhadas pelas telas; mantenha igual a backend/src/utils/exam.js. */
export const MAX_QUESTIONS = 10;
export const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
export const QUESTION_TYPES = Object.freeze({ MULTIPLE_CHOICE: 'multipla_escolha', OPEN: 'aberta' });

export function formatDateTime(value) {
  return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
}
