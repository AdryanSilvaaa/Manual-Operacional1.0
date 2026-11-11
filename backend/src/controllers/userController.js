/**
 * Lista, atualiza e exclui usuários (admin e administrador de cadastros).
 * Só o admin cria, altera ou exclui outro admin, ou dá o perfil admin a alguém (canManageUserWithRole).
 * Altere campos permitidos aqui; SQL e formato persistido ficam em models/User.js.
 */
import { randomInt } from 'crypto';
import bcrypt from 'bcryptjs';
import { createUsers, deleteUser, findUserById, listUsers, updateUser } from '../models/User.js';
import { findSectorsByIds, listSectors } from '../models/Sector.js';
import { findUnitsByIds, listUnits } from '../models/Unit.js';
import { canManageUserWithRole, parseSectorIds, parseUnitIds, normalizeRole, ROLE_LABELS, ROLES, roleNeedsSector, roleNeedsUnit, VALID_ROLES } from '../utils/access.js';
import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';
import { audit } from '../models/Audit.js';
import { BCRYPT_ROUNDS, isStrongPassword, validateUserIdentity } from '../utils/security.js';

/** Lista todos os usuários (sem senha) para a tela Usuários. */
export async function index(req, res) {
  let users;
  try {
    users = await listUsers();
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    users = demoStore.listUsers();
  }

  res.json(users);
}

const ADMIN_ONLY_MESSAGE = 'Só o perfil Admin pode criar, alterar ou excluir usuários Admin';

/** Usuário alvo da alteração (null se não existe). */
async function loadTargetUser(id) {
  try {
    return await findUserById(id);
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    return demoStore.findUserById(id);
  }
}

/** Exclui um usuário. Ninguém exclui a si mesmo e só o admin exclui outro admin. */
export async function destroy(req, res) {
  if (Number(req.params.id) === Number(req.user.id)) {
    return res.status(400).json({ message: 'Voce nao pode remover o proprio usuario' });
  }
  const target = await loadTargetUser(req.params.id);
  if (!target) return res.status(404).json({ message: 'Usuario nao encontrado' });
  if (!canManageUserWithRole(req.user, target.role)) return res.status(403).json({ message: ADMIN_ONLY_MESSAGE });

  try {
    await deleteUser(req.params.id);
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    demoStore.deleteUser(req.params.id);
  }

  audit(req.user.id, 'user_deleted', 'user', target.id, { nome: target.nome, role: target.role }).catch(() => {});
  res.status(204).send();
}

/**
 * Valida os setores de um usuário: só admin e editor de conteúdo (que enxergam todos os setores) podem ficar sem setor;
 * os demais perfis precisam de pelo menos um. Os setores precisam existir (são criados na tela Setores).
 */
export async function validateUserSectors(role, value) {
  const ids = parseSectorIds(value);
  if (roleNeedsSector(role) && !ids.length) return { error: 'Selecione pelo menos um setor' };
  if (!ids.length) return { ids };
  const found = await findSectorsByIds(ids);
  if (found.length !== ids.length) return { error: 'Setor nao encontrado' };
  return { ids };
}

/**
 * Valida as unidades de um usuário: admin e editor de conteúdo (que enxergam todas) podem ficar sem unidade;
 * os demais perfis precisam de pelo menos uma. Quando a empresa tem uma unidade só, ela é usada automaticamente,
 * assim quem não trabalha com filiais nem precisa escolher.
 */
export async function validateUserUnits(role, value) {
  let ids = parseUnitIds(value);
  if (!ids.length && roleNeedsUnit(role)) {
    const all = await listUnits();
    if (all.length === 1) ids = [all[0].id];
    else return { error: 'Selecione pelo menos uma unidade' };
  }
  if (!ids.length) return { ids };
  const found = await findUnitsByIds(ids);
  if (found.length !== ids.length) return { error: 'Unidade não encontrada' };
  return { ids };
}

