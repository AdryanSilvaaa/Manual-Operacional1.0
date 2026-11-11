/**
 * Orquestra login, troca de senha, cadastro administrativo e leitura da sessão atual.
 * Validações mudam aqui; consultas e gravações de usuário ficam nos models.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createUser, findUserByIdentifier, findUserById, findUserCredentialsById, updatePassword } from '../models/User.js';
import { validateUserSectors, validateUserUnits } from './userController.js';
import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';
import { audit } from '../models/Audit.js';
import { BCRYPT_ROUNDS, isStrongPassword, validateUserIdentity } from '../utils/security.js';
import { canManageUserWithRole, VALID_ROLES } from '../utils/access.js';
import { JWT_ALGORITHM } from '../middleware/auth.js';

// Tentativas de login guardadas na memória desta instância (com várias instâncias, cada uma conta as suas).
// Por IP + usuário: 5 erros bloqueiam aquele login naquele IP por 15 minutos.
// Só por IP: 100 erros em 15 minutos bloqueiam o IP (impede testar uma senha em muitos usuários).
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_LOGIN = 5;
// Limite alto de propósito: no hospital muita gente sai pelo mesmo IP (NAT) e erros de digitação somam.
const MAX_FAILURES_PER_IP = 100;

// Hash de uma senha qualquer, usado quando o usuário não existe: o login demora o mesmo tempo nos dois casos
// e ninguém descobre quais logins existem medindo o tempo de resposta.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('senha-inexistente-para-tempo-constante', BCRYPT_ROUNDS);

// Remove registros vencidos para o mapa não crescer sem limite sob muitas tentativas.
setInterval(() => {
  const now = Date.now();
  for (const [key, attempt] of loginAttempts) {
    if (attempt.blockedUntil <= now && now - attempt.lastFailureAt > LOGIN_WINDOW_MS) loginAttempts.delete(key);
  }
}, 5 * 60 * 1000).unref();

/** Soma uma falha na chave (IP ou IP + login) e bloqueia ao chegar no limite. */
function registerFailure(key, limit) {
  const now = Date.now();
  const previous = loginAttempts.get(key);
  // Falhas antigas (fora da janela) não contam mais.
  const failures = previous && now - previous.lastFailureAt <= LOGIN_WINDOW_MS ? previous.failures + 1 : 1;
  loginAttempts.set(key, { failures, lastFailureAt: now, blockedUntil: failures >= limit ? now + LOGIN_WINDOW_MS : 0 });
}

const isBlocked = (key) => loginAttempts.get(key)?.blockedUntil > Date.now();

/** Token de sessão válido por 8 horas (um turno). Leva só o id e o nome; perfil e setores são relidos do banco. */
function signToken(user) {
  return jwt.sign(
    { id: user.id, nome: user.nome, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '8h', algorithm: JWT_ALGORITHM }
  );
}

// Autentica pelo identificador textual escolhido no cadastro, sem exigir e-mail.
export async function login(req, res) {
  const { identificador, senha } = req.body || {};

  // Os dois campos precisam ser texto (um objeto JSON aqui derrubaria a validação mais abaixo).
  if (typeof identificador !== 'string' || typeof senha !== 'string' || !identificador.trim() || !senha) {
    return res.status(400).json({ message: 'Usuario e senha sao obrigatorios' });
  }

  const login = identificador.trim();
  const ipKey = `ip:${req.ip}`;
  const attemptKey = `${req.ip}:${login.toLowerCase()}`;
  if (isBlocked(ipKey) || isBlocked(attemptKey)) return res.status(429).json({ message: 'Muitas tentativas. Aguarde 15 minutos.' });

  let user;
  try {
    user = await findUserByIdentifier(login);
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    user = demoStore.findUserByIdentifier(login);
  }
  // Compara sempre (com o hash falso se o usuário não existe) para o tempo de resposta não revelar nada.
  const validPassword = await bcrypt.compare(senha, user?.senha || DUMMY_PASSWORD_HASH);

  if (!user || !validPassword) {
    registerFailure(attemptKey, MAX_FAILURES_PER_LOGIN);
    registerFailure(ipKey, MAX_FAILURES_PER_IP);
    return res.status(401).json({ message: 'Credenciais invalidas' });
  }
  loginAttempts.delete(attemptKey);
  audit(user.id, 'login', 'user', user.id).catch(() => {});

  // Setores incluídos para as telas que dependem deles (Criar Manual, Modelos de Prova) funcionarem logo após o login.
  res.json({ token: signToken(user), user: await loadProfile(user.id) });
}

/** Troca da própria senha: confere a atual, exige a política de senha forte e libera o acesso se a senha era provisória. */
export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({ message: 'A nova senha deve ter 8 caracteres, uma letra e um número' });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ message: 'A nova senha precisa ser diferente da atual' });
  }
  // Mesmo bloqueio do login: impede adivinhar a senha atual de quem deixou a sessão aberta.
  const attemptKey = `password:${req.user.id}`;
  if (isBlocked(attemptKey)) return res.status(429).json({ message: 'Muitas tentativas. Aguarde 15 minutos.' });

  const user = await findUserCredentialsById(req.user.id);
  if (!user || typeof currentPassword !== 'string' || !await bcrypt.compare(currentPassword, user.senha)) {
    registerFailure(attemptKey, MAX_FAILURES_PER_LOGIN);
    return res.status(400).json({ message: 'Senha atual incorreta' });
  }
  loginAttempts.delete(attemptKey);
  await updatePassword(user.id, await bcrypt.hash(newPassword, BCRYPT_ROUNDS));
  await audit(user.id, 'password_changed', 'user', user.id);
  res.status(204).send();
}

/** Cadastro de um usuário pela tela Usuários (admin ou administrador de cadastros). A senha informada é provisória. */
export async function registerManagerUser(req, res) {
  const { senha, role = 'usuario' } = req.body || {};

  const identity = validateUserIdentity(req.body);
  if (identity.error || !senha) {
    return res.status(400).json({ message: identity.error || 'Nome, usuario e senha sao obrigatorios' });
  }
  const { nome, identificador } = identity;

  if (!isStrongPassword(senha)) {
    return res.status(400).json({ message: 'A senha deve ter 8 caracteres, uma letra e um número' });
  }

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ message: 'Role invalida' });
  }

  if (!canManageUserWithRole(req.user, role)) {
    return res.status(403).json({ message: 'Só o perfil Admin pode criar usuários Admin' });
  }

  const sectors = await validateUserSectors(role, req.body.sectorIds);
  if (sectors.error) return res.status(400).json({ message: sectors.error });
  const units = await validateUserUnits(role, req.body.unitIds);
  if (units.error) return res.status(400).json({ message: units.error });

  const senhaHash = await bcrypt.hash(senha, BCRYPT_ROUNDS);
  let user;
  try {
    user = await createUser({ nome, identificador, senhaHash, role, sectorIds: sectors.ids, unitIds: units.ids });
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    user = demoStore.createUser({ nome, identificador, senhaHash, role, sectorIds: sectors.ids, unitIds: units.ids });
  }

  audit(req.user.id, 'user_created', 'user', user.id, { role }).catch(() => {});
  res.status(201).json(user);
}

/** Dados do usuário sem senha, com sector_ids, setores, unit_ids e unidades ({ id, nome }). */
async function loadProfile(id) {
  try {
    return await findUserById(id);
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    return demoStore.findUserById(id);
  }
}

/** Sessão atual: usado pelo frontend ao abrir o site para saber quem está logado. */
export async function me(req, res) {
  res.json(await loadProfile(req.user.id));
}
