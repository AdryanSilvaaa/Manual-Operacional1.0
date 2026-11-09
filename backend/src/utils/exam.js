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

const isEmpty = (value) => value === undefined || value === null || value === '';
const cleanText = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
/** Id inteiro positivo ou null. */
export function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Valida e normaliza as perguntas (prova ou modelo); devolve { error } ou { questions }. */
export function validateQuestions(questions) {
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
  return { questions: normalized };
}

/**
 * Valida e normaliza o corpo de criação; devolve { error } ou { exam }.
 * Com forManual (prova cadastrada junto com o manual), não há período: a prova começa no cadastro e não expira
 * (endsAt null), ficando disponível até o colaborador fazer. Ela é liberada quando ele conclui 100% do manual;
 * required diz se ele precisa fazê-la na hora ou pode deixar para depois. Datas enviadas são ignoradas.
 */
export function validateExamPayload(body = {}, { forManual = false } = {}) {
  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
  const startsAt = forManual ? new Date() : new Date(body.startsAt);
  const endsAt = forManual ? null : new Date(body.endsAt);
  const questions = body.questions;

  if (!titulo) return { error: 'Informe o título da prova' };
  if (Number.isNaN(startsAt.getTime()) || (endsAt !== null && Number.isNaN(endsAt.getTime()))) {
    return { error: 'Informe a data de início e a data final da prova' };
  }
  if (endsAt !== null && endsAt <= startsAt) return { error: 'A data final deve ser depois da data de início' };
  const checked = validateQuestions(questions);
  if (checked.error) return checked;
  const normalized = checked.questions;

  const descricao = cleanText(body.descricao);
  const exam = { titulo, descricao, startsAt: startsAt.toISOString(), endsAt: endsAt ? endsAt.toISOString() : null, questions: normalized };
  if (!forManual) {
    const audience = parseAudience(body);
    if (audience.error) return audience;
    exam.userIds = audience.userIds;
  }
  if (forManual) {
    exam.required = body.required === true || body.required === 'true';
    // Prova do manual montada a partir de um modelo: o controller confere se o modelo é do setor de quem cadastra.
    exam.templateId = parseId(body.templateId);
  }
  return { exam };
}

/** Indica se a prova pode ser respondida agora. ends_at nulo (prova de manual sem prazo) não expira. */
export function isExamOpen(exam, now = new Date()) {
  return Boolean(exam?.active) && new Date(exam.starts_at) <= now && (!exam.ends_at || now <= new Date(exam.ends_at));
}

/** Prova enviada junto com o cadastro do manual: chega como objeto (JSON) ou texto JSON (multipart). */
export function parseManualExam(value) {
  if (isEmpty(value)) return { exam: null };
  let body = value;
  if (typeof value === 'string') {
    try { body = JSON.parse(value); } catch { return { error: 'Prova do manual inválida' }; }
  }
  if (!body || typeof body !== 'object') return { error: 'Prova do manual inválida' };
  return validateExamPayload(body, { forManual: true });
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

/** Modelo de prova: título, descrição e perguntas (sem período). Devolve { error } ou { template }. */
export function validateTemplatePayload(body = {}) {
  const titulo = cleanText(body.titulo);
  if (!titulo) return { error: 'Informe o título do modelo' };
  const checked = validateQuestions(body.questions);
  if (checked.error) return checked;
  return { template: { titulo, descricao: cleanText(body.descricao), questions: checked.questions } };
}

/**
 * Para quem vai a prova avulsa: audience "colaboradores" exige ao menos um colaborador em userIds;
 * "setor" (padrão) vale para todo o setor escolhido. Devolve { error } ou { userIds } (vazio = setor todo).
 */
export function parseAudience(body = {}) {
  if (body.audience !== 'colaboradores') return { userIds: [] };
  const list = Array.isArray(body.userIds) ? body.userIds : [];
  const userIds = [...new Set(list.map(parseId).filter(Boolean))];
  return userIds.length ? { userIds } : { error: 'Escolha pelo menos um colaborador' };
}
