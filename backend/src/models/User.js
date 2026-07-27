import { query } from '../config/db.js';

// Localiza o usuario pelo identificador livre; o e-mail antigo continua aceito na migracao.
export async function findUserByIdentifier(identificador) {
  const { rows } = await query(
    'SELECT * FROM users WHERE identificador = $1 OR email = $1',
    [identificador]
  );
  return rows[0];
}

export async function findUserById(id) {
  const { rows } = await query(
    `SELECT u.id, u.nome, u.identificador, u.email, u.role, u.sector_id,
            s.nome AS setor, u.created_at
     FROM users u LEFT JOIN sectors s ON s.id = u.sector_id WHERE u.id = $1`,
    [id]
  );
  return rows[0];
}

export async function listUsers() {
  const { rows } = await query(
    `SELECT u.id, u.nome, u.identificador, u.email, u.role, u.sector_id,
            s.nome AS setor, u.created_at
     FROM users u LEFT JOIN sectors s ON s.id = u.sector_id ORDER BY u.nome ASC`
  );
  return rows;
}

export async function createUser({ nome, identificador, senhaHash, role, sectorId }) {
  const { rows } = await query(
    `INSERT INTO users (nome, identificador, senha, role, sector_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, nome, identificador, email, role, sector_id, created_at`,
    [nome, identificador, senhaHash, role, sectorId]
  );
  return rows[0];
}

// Atualiza dados administrativos, inclusive o setor que determina os manuais visiveis.
export async function updateUser(id, { nome, identificador, role, sectorId }) {
  const { rows } = await query(
    `UPDATE users SET nome = COALESCE($1, nome), identificador = COALESCE($2, identificador),
      role = COALESCE($3, role), sector_id = $4
     WHERE id = $5
     RETURNING id, nome, identificador, email, role, sector_id, created_at`,
    [nome, identificador, role, sectorId, id]
  );
  return rows[0];
}

export async function deleteUser(id) {
  await query('DELETE FROM users WHERE id = $1', [id]);
}
