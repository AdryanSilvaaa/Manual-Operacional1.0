import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateQuizResult, isStrongPassword } from '../src/utils/security.js';

test('exige senha com tamanho, letra e número', () => {
  assert.equal(isStrongPassword('curta1'), false);
  assert.equal(isStrongPassword('somenteletras'), false);
  assert.equal(isStrongPassword('Treino2026'), true);
});

test('aprova questionário a partir de 70 por cento', () => {
  const questions = Array.from({ length: 10 }, (_, id) => ({ id, correct_option: 1 }));
  const sevenCorrect = Object.fromEntries(questions.map((question, index) => [question.id, index < 7 ? 1 : 0]));
  assert.deepEqual(calculateQuizResult(questions, sevenCorrect), { score: 70, passed: true, correct: 7, total: 10 });
});
