import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeSubmission, isExamOpen, validateExamPayload } from '../src/utils/exam.js';

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
