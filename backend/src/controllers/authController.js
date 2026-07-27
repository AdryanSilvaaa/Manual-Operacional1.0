import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createUser, findUserByIdentifier, findUserById } from '../models/User.js';
import { findOrCreateSector } from '../models/Sector.js';
import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';

function signToken(user) {
  return jwt.sign(
    { id: user.id, nome: user.nome, role: user.role, sector_id: user.sector_id },
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
    return res.status(401).json({ message: 'Credenciais invalidas' });
  }

  const safeUser = {
    id: user.id,
    nome: user.nome,
    identificador: user.identificador,
    role: user.role
  };

  res.json({ token: signToken(user), user: safeUser });
}

export async function registerManagerUser(req, res) {
  const { nome, identificador, senha, role = 'usuario', setor } = req.body;

  if (!nome || !identificador || !senha || !setor) {
    return res.status(400).json({ message: 'Nome, usuario, setor e senha sao obrigatorios' });
  }

  if (!['suporte', 'gerente_setor', 'usuario'].includes(role)) {
    return res.status(400).json({ message: 'Role invalida' });
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  const sector = await findOrCreateSector(setor);
  let user;
  try {
    user = await createUser({ nome, identificador, senhaHash, role, sectorId: sector.id });
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    user = demoStore.createUser({ nome, identificador, senhaHash, role, sectorId: sector.id, setor: sector.nome });
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
