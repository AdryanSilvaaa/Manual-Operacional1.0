import test from 'node:test';
import assert from 'node:assert/strict';
import { isStrongPassword } from '../src/utils/security.js';

test('exige senha com tamanho, letra e número', () => {
  assert.equal(isStrongPassword('curta1'), false);
  assert.equal(isStrongPassword('somenteletras'), false);
  assert.equal(isStrongPassword('Treino2026'), true);
});
