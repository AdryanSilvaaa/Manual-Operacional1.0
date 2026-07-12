import {
  createSystem,
  deleteSystem,
  listSystemsForUser,
  updateSystem
} from '../models/System.js';
import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';

export async function index(req, res) {
  let systems;
  try {
    systems = await listSystemsForUser(req.user);
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    systems = demoStore.listSystemsForUser(req.user);
  }

  res.json(systems);
}

export async function store(req, res) {
  const { nome, resumo } = req.body;

  if (!nome) {
    return res.status(400).json({ message: 'Nome do sistema e obrigatorio' });
  }

  let system;
  try {
    system = await createSystem({ nome, resumo });
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    system = demoStore.createSystem({ nome, resumo });
  }

  res.status(201).json(system);
}

export async function update(req, res) {
  const { nome, resumo } = req.body;

  let system;
  try {
    system = await updateSystem(req.params.id, { nome, resumo });
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    system = demoStore.updateSystem(req.params.id, { nome, resumo });
  }

  if (!system) {
    return res.status(404).json({ message: 'Sistema nao encontrado' });
  }

  res.json(system);
}

export async function destroy(req, res) {
  try {
    await deleteSystem(req.params.id);
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    demoStore.deleteSystem(req.params.id);
  }

  res.status(204).send();
}
