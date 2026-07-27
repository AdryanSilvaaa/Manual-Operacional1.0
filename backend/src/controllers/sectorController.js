import { findOrCreateSector, listSectors } from '../models/Sector.js';
import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';

export async function index(req, res) {
  try {
    res.json(await listSectors());
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    res.json(demoStore.listSectors());
  }
}

// Cria um setor reutilizavel para vinculacao de usuarios e manuais.
export async function store(req, res) {
  const { nome } = req.body;
  if (!nome?.trim()) return res.status(400).json({ message: 'Nome do setor e obrigatorio' });
  res.status(201).json(await findOrCreateSector(nome));
}
