import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeSubmission, isExamOpen, parseManualExam, validateApplyPayload, validateExamPayload, validateTemplatePayload } from '../src/utils/exam.js';

const multipleChoice = { type: 'multipla_escolha', prompt: 'Qual opção?', options: ['A', 'B', 'C', 'D'], correctOption: 2 };
const open = { type: 'aberta', prompt: 'Explique o procedimento.' };
const base = { titulo: 'Prova de faturamento', startsAt: '2026-10-20T08:00:00-03:00', endsAt: '2026-10-21T18:00:00-03:00' };

test('aceita prova com múltipla escolha e resposta aberta', () => {
  const { error, exam } = validateExamPayload({ ...base, questions: [multipleChoice, open] });
  assert.equal(error, undefined);
  assert.equal(exam.questions.length, 2);
  assert.deepEqual(exam.questions[1], { type: 'aberta', prompt: 'Explique o procedimento.', options: null, correctOption: null });
});

test('limita a prova a 10 perguntas', () => {
  const { error } = validateExamPayload({ ...base, questions: Array(11).fill(multipleChoice) });
  assert.match(error, /no máximo 10/);
});

test('exige 4 alternativas preenchidas e a correta entre A e D', () => {
  assert.match(validateExamPayload({ ...base, questions: [{ ...multipleChoice, options: ['A', 'B', 'C'] }] }).error, /alternativas/);
  assert.match(validateExamPayload({ ...base, questions: [{ ...multipleChoice, correctOption: 4 }] }).error, /correta/);
});

test('exige data final depois da data de início', () => {
  const { error } = validateExamPayload({ ...base, endsAt: base.startsAt, questions: [open] });
  assert.match(error, /data final/);
});

test('considera o período e se a prova está ativa', () => {
  const exam = { active: true, starts_at: '2026-10-20T11:00:00Z', ends_at: '2026-10-21T21:00:00Z' };
  assert.equal(isExamOpen(exam, new Date('2026-10-20T12:00:00Z')), true);
  assert.equal(isExamOpen(exam, new Date('2026-10-22T12:00:00Z')), false);
  assert.equal(isExamOpen({ ...exam, active: false }, new Date('2026-10-20T12:00:00Z')), false);
});

test('corrige só as perguntas de múltipla escolha e exige todas as respostas', () => {
  const questions = [
    { id: 1, type: 'multipla_escolha', correct_option: 2 },
    { id: 2, type: 'multipla_escolha', correct_option: 0 },
    { id: 3, type: 'aberta', correct_option: null }
  ];
  const result = gradeSubmission(questions, { 1: 2, 2: 3, 3: 'Resposta livre' });
  assert.equal(result.objectiveTotal, 2);
  assert.equal(result.objectiveCorrect, 1);
  assert.equal(result.answers[2].answerText, 'Resposta livre');
  assert.match(gradeSubmission(questions, { 1: 2, 2: 0 }).error, /pergunta 3/);
});

test('prova encerrada ao sair guarda só o que foi respondido e conta o resto como errado', () => {
  const questions = [
    { id: 1, type: 'multipla_escolha', correct_option: 2 },
    { id: 2, type: 'multipla_escolha', correct_option: 0 },
    { id: 3, type: 'aberta', correct_option: null }
  ];
  const result = gradeSubmission(questions, { 1: 2 }, { partial: true });
  assert.equal(result.error, undefined);
  assert.equal(result.objectiveTotal, 2);
  assert.equal(result.objectiveCorrect, 1);
  assert.deepEqual(result.answers.map((answer) => answer.questionId), [1]);
  assert.equal(gradeSubmission(questions, undefined, { partial: true }).answers.length, 0);
});

test('prova do manual: período opcional, sem prazo final e flag de obrigatória', () => {
  const { error, exam } = parseManualExam(JSON.stringify({ titulo: 'Prova do manual', required: true, questions: [multipleChoice] }));
  assert.equal(error, undefined);
  assert.equal(exam.required, true);
  assert.equal(exam.endsAt, null);
  assert.ok(!Number.isNaN(new Date(exam.startsAt).getTime()));
  assert.equal(parseManualExam({ titulo: 'Opcional', required: 'false', questions: [open] }).exam.required, false);
});

test('prova do manual: ausente, texto inválido e sem perguntas', () => {
  assert.deepEqual(parseManualExam(undefined), { exam: null });
  assert.deepEqual(parseManualExam(''), { exam: null });
  assert.match(parseManualExam('{quebrado').error, /inválida/);
  assert.match(parseManualExam({ titulo: 'Sem perguntas', questions: [] }).error, /ao menos uma pergunta/);
});

test('prova sem prazo final continua aberta depois de começar', () => {
  const exam = { active: true, starts_at: '2026-01-01T00:00:00Z', ends_at: null };
  assert.equal(isExamOpen(exam, new Date('2030-01-01T00:00:00Z')), true);
  assert.equal(isExamOpen(exam, new Date('2025-12-31T00:00:00Z')), false);
});

test('prova avulsa continua exigindo início e fim', () => {
  assert.match(validateExamPayload({ titulo: 'Avulsa', questions: [open] }).error, /data de início/);
});


test('prova do manual: nunca tem prazo, mesmo se vier data final', () => {
  const soon = new Date(Date.now() + 20 * 1000).toISOString();
  const { error, exam } = parseManualExam({ titulo: 'Sem prazo', questions: [open], startsAt: '2020-01-01T00:00:00Z', endsAt: soon });
  assert.equal(error, undefined);
  assert.equal(exam.endsAt, null);
  assert.ok(new Date(exam.startsAt) > new Date('2025-01-01T00:00:00Z'));
});

test('modelo de prova: exige título e perguntas válidas, sem período', () => {
  assert.match(validateTemplatePayload({ questions: [open] }).error, /título do modelo/);
  assert.match(validateTemplatePayload({ titulo: 'Modelo', questions: [] }).error, /ao menos uma pergunta/);
  const { template } = validateTemplatePayload({ titulo: ' Integração ', questions: [multipleChoice, open] });
  assert.equal(template.titulo, 'Integração');
  assert.equal(template.questions.length, 2);
});

test('aplicar modelo: colaboradores específicos exigem ao menos um; setor ignora a lista', () => {
  const period = { startsAt: base.startsAt, endsAt: base.endsAt };
  assert.match(validateApplyPayload({ ...period, audience: 'colaboradores', userIds: [] }).error, /pelo menos um colaborador/);
  assert.deepEqual(validateApplyPayload({ ...period, userIds: ['3', 3, 'x', 5] }).application.userIds, [3, 5]);
  assert.deepEqual(validateApplyPayload({ ...period, audience: 'setor', userIds: [3] }).application.userIds, []);
  assert.match(validateApplyPayload({ audience: 'setor' }).error, /data de início/);
  assert.match(validateApplyPayload({ ...period, endsAt: base.startsAt, audience: 'setor' }).error, /data final/);
});
