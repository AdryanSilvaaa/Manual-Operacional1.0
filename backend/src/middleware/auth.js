/**
 * Valida o JWT, carrega perfil, setores e unidades atuais do usuário e aplica as permissões das rotas.
 * O que cada perfil pode fazer fica em utils/access.js (ROLE_PERMISSIONS).
 */
import jwt from 'jsonwebtoken';
import { findUserAccess } from '../models/User.js';
import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';
import { can, normalizeRole } from '../utils/access.js';

// Algoritmo fixo do token: impede que um token forjado com outro algoritmo (ex.: "none") seja aceito.
export const JWT_ALGORITHM = 'HS256';

// Rotas liberadas enquanto o usuário ainda precisa trocar a senha provisória (senha padrão ou redefinida por outra pessoa).
const ALLOWED_WHILE_PASSWORD_CHANGE = new Set(['GET /api/auth/me', 'PUT /api/auth/password']);

/** Busca no banco (ou na memória do modo demonstração) o perfil, os setores, as unidades e se a senha precisa ser trocada. */
async function loadAccess(userId) {
  try {
    return await findUserAccess(userId);
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    const user = demoStore.findUserById(userId);
    return user ? { role: user.role, sector_ids: demoStore.listUserSectorIds(userId), unit_ids: demoStore.listUserUnitIds(userId), must_change_password: false } : null;
  }
}

// Perfil, setores e unidades são lidos do banco a cada requisição: mudar o perfil ou os setores de alguém vale na hora,
// sem novo login, e um usuário excluído perde o acesso mesmo com token ainda válido.
export async function authenticate(req, res, next) {
  const header = req.headers.authorization;

  // O token chega no cabeçalho "Authorization: Bearer <token>".
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token nao informado' });
  }

  let payload;
  try {
    payload = jwt.verify(header.slice('Bearer '.length), process.env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
  } catch {
    return res.status(401).json({ message: 'Token invalido ou expirado' });
  }

  let access;
  try {
    access = await loadAccess(payload.id);
  } catch (error) {
    return next(error);
  }
  if (!access) return res.status(401).json({ message: 'Usuario nao encontrado' });

  // Com senha provisória, só dá para ver o próprio perfil e trocar a senha (o resto da API responde 403).
  if (access.must_change_password && !ALLOWED_WHILE_PASSWORD_CHANGE.has(`${req.method} ${req.baseUrl}${req.path}`)) {
    return res.status(403).json({ message: 'Troque a sua senha provisória para continuar', code: 'PASSWORD_CHANGE_REQUIRED' });
  }

  // req.user fica disponível para os controllers: id e nome do token + perfil, setores e unidades atuais do banco.
  req.user = { ...payload, role: normalizeRole(access.role), sector_ids: access.sector_ids, unit_ids: access.unit_ids || [] };
  next();
}

/** Libera a rota para quem tem pelo menos uma das permissões informadas. */
export function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!permissions.some((permission) => can(req.user, permission))) {
      return res.status(403).json({ message: 'Seu perfil não tem permissão para esta ação' });
    }
    next();
  };
}
