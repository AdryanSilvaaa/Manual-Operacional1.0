/**
 * Lista, atualiza e exclui usuários para a área de suporte.
 * Altere campos permitidos aqui; SQL e formato persistido ficam em models/User.js.
 */
import { deleteUser, listUsers, updateUser } from '../models/User.js';
import { findSectorsByIds } from '../models/Sector.js';
import { parseSectorIds } from '../utils/access.js';
import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';

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
 * suporte pode ficar sem setor. Os setores precisam existir (são criados na tela Setores).
 */
export async function validateUserSectors(role, value) {
  const ids = parseSectorIds(value);
  if (role !== 'suporte' && !ids.length) return { error: 'Selecione pelo menos um setor' };
  if (!ids.length) return { ids };
  const found = await findSectorsByIds(ids);
  if (found.length !== ids.length) return { error: 'Setor nao encontrado' };
  return { ids };
}

// Permite trocar os setores e os dados de identificacao de um usuario existente.
export async function update(req, res) {
  const { nome, identificador, role } = req.body;
  if (!nome || !identificador || !['suporte', 'gerente_setor', 'usuario'].includes(role)) {
    return res.status(400).json({ message: 'Nome, usuario e perfil validos sao obrigatorios' });
  }
  const sectors = await validateUserSectors(role, req.body.sectorIds);
  if (sectors.error) return res.status(400).json({ message: sectors.error });

  try {
    const user = await updateUser(req.params.id, { nome, identificador, role, sectorIds: sectors.ids });
    if (!user) return res.status(404).json({ message: 'Usuario nao encontrado' });
    res.json(user);
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    const user = demoStore.updateUser(req.params.id, { nome, identificador, role, sectorIds: sectors.ids });
    if (!user) return res.status(404).json({ message: 'Usuario nao encontrado' });
    res.json(user);
  }
}
