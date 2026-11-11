import test from 'node:test';
import assert from 'node:assert/strict';
import {
  can,
  canManageManual,
  canManageUserWithRole,
  canPublishToUnits,
  hasSector,
  hasUnit,
  normalizeRole,
  parseSectorIds,
  parseUnitIds,
  PERMISSIONS,
  reachesUserUnits,
  roleNeedsSector,
  roleNeedsUnit,
  rolesWith,
  seesAllSectors,
  seesAllUnits,
  VALID_ROLES
} from '../src/utils/access.js';

const P = PERMISSIONS;

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

test('perfis válidos batem com a restrição users_role_check do schema.sql', () => {
  assert.deepEqual([...VALID_ROLES].sort(), ['admin', 'admin_cadastros', 'editor_conteudo', 'gerente_setor', 'gestor_area', 'usuario']);
  VALID_ROLES.forEach((role) => assert.ok(role.length <= 20, `${role} cabe em users.role VARCHAR(20)`));
});

test('perfis legados suporte e gerente valem como admin', () => {
  assert.equal(normalizeRole('suporte'), 'admin');
  assert.equal(normalizeRole('gerente'), 'admin');
  assert.equal(can({ role: 'suporte' }, P.MANAGE_BRANDING), true);
});

test('seesAllSectors: só admin e editor de conteúdo', () => {
  assert.equal(seesAllSectors({ role: 'admin' }), true);
  assert.equal(seesAllSectors({ role: 'editor_conteudo' }), true);
  for (const role of ['admin_cadastros', 'gestor_area', 'gerente_setor', 'usuario']) {
    assert.equal(seesAllSectors({ role }), false, role);
  }
  assert.equal(roleNeedsSector('admin'), false);
  assert.equal(roleNeedsSector('admin_cadastros'), true);
  assert.equal(roleNeedsSector('gestor_area'), true);
});

test('administrador de cadastros: cadastros sim, painel e publicação não, faz prova', () => {
  const ti = { role: 'admin_cadastros', sector_ids: [7] };
  assert.equal(can(ti, P.MANAGE_USERS), true);
  assert.equal(can(ti, P.MANAGE_SECTORS), true);
  assert.equal(can(ti, P.MANAGE_SYSTEMS), true);
  assert.equal(can(ti, P.VIEW_REPORTS), false);
  assert.equal(can(ti, P.PUBLISH_CONTENT), false);
  assert.equal(can(ti, P.MANAGE_BRANDING), false);
  assert.equal(can(ti, P.TAKE_EXAMS), true);
  assert.equal(canManageManual(ti, [7]), false);
});

test('administrador de cadastros não cria, altera nem exclui admin', () => {
  const ti = { role: 'admin_cadastros' };
  assert.equal(canManageUserWithRole(ti, 'usuario'), true);
  assert.equal(canManageUserWithRole(ti, 'admin_cadastros'), true);
  assert.equal(canManageUserWithRole(ti, 'admin'), false);
  assert.equal(canManageUserWithRole(ti, 'suporte'), false);
  assert.equal(canManageUserWithRole({ role: 'admin' }, 'admin'), true);
  assert.equal(canManageUserWithRole({ role: 'gerente_setor' }, 'usuario'), false);
});

test('gestor de área vê painel dos seus setores e não publica', () => {
  const gestor = { role: 'gestor_area', sector_ids: [1, 2, 3] };
  assert.equal(can(gestor, P.VIEW_REPORTS), true);
  assert.equal(can(gestor, P.PUBLISH_CONTENT), false);
  assert.equal(can(gestor, P.MANAGE_USERS), false);
  assert.equal(can(gestor, P.TAKE_EXAMS), false);
  assert.equal(canManageManual(gestor, [1]), false);
});

test('quem faz prova: usuário comum e administrador de cadastros', () => {
  assert.deepEqual(rolesWith(P.TAKE_EXAMS).sort(), ['admin_cadastros', 'usuario']);
});

test('canManageManual libera admin e editor; gerente só quando todos os setores do manual são dele', () => {
  const gerente = { role: 'gerente_setor', sector_ids: [4, 5] };
  assert.equal(canManageManual({ role: 'admin' }, [1]), true);
  assert.equal(canManageManual({ role: 'editor_conteudo' }, [1, 2]), true);
  assert.equal(canManageManual(gerente, [4]), true);
  assert.equal(canManageManual(gerente, [4, 5]), true);
  assert.equal(canManageManual(gerente, [4, 2]), false);
  assert.equal(canManageManual(gerente, []), false);
  assert.equal(canManageManual({ role: 'usuario', sector_ids: [4] }, [4]), false);
});

test('unidades: admin e editor veem todas; os demais precisam de unidade', () => {
  assert.equal(seesAllUnits({ role: 'admin' }), true);
  assert.equal(seesAllUnits({ role: 'editor_conteudo' }), true);
  for (const role of ['admin_cadastros', 'gestor_area', 'gerente_setor', 'usuario']) {
    assert.equal(seesAllUnits({ role }), false, role);
    assert.equal(roleNeedsUnit(role), true, role);
  }
  assert.equal(can({ role: 'admin_cadastros' }, P.MANAGE_UNITS), true);
  assert.equal(can({ role: 'gerente_setor' }, P.MANAGE_UNITS), false);
});

test('manual sem unidade vale para todas; com unidades, só para quem é de uma delas', () => {
  const adryan = { role: 'usuario', sector_ids: [1], unit_ids: [10] };
  assert.equal(reachesUserUnits(adryan, []), true);
  assert.equal(reachesUserUnits(adryan, [10, 20]), true);
  assert.equal(reachesUserUnits(adryan, [20]), false);
  assert.equal(reachesUserUnits({ role: 'admin' }, [20]), true);
  assert.equal(hasUnit(adryan, '10'), true);
});

test('gerente publica só nas suas unidades ou para todas as unidades do setor', () => {
  const gerente = { role: 'gerente_setor', sector_ids: [1], unit_ids: [10, 11] };
  assert.equal(canPublishToUnits(gerente, []), true);
  assert.equal(canPublishToUnits(gerente, [10]), true);
  assert.equal(canPublishToUnits(gerente, [10, 12]), false);
  assert.equal(canManageManual(gerente, [1], []), true);
  assert.equal(canManageManual(gerente, [1], [11]), true);
  assert.equal(canManageManual(gerente, [1], [12]), false);
  assert.equal(canManageManual({ role: 'editor_conteudo' }, [5], [99]), true);
  assert.deepEqual(parseUnitIds(['3', 3, 'x']), [3]);
});
