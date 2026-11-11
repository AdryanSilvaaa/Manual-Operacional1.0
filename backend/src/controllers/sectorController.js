/**
 * Atende a listagem e criação de setores.
 * Regras de entrada mudam aqui; persistência e reaproveitamento de nomes ficam em models/Sector.js.
 */
import { findOrCreateSector, listSectors } from '../models/Sector.js';
import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';

/** Lista todos os setores em ordem alfabética. */
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
  const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim().replace(/\s+/g, ' ') : '';
  if (!nome) return res.status(400).json({ message: 'Nome do setor e obrigatorio' });
  // Mesmo limite de sectors.nome VARCHAR(120) no schema.sql.
  if (nome.length > 120) return res.status(400).json({ message: 'O nome do setor pode ter até 120 caracteres' });
  res.status(201).json(await findOrCreateSector(nome));
}
