import { query } from '../config/db.js';
import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';

export async function listSectors() {
  try {
    const { rows } = await query('SELECT id, nome FROM sectors ORDER BY nome ASC');
    return rows;
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    return demoStore.listSectors();
  }
}

// Reaproveita um setor pelo nome ou o cria para que os cadastros sejam leves.
export async function findOrCreateSector(nome) {
  try {
    const { rows } = await query(
      `INSERT INTO sectors (nome) VALUES ($1)
       ON CONFLICT (nome) DO UPDATE SET nome = EXCLUDED.nome RETURNING id, nome`, [nome.trim()]
    );
    return rows[0];
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    return demoStore.findOrCreateSector(nome);
  }
}

export async function findSectorById(id) {
  try {
    const { rows } = await query('SELECT id, nome FROM sectors WHERE id = $1', [id]);
    return rows[0];
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    return demoStore.findSectorById(id);
  }
}
