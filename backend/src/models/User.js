import { query } from '../config/db.js';

export async function findUserByEmail(email) {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0];
}

export async function findUserById(id) {
  const { rows } = await query(
    'SELECT id, nome, email, role, created_at FROM users WHERE id = $1',
    [id]
  );
  return rows[0];
}

export async function listUsers() {
  const { rows } = await query(
    'SELECT id, nome, email, role, created_at FROM users ORDER BY nome ASC'
  );
  return rows;
}

export async function createUser({ nome, email, senhaHash, role }) {
  const { rows } = await query(
    `INSERT INTO users (nome, email, senha, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, nome, email, role, created_at`,
    [nome, email, senhaHash, role]
  );
  return rows[0];
}

export async function deleteUser(id) {
  await query('DELETE FROM users WHERE id = $1', [id]);
}
