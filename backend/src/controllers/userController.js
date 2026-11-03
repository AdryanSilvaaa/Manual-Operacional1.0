/**
 * Lista, atualiza e exclui usuários para a área de suporte.
 * Altere campos permitidos aqui; SQL e formato persistido ficam em models/User.js.
 */
import { randomInt } from 'crypto';
import bcrypt from 'bcryptjs';
import { createUsers, deleteUser, listUsers, updateUser } from '../models/User.js';
import { findSectorsByIds, listSectors } from '../models/Sector.js';
import { parseSectorIds, roleNeedsSector, VALID_ROLES } from '../utils/access.js';
import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';
import { audit } from '../models/Audit.js';
import { isStrongPassword } from '../utils/security.js';

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

export async function destroy(req, res) {
  if (Number(req.params.id) === Number(req.user.id)) {
    return res.status(400).json({ message: 'Voce nao pode remover o proprio usuario' });
  }

  try {
    await deleteUser(req.params.id);
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    demoStore.deleteUser(req.params.id);
  }

  res.status(204).send();
}

/**
 * Valida os setores de um usuário: operador e gerente de setor precisam de pelo menos um;
 * suporte e editor de conteúdo podem ficar sem setor. Os setores precisam existir (são criados na tela Setores).
 */
export async function validateUserSectors(role, value) {
  const ids = parseSectorIds(value);
  if (roleNeedsSector(role) && !ids.length) return { error: 'Selecione pelo menos um setor' };
  if (!ids.length) return { ids };
  const found = await findSectorsByIds(ids);
  if (found.length !== ids.length) return { error: 'Setor nao encontrado' };
  return { ids };
}

// Permite trocar os setores e os dados de identificacao de um usuario existente.
export async function update(req, res) {
  const { nome, identificador, role } = req.body;
  if (!nome || !identificador || !VALID_ROLES.includes(role)) {
    return res.status(400).json({ message: 'Nome, usuario e perfil validos sao obrigatorios' });
  }
  // Senha nova é opcional: vazia mantém a atual. Serve para o suporte redefinir a senha de quem esqueceu.
  const novaSenha = req.body.senha ? String(req.body.senha) : '';
  if (novaSenha && !isStrongPassword(novaSenha)) {
    return res.status(400).json({ message: 'A senha deve ter 8 caracteres, uma letra e um número' });
  }
  const sectors = await validateUserSectors(role, req.body.sectorIds);
  if (sectors.error) return res.status(400).json({ message: sectors.error });
  const senhaHash = novaSenha ? await bcrypt.hash(novaSenha, 10) : undefined;

  try {
    const user = await updateUser(req.params.id, { nome, identificador, role, sectorIds: sectors.ids, senhaHash });
    if (!user) return res.status(404).json({ message: 'Usuario nao encontrado' });
    if (senhaHash) await audit(req.user.id, 'password_reset', 'user', user.id);
    res.json(user);
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    const user = demoStore.updateUser(req.params.id, { nome, identificador, role, sectorIds: sectors.ids, senhaHash });
    if (!user) return res.status(404).json({ message: 'Usuario nao encontrado' });
    res.json(user);
  }
}

const IMPORT_MAX_ROWS = 500;
// Perfis aceitos na planilha, comparados sem acento e sem maiúsculas. Vazio vira operador.
const IMPORT_ROLES = {
  '': 'usuario', usuario: 'usuario', 'usuario comum': 'usuario', operador: 'usuario', colaborador: 'usuario',
  gerente: 'gerente_setor', 'gerente de setor': 'gerente_setor', gerente_setor: 'gerente_setor',
  editor: 'editor_conteudo', 'editor de conteudo': 'editor_conteudo', editor_conteudo: 'editor_conteudo',
  suporte: 'suporte', admin: 'suporte', administrador: 'suporte'
};
const ROLE_LABELS = { usuario: 'Usuário comum', gerente_setor: 'Gerente de setor', editor_conteudo: 'Editor de conteúdo', suporte: 'Suporte' };
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
    return { sectors: await listSectors(), users: await listUsers() };
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    return { sectors: demoStore.listSectors(), users: demoStore.listUsers() };
  }
}

/**
 * Confere cada linha da planilha: nome e login obrigatórios, login inédito (no banco e no arquivo),
 * perfil conhecido, setores existentes (pelo nome) e senha forte quando informada.
 */
function validateImportRows(rows, { sectors, users }) {
  const sectorByName = new Map(sectors.map((sector) => [normalizeText(sector.nome), sector]));
  const takenLogins = new Set(users.map((user) => user.identificador).filter(Boolean));
  const loginsInFile = new Set();

  return rows.map((row, index) => {
    const nome = String(row.nome ?? '').trim();
    const identificador = String(row.login ?? '').trim();
    const role = IMPORT_ROLES[normalizeText(row.perfil)];
    const sectorNames = String(row.setores ?? '').split(/[,|]/).map((name) => name.trim()).filter(Boolean);
    const found = sectorNames.map((name) => sectorByName.get(normalizeText(name)));
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
    else if (found.some((sector) => !sector)) erro = `Setor "${sectorNames[found.indexOf(undefined)]}" não existe (cadastre em Setores)`;
    else if (roleNeedsSector(role) && !result.sectorIds.length) erro = 'Informe pelo menos um setor';
    else if (senha && !isStrongPassword(senha)) erro = 'Senha fraca (8 caracteres, uma letra e um número)';

    if (identificador) loginsInFile.add(identificador);
    return { ...result, status: erro ? 'erro' : 'ok', erro };
  });
}

// Linha devolvida às telas, sem senha nem ids internos.
function publicImportRow({ linha, nome, login, perfil, setores, status, erro }) {
  return { linha, nome, login, perfil, setores, status, erro };
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

  const checked = validateImportRows(rows, await loadImportContext());
  const valid = checked.filter((row) => row.status === 'ok');
  if (req.body.dryRun || !valid.length) {
    return res.json({ dryRun: true, total: checked.length, validos: valid.length, rows: checked.map(publicImportRow) });
  }

  const toCreate = [];
  for (const row of valid) {
    const senha = row.senha || generatePassword();
    toCreate.push({ ...row, senhaGerada: row.senha ? null : senha, senhaHash: await bcrypt.hash(senha, 10) });
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
    acessos: toCreate.map((user) => ({ nome: user.nome, login: user.identificador, perfil: user.perfil, setores: user.setores, senha: user.senhaGerada }))
  });
}
