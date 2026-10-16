/**
 * Orquestra login, cadastro administrativo e leitura da sessão atual.
 * Validações mudam aqui; consultas e gravações de usuário ficam nos models.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createUser, findUserByIdentifier, findUserById, updatePassword } from '../models/User.js';
import { validateUserSectors } from './userController.js';
import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';
import { audit } from '../models/Audit.js';
import { isStrongPassword } from '../utils/security.js';

const loginAttempts = new Map();

function signToken(user) {
  return jwt.sign(
    { id: user.id, nome: user.nome, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}

// Autentica pelo identificador textual escolhido no cadastro, sem exigir e-mail.
export async function login(req, res) {
  const { identificador, senha } = req.body;

  if (!identificador || !senha) {
    return res.status(400).json({ message: 'Usuario e senha sao obrigatorios' });
  }

  const attemptKey = `${req.ip}:${identificador.toLowerCase()}`;
  const attempt = loginAttempts.get(attemptKey);
  if (attempt?.blockedUntil > Date.now()) return res.status(429).json({ message: 'Muitas tentativas. Aguarde 15 minutos.' });

  let user;
  try {
    user = await findUserByIdentifier(identificador);
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    user = demoStore.findUserByIdentifier(identificador);
  }
  const validPassword = user && await bcrypt.compare(senha, user.senha);

  if (!validPassword) {
    const failures = (attempt?.failures || 0) + 1;
    loginAttempts.set(attemptKey, { failures, blockedUntil: failures >= 5 ? Date.now() + 15 * 60 * 1000 : 0 });
    return res.status(401).json({ message: 'Credenciais invalidas' });
  }
  loginAttempts.delete(attemptKey);
  audit(user.id, 'login', 'user', user.id).catch(() => {});

  // Setores incluídos para as telas que dependem deles (Criar Manual, Criar Prova) funcionarem logo após o login.
  res.json({ token: signToken(user), user: await loadProfile(user.id) });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({ message: 'A nova senha deve ter 8 caracteres, uma letra e um número' });
  }
  const user = await findUserByIdentifier(req.user.id ? (await findUserById(req.user.id)).identificador : '');
  if (!user || !await bcrypt.compare(currentPassword || '', user.senha)) return res.status(400).json({ message: 'Senha atual incorreta' });
  await updatePassword(user.id, await bcrypt.hash(newPassword, 10));
  await audit(user.id, 'password_changed', 'user', user.id);
  res.status(204).send();
}

export async function registerManagerUser(req, res) {
  const { nome, identificador, senha, role = 'usuario' } = req.body;

  if (!nome || !identificador || !senha) {
    return res.status(400).json({ message: 'Nome, usuario e senha sao obrigatorios' });
  }

  if (!isStrongPassword(senha)) {
    return res.status(400).json({ message: 'A senha deve ter 8 caracteres, uma letra e um número' });
  }

  if (!['suporte', 'gerente_setor', 'usuario'].includes(role)) {
    return res.status(400).json({ message: 'Role invalida' });
  }

  const sectors = await validateUserSectors(role, req.body.sectorIds);
  if (sectors.error) return res.status(400).json({ message: sectors.error });

  const senhaHash = await bcrypt.hash(senha, 10);
  let user;
  try {
    user = await createUser({ nome, identificador, senhaHash, role, sectorIds: sectors.ids });
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    user = demoStore.createUser({ nome, identificador, senhaHash, role, sectorIds: sectors.ids });
  }

  res.status(201).json(user);
}

/** Dados do usuário sem senha, com sector_ids e setores ({ id, nome }). */
async function loadProfile(id) {
  try {
    return await findUserById(id);
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    return demoStore.findUserById(id);
  }
}

export async function me(req, res) {
  res.json(await loadProfile(req.user.id));
}