// Permite trocar os setores, as unidades e os dados de identificacao de um usuario existente.
export async function update(req, res) {
  const { role } = req.body || {};
  const identity = validateUserIdentity(req.body);
  if (identity.error) return res.status(400).json({ message: identity.error });
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ message: 'Nome, usuario e perfil validos sao obrigatorios' });
  }
  const { nome, identificador } = identity;
  // Quem não é admin não altera um admin nem promove alguém (ou a si mesmo) a admin.
  const target = await loadTargetUser(req.params.id);
  if (!target) return res.status(404).json({ message: 'Usuario nao encontrado' });
  if (!canManageUserWithRole(req.user, target.role) || !canManageUserWithRole(req.user, role)) {
    return res.status(403).json({ message: ADMIN_ONLY_MESSAGE });
  }
  // Ninguém troca o próprio perfil: evita aumentar o próprio acesso e o admin se trancar para fora.
  if (Number(target.id) === Number(req.user.id) && role !== normalizeRole(target.role)) {
    return res.status(400).json({ message: 'Você não pode alterar o próprio perfil' });
  }
  // Senha nova é opcional: vazia mantém a atual. Serve para quem cadastra usuários redefinir a senha de quem esqueceu.
  const novaSenha = req.body.senha ? String(req.body.senha) : '';
  if (novaSenha && !isStrongPassword(novaSenha)) {
    return res.status(400).json({ message: 'A senha deve ter 8 caracteres, uma letra e um número' });
  }
  const sectors = await validateUserSectors(role, req.body.sectorIds);
  if (sectors.error) return res.status(400).json({ message: sectors.error });
  // Sem unitIds na requisição (tela antiga), as unidades atuais são mantidas.
  const units = await validateUserUnits(role, req.body.unitIds === undefined ? target.unit_ids : req.body.unitIds);
  if (units.error) return res.status(400).json({ message: units.error });
  const senhaHash = novaSenha ? await bcrypt.hash(novaSenha, BCRYPT_ROUNDS) : undefined;
  // Senha redefinida para outra pessoa é provisória (ela troca no próximo acesso); para si mesmo, não.
  const provisional = Number(target.id) !== Number(req.user.id);

  try {
    const user = await updateUser(req.params.id, { nome, identificador, role, sectorIds: sectors.ids, unitIds: units.ids, senhaHash, provisional });
    if (!user) return res.status(404).json({ message: 'Usuario nao encontrado' });
    if (senhaHash) await audit(req.user.id, 'password_reset', 'user', user.id);
    if (role !== normalizeRole(target.role)) {
      await audit(req.user.id, 'user_role_changed', 'user', user.id, { de: normalizeRole(target.role), para: role });
    }
    res.json(user);
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    const user = demoStore.updateUser(req.params.id, { nome, identificador, role, sectorIds: sectors.ids, unitIds: units.ids, senhaHash });
    if (!user) return res.status(404).json({ message: 'Usuario nao encontrado' });
    res.json(user);
  }
}

const IMPORT_MAX_ROWS = 500;
// Perfis aceitos na planilha, comparados sem acento e sem maiúsculas. Vazio vira operador.
const IMPORT_ROLES = {
  '': ROLES.USER, usuario: ROLES.USER, 'usuario comum': ROLES.USER, operador: ROLES.USER, colaborador: ROLES.USER,
  gerente: ROLES.SECTOR_MANAGER, 'gerente de setor': ROLES.SECTOR_MANAGER, gerente_setor: ROLES.SECTOR_MANAGER,
  gestor: ROLES.AREA_MANAGER, 'gestor de area': ROLES.AREA_MANAGER, gestor_area: ROLES.AREA_MANAGER,
  editor: ROLES.CONTENT_EDITOR, 'editor de conteudo': ROLES.CONTENT_EDITOR, editor_conteudo: ROLES.CONTENT_EDITOR,
  'administrador de cadastros': ROLES.USER_ADMIN, 'admin de cadastros': ROLES.USER_ADMIN, admin_cadastros: ROLES.USER_ADMIN,
  cadastros: ROLES.USER_ADMIN, ti: ROLES.USER_ADMIN,
  admin: ROLES.ADMIN, administrador: ROLES.ADMIN, suporte: ROLES.ADMIN
};
// Sem letras e números que se confundem (l, I, O, 0, 1), para a senha ser ditada ou copiada sem erro.
const PASSWORD_LETTERS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const PASSWORD_DIGITS = '23456789';

