import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageManual, hasSector, parseSectorIds, seesAllSectors } from '../src/utils/access.js';

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

test('seesAllSectors reconhece suporte, editor de conteúdo e o perfil legado gerente', () => {
  assert.equal(seesAllSectors({ role: 'suporte' }), true);
  assert.equal(seesAllSectors({ role: 'editor_conteudo' }), true);
  assert.equal(seesAllSectors({ role: 'gerente' }), true);
  assert.equal(seesAllSectors({ role: 'gerente_setor' }), false);
  assert.equal(seesAllSectors({ role: 'usuario' }), false);
});

test('canManageManual libera suporte e editor; gerente só quando todos os setores do manual são dele', () => {
  const gerente = { role: 'gerente_setor', sector_ids: [4, 5] };
  assert.equal(canManageManual({ role: 'suporte' }, [1]), true);
  assert.equal(canManageManual({ role: 'editor_conteudo' }, [1, 2]), true);
  assert.equal(canManageManual(gerente, [4]), true);
  assert.equal(canManageManual(gerente, [4, 5]), true);
  assert.equal(canManageManual(gerente, [4, 2]), false);
  assert.equal(canManageManual(gerente, []), false);
  assert.equal(canManageManual({ role: 'usuario', sector_ids: [4] }, [4]), false);
});
