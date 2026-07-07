import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createUser, findUserByEmail, findUserById } from '../models/User.js';
import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';

function signToken(user) {
  return jwt.sign(
    { id: user.id, nome: user.nome, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}

export async function login(req, res) {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ message: 'Email e senha sao obrigatorios' });
  }

  let user;
  try {
    user = await findUserByEmail(email);
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    user = demoStore.findUserByEmail(email);
  }
  const validPassword = user && await bcrypt.compare(senha, user.senha);

  if (!validPassword) {
    return res.status(401).json({ message: 'Credenciais invalidas' });
  }

  const safeUser = {
    id: user.id,
    nome: user.nome,
    email: user.email,
    role: user.role
  };

  res.json({ token: signToken(user), user: safeUser });
}

export async function registerManagerUser(req, res) {
  const { nome, email, senha, role = 'usuario' } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ message: 'Nome, email e senha sao obrigatorios' });
  }

  if (!['gerente', 'usuario'].includes(role)) {
    return res.status(400).json({ message: 'Role invalida' });
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  let user;
  try {
    user = await createUser({ nome, email, senhaHash, role });
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    user = demoStore.createUser({ nome, email, senhaHash, role });
  }

  res.status(201).json(user);
}

export async function me(req, res) {
  let user;
  try {
    user = await findUserById(req.user.id);
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    user = demoStore.findUserById(req.user.id);
  }

  res.json(user);
}
