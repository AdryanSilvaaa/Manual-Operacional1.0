/**
 * Valida JWT e aplica as permissões reutilizadas pelas rotas.
 * Alterar os perfis aceitos abaixo muda quem pode acessar cada grupo protegido.
 */
import jwt from 'jsonwebtoken';
import { listUserSectorIds } from '../models/User.js';
import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';

async function loadSectorIds(userId) {
  try {
    return await listUserSectorIds(userId);
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    return demoStore.listUserSectorIds(userId);
  }
}

// Os setores são lidos do banco a cada requisição: mudar os setores de um usuário vale sem novo login.
export async function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token nao informado' });
  }

  let payload;
  try {
    payload = jwt.verify(header.replace('Bearer ', ''), process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Token invalido ou expirado' });
  }

  try {
    req.user = { ...payload, sector_ids: await loadSectorIds(payload.id) };
  } catch (error) {
    return next(error);
  }
  next();
}

// Suporte administra usuarios, setores e sistemas.
export function requireSupport(req, res, next) {
  if (!['suporte', 'gerente'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'Acesso permitido apenas para suporte' });
  }

  next();
}

// Suporte, editor de conteúdo e gerente de setor cadastram materiais e acompanham o Painel de uso.
export function requireManualManager(req, res, next) {
  if (!['suporte', 'editor_conteudo', 'gerente_setor', 'gerente'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'Acesso permitido apenas para suporte, editor de conteúdo ou gerente de setor' });
  }
  next();
}