function normalizeText(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** Senha provisória que já cumpre a política: 5 letras e 3 números. */
function generatePassword() {
  const pick = (chars, count) => Array.from({ length: count }, () => chars[randomInt(chars.length)]).join('');
  return pick(PASSWORD_LETTERS, 5) + pick(PASSWORD_DIGITS, 3);
}

async function loadImportContext() {
  try {
    return { sectors: await listSectors(), users: await listUsers(), units: await listUnits() };
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    return { sectors: demoStore.listSectors(), users: demoStore.listUsers(), units: demoStore.listUnits() };
  }
}

/**
 * Confere cada linha da planilha: nome e login obrigatórios, login inédito (no banco e no arquivo),
 * perfil conhecido, setores e unidades existentes (pelo nome) e senha forte quando informada.
 * Coluna unidades vazia: com uma unidade só cadastrada, ela é usada; com várias, é obrigatória (exceto para quem vê todas).
 */
function validateImportRows(rows, { sectors, users, units = [] }, actor) {
  const sectorByName = new Map(sectors.map((sector) => [normalizeText(sector.nome), sector]));
  const unitByName = new Map(units.map((unit) => [normalizeText(unit.nome), unit]));
  const takenLogins = new Set(users.map((user) => user.identificador).filter(Boolean));
  const loginsInFile = new Set();

  return rows.map((row, index) => {
    const nome = String(row.nome ?? '').trim();
    const identificador = String(row.login ?? '').trim();
    const role = IMPORT_ROLES[normalizeText(row.perfil)];
    const sectorNames = String(row.setores ?? '').split(/[,|]/).map((name) => name.trim()).filter(Boolean);
    const found = sectorNames.map((name) => sectorByName.get(normalizeText(name)));
    const unitNames = String(row.unidades ?? '').split(/[,|]/).map((name) => name.trim()).filter(Boolean);
    const foundUnits = unitNames.map((name) => unitByName.get(normalizeText(name)));
    const unitsFromFile = foundUnits.filter(Boolean);
    const defaultUnits = !unitNames.length && role && roleNeedsUnit(role) && units.length === 1 ? [units[0]] : [];
    const chosenUnits = unitsFromFile.length ? unitsFromFile : defaultUnits;
    const senha = String(row.senha ?? '').trim();
    const result = {
      linha: Number(row.linha) || index + 2,
      nome,
      login: identificador,
      identificador,
      perfil: ROLE_LABELS[role] || String(row.perfil ?? ''),
      setores: found.filter(Boolean).map((sector) => sector.nome),
      role,
      sectorIds: [...new Set(found.filter(Boolean).map((sector) => sector.id))],
      unidades: chosenUnits.map((unit) => unit.nome),
      unitIds: [...new Set(chosenUnits.map((unit) => unit.id))],
      senha
    };

    let erro = '';
    if (!nome) erro = 'Nome vazio';
    else if (nome.length > 120) erro = 'Nome com mais de 120 caracteres';
    else if (!identificador) erro = 'Login vazio';
    else if (identificador.length > 160 || /\s/.test(identificador)) erro = 'Login inválido (sem espaços, até 160 caracteres)';
    else if (takenLogins.has(identificador)) erro = 'Login já cadastrado no sistema';
    else if (loginsInFile.has(identificador)) erro = 'Login repetido na planilha';
    else if (!role) erro = `Perfil "${row.perfil}" não reconhecido`;
    else if (!canManageUserWithRole(actor, role)) erro = 'Só o perfil Admin pode cadastrar usuários Admin';
    else if (found.some((sector) => !sector)) erro = `Setor "${sectorNames[found.indexOf(undefined)]}" não existe (cadastre em Setores)`;
    else if (roleNeedsSector(role) && !result.sectorIds.length) erro = 'Informe pelo menos um setor';
    else if (foundUnits.some((unit) => !unit)) erro = `Unidade "${unitNames[foundUnits.indexOf(undefined)]}" não existe (cadastre em Unidades)`;
    else if (roleNeedsUnit(role) && !result.unitIds.length) erro = 'Informe pelo menos uma unidade';
    else if (senha && !isStrongPassword(senha)) erro = 'Senha fraca (8 caracteres, uma letra e um número)';

    if (identificador) loginsInFile.add(identificador);
    return { ...result, status: erro ? 'erro' : 'ok', erro };
  });
}

// Linha devolvida às telas, sem senha nem ids internos.
function publicImportRow({ linha, nome, login, perfil, setores, unidades, status, erro }) {
  return { linha, nome, login, perfil, setores, unidades, status, erro };
}

/**
 * Cadastro em massa a partir da planilha. Com dryRun só confere e devolve a situação de cada linha.
 * Sem dryRun grava, numa transação, apenas as linhas válidas e devolve as senhas provisórias geradas
 * para quem veio sem senha (é a única vez que elas aparecem).
 */
export async function importUsers(req, res) {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ message: 'A planilha não tem linhas para importar' });
  if (rows.length > IMPORT_MAX_ROWS) {
    return res.status(400).json({ message: `Importe no máximo ${IMPORT_MAX_ROWS} usuários por vez` });
  }

  const checked = validateImportRows(rows, await loadImportContext(), req.user);
  const valid = checked.filter((row) => row.status === 'ok');
  if (req.body.dryRun || !valid.length) {
    return res.json({ dryRun: true, total: checked.length, validos: valid.length, rows: checked.map(publicImportRow) });
  }

  const toCreate = [];
  for (const row of valid) {
    const senha = row.senha || generatePassword();
    toCreate.push({ ...row, senhaGerada: row.senha ? null : senha, senhaHash: await bcrypt.hash(senha, BCRYPT_ROUNDS) });
  }

  try {
    await createUsers(toCreate);
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    toCreate.forEach((user) => demoStore.createUser(user));
  }
  await audit(req.user.id, 'users_imported', 'user', null, { quantidade: toCreate.length }).catch(() => {});

  res.status(201).json({
    dryRun: false,
    total: checked.length,
    criados: toCreate.length,
    rows: checked.map(publicImportRow),
    acessos: toCreate.map((user) => ({ nome: user.nome, login: user.identificador, perfil: user.perfil, setores: user.setores, unidades: user.unidades, senha: user.senhaGerada }))
  });
}
