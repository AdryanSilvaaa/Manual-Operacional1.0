/**
 * Lista, atualiza e exclui usuários para a área de suporte.
 * Altere campos permitidos aqui; SQL e formato persistido ficam em models/User.js.
 */
import { deleteUser, listUsers, updateUser } from '../models/User.js';
import { findOrCreateSector } from '../models/Sector.js';
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

// Permite trocar o setor e os dados de identificacao de um usuario existente.
export async function update(req, res) {
  const { nome, identificador, role, setor } = req.body;
  if (!nome || !identificador || !setor || !['suporte', 'gerente_setor', 'usuario'].includes(role)) {
    return res.status(400).json({ message: 'Nome, usuario, setor e perfil validos sao obrigatorios' });
  }

  const sector = await findOrCreateSector(setor);
  try {
    const user = await updateUser(req.params.id, { nome, identificador, role, sectorId: sector.id });
    if (!user) return res.status(404).json({ message: 'Usuario nao encontrado' });
    res.json({ ...user, setor: sector.nome });
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    const user = demoStore.updateUser(req.params.id, { nome, identificador, role, sectorId: sector.id, setor: sector.nome });
    if (!user) return res.status(404).json({ message: 'Usuario nao encontrado' });
    res.json(user);
  }
}
