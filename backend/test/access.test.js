import test from 'node:test';
import assert from 'node:assert/strict';
import { hasSector, isSupport, parseSectorIds } from '../src/utils/access.js';

test('parseSectorIds aceita lista, valor único ou vazio e remove repetidos e inválidos', () => {
  assert.deepEqual(parseSectorIds([1, '2', 2, 'x', 0, -3]), [1, 2]);
  assert.deepEqual(parseSectorIds('5'), [5]);
  assert.deepEqual(parseSectorIds(undefined), []);
  assert.deepEqual(parseSectorIds(''), []);
});

test('hasSector considera todos os setores do usuário', () => {
  const user = { role: 'usuario', sector_ids: [1, 3] };
  assert.equal(hasSector(user, 3), true);
  assert.equal(hasSector(user, '1'), true);
  assert.equal(hasSector(user, 2), false);
  assert.equal(hasSector({ role: 'usuario' }, 1), false);
});

test('isSupport reconhece suporte e o perfil legado gerente', () => {
  assert.equal(isSupport({ role: 'suporte' }), true);
  assert.equal(isSupport({ role: 'gerente' }), true);
  assert.equal(isSupport({ role: 'gerente_setor' }), false);
});
