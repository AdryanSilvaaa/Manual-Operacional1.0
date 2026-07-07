import { deleteUser, listUsers } from '../models/User.js';
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
