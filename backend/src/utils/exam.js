/**
 * Regras puras das provas: validação do cadastro e correção das respostas.
 * Alterar MAX_QUESTIONS ou os tipos exige ajustar os CHECK de exam_questions no schema.sql.
 */
export const MAX_QUESTIONS = 10;
export const QUESTION_TYPES = Object.freeze({ MULTIPLE_CHOICE: 'multipla_escolha', OPEN: 'aberta' });
/** Situação da entrega: começa em andamento e termina enviada pelo colaborador ou encerrada ao sair da página. */
export const SUBMISSION_STATUS = Object.freeze({ IN_PROGRESS: 'em_andamento', SENT: 'enviada', CLOSED: 'encerrada' });
const OPTION_COUNT = 4;

function isBlank(value) {
  return typeof value !== 'string' || !value.trim();
}

/** Valida e normaliza o corpo de criação; devolve { error } ou { exam }. */
export function validateExamPayload(body = {}) {
  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  const questions = body.questions;

  if (!titulo) return { error: 'Informe o título da prova' };
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return { error: 'Informe a data de início e a data final da prova' };
  }
  if (endsAt <= startsAt) return { error: 'A data final deve ser depois da data de início' };
  if (!Array.isArray(questions) || !questions.length) return { error: 'Cadastre ao menos uma pergunta' };
  if (questions.length > MAX_QUESTIONS) return { error: `A prova pode ter no máximo ${MAX_QUESTIONS} perguntas` };

  const normalized = [];
  for (const [index, question] of questions.entries()) {
    const number = index + 1;
    if (isBlank(question?.prompt)) return { error: `Preencha o enunciado da pergunta ${number}` };

    if (question.type === QUESTION_TYPES.OPEN) {
      normalized.push({ type: QUESTION_TYPES.OPEN, prompt: question.prompt.trim(), options: null, correctOption: null });
      continue;
    }
    if (question.type !== QUESTION_TYPES.MULTIPLE_CHOICE) return { error: `Tipo inválido na pergunta ${number}` };

    const options = question.options;
    const correctOption = Number(question.correctOption);
    if (!Array.isArray(options) || options.length !== OPTION_COUNT || options.some(isBlank)) {
      return { error: `Preencha as alternativas A, B, C e D da pergunta ${number}` };
    }
    if (!Number.isInteger(correctOption) || correctOption < 0 || correctOption >= OPTION_COUNT) {
      return { error: `Escolha a alternativa correta da pergunta ${number}` };
    }
    normalized.push({ type: QUESTION_TYPES.MULTIPLE_CHOICE, prompt: question.prompt.trim(), options: options.map((option) => option.trim()), correctOption });
  }

  const descricao = typeof body.descricao === 'string' && body.descricao.trim() ? body.descricao.trim() : null;
  return { exam: { titulo, descricao, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), questions: normalized } };
}

/** Indica se a prova pode ser respondida agora. */
export function isExamOpen(exam, now = new Date()) {
  return Boolean(exam?.active) && new Date(exam.starts_at) <= now && now <= new Date(exam.ends_at);
}

/**
 * Corrige as respostas recebidas como { [questionId]: indice | texto }. A nota considera só as de múltipla escolha.
 * No envio normal exige resposta em todas as perguntas. Com partial (prova encerrada ao sair da página),
 * guarda só o que foi respondido e conta as perguntas sem resposta como erradas.
 */
export function gradeSubmission(questions, answers = {}, { partial = false } = {}) {
  const graded = [];
  for (const [index, question] of questions.entries()) {
    const value = answers?.[question.id];
    if (question.type === QUESTION_TYPES.OPEN) {
      if (isBlank(value)) {
        if (partial) continue;
        return { error: `Responda a pergunta ${index + 1}` };
      }
      graded.push({ questionId: question.id, selectedOption: null, answerText: value.trim() });
      continue;
    }
    const selected = Number(value);
    if (value === undefined || value === null || value === '' || !Number.isInteger(selected) || selected < 0 || selected >= OPTION_COUNT) {
      if (partial) continue;
      return { error: `Responda a pergunta ${index + 1}` };
    }
    graded.push({ questionId: question.id, selectedOption: selected, answerText: null, correct: selected === Number(question.correct_option) });
  }
  return {
    answers: graded,
    objectiveTotal: questions.filter((question) => question.type !== QUESTION_TYPES.OPEN).length,
    objectiveCorrect: graded.filter((answer) => answer.correct).length
  };
}
