/**
 * Consultas PostgreSQL de usuários e seus setores (tabela user_sectors).
 * Alterar SELECT muda dados retornados à API; INSERT/UPDATE/DELETE muda a persistência.
 */
import { query, withTransaction } from '../config/db.js';

// Setores do usuário em ordem alfabética: ids para as regras de acesso e nomes para as telas.
const USER_COLUMNS = `u.id, u.nome, u.identificador, u.email, u.role, u.created_at,
  ARRAY(SELECT us.sector_id FROM user_sectors us JOIN sectors s ON s.id = us.sector_id
        WHERE us.user_id = u.id ORDER BY s.nome) AS sector_ids,
  COALESCE((SELECT json_agg(json_build_object('id', s.id, 'nome', s.nome) ORDER BY s.nome)
            FROM user_sectors us JOIN sectors s ON s.id = us.sector_id
            WHERE us.user_id = u.id), '[]'::json) AS setores`;

// Localiza o usuario pelo identificador livre; o e-mail antigo continua aceito na migracao.
export async function findUserByIdentifier(identificador) {
  const { rows } = await query(
    'SELECT * FROM users WHERE identificador = $1 OR email = $1',
    [identificador]
  );
  return rows[0];
}

export async function findUserById(id, execute = query) {
  const { rows } = await execute(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = $1`, [id]);
  return rows[0];
}

export async function listUsers() {
  const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users u ORDER BY u.nome ASC`);
  return rows;
}

/** Ids dos setores do usuário; usado a cada requisição para aplicar o acesso atualizado. */
export async function listUserSectorIds(userId) {
  const { rows } = await query('SELECT sector_id FROM user_sectors WHERE user_id = $1', [userId]);
  return rows.map((row) => row.sector_id);
}

/** Substitui todos os setores do usuário pela lista informada. */
async function replaceUserSectors(execute, userId, sectorIds) {
  await execute('DELETE FROM user_sectors WHERE user_id = $1', [userId]);
  await execute(
    'INSERT INTO user_sectors (user_id, sector_id) SELECT $1, UNNEST($2::int[]) ON CONFLICT DO NOTHING',
    [userId, sectorIds]
  );
}

export async function createUser({ nome, identificador, senhaHash, role, sectorIds }) {
  return withTransaction(async (client) => {
    const execute = client.query.bind(client);
    const { rows } = await execute(
      `INSERT INTO users (nome, identificador, senha, role) VALUES ($1, $2, $3, $4) RETURNING id`,
      [nome, identificador, senhaHash, role]
    );
    await replaceUserSectors(execute, rows[0].id, sectorIds);
    return findUserById(rows[0].id, execute);
  });
}

// Atualiza dados administrativos e os setores que determinam os manuais visíveis.
export async function updateUser(id, { nome, identificador, role, sectorIds }) {
  return withTransaction(async (client) => {
    const execute = client.query.bind(client);
    const { rows } = await execute(
      `UPDATE users SET nome = COALESCE($1, nome), identificador = COALESCE($2, identificador),
        role = COALESCE($3, role)
       WHERE id = $4 RETURNING id`,
      [nome, identificador, role, id]
    );
    if (!rows[0]) return null;
    await replaceUserSectors(execute, id, sectorIds);
    return findUserById(id, execute);
  });
}

export async function deleteUser(id) {
  await query('DELETE FROM users WHERE id = $1', [id]);
}

export async function updatePassword(id, passwordHash) {
  await query('UPDATE users SET senha = $1 WHERE id = $2', [passwordHash, id]);
}
