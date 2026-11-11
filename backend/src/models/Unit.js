/**
 * Consultas das unidades (filiais / endereços), com fallback de demonstração.
 * O setor é comum a todas as unidades; a unidade é um segundo filtro de acesso (ver utils/access.js).
 */
import { query } from '../config/db.js';
import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';

// Campos de endereço gravados em units (todos opcionais).
export const ADDRESS_FIELDS = ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'];
const UNIT_COLUMNS = `id, nome, ${ADDRESS_FIELDS.join(', ')}`;

async function withDemo(databaseCall, demoCall) {
  try {
    return await databaseCall();
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    return demoCall();
  }
}

/** Unidades em ordem alfabética, com quantos usuários e manuais estão ligados a cada uma. */
export function listUnits() {
  return withDemo(async () => {
    const { rows } = await query(
      `SELECT un.id, un.nome, ${ADDRESS_FIELDS.map((field) => `un.${field}`).join(', ')},
              (SELECT COUNT(*)::int FROM user_units uu WHERE uu.unit_id = un.id) AS users_count,
              (SELECT COUNT(*)::int FROM manual_units mu WHERE mu.unit_id = un.id) AS manuals_count
       FROM units un ORDER BY un.nome ASC`
    );
    return rows;
  }, () => demoStore.listUnits());
}

/** Unidades existentes entre os ids informados; usado para validar listas vindas das telas. */
export function findUnitsByIds(ids) {
  return withDemo(async () => {
    const { rows } = await query('SELECT id, nome FROM units WHERE id = ANY($1::int[]) ORDER BY nome', [ids]);
    return rows;
  }, () => demoStore.findUnitsByIds(ids));
}

/** Cria a unidade com nome e endereço (data já validado pelo controller; campos vazios chegam como null). */
export function createUnit(data) {
  return withDemo(async () => {
    const values = [data.nome, ...ADDRESS_FIELDS.map((field) => data[field] ?? null)];
    const { rows } = await query(
      `INSERT INTO units (nome, ${ADDRESS_FIELDS.join(', ')})
       VALUES (${values.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING ${UNIT_COLUMNS}`,
      values
    );
    return rows[0];
  }, () => demoStore.createUnit(data));
}

/** Atualiza nome e endereço (substitui todos os campos de endereço). */
export function updateUnit(id, data) {
  return withDemo(async () => {
    const values = [data.nome, ...ADDRESS_FIELDS.map((field) => data[field] ?? null), id];
    const { rows } = await query(
      `UPDATE units SET nome = $1, ${ADDRESS_FIELDS.map((field, index) => `${field} = $${index + 2}`).join(', ')}, updated_at = NOW()
       WHERE id = $${values.length} RETURNING ${UNIT_COLUMNS}`,
      values
    );
    return rows[0] || null;
  }, () => demoStore.updateUnit(id, data));
}

/** Exclui a unidade. Se ela ainda tem usuários, manuais ou provas, o banco recusa (código 23503). */
export function deleteUnit(id) {
  return withDemo(async () => {
    await query('DELETE FROM units WHERE id = $1', [id]);
  }, () => demoStore.deleteUnit(id));
}
