/**
 * Consultas PostgreSQL de usuários, seus setores (user_sectors) e suas unidades (user_units).
 * Alterar SELECT muda dados retornados à API; INSERT/UPDATE/DELETE muda a persistência.
 */
import { query, withTransaction } from '../config/db.js';

// Colunas devolvidas às telas (nunca a senha). Setores e unidades vêm em ordem alfabética:
// ids para as regras de acesso e { id, nome } para exibir. must_change_password = senha provisória a trocar.
const USER_COLUMNS = `u.id, u.nome, u.identificador, u.email, u.role, u.created_at, u.must_change_password,
  ARRAY(SELECT us.sector_id FROM user_sectors us JOIN sectors s ON s.id = us.sector_id
        WHERE us.user_id = u.id ORDER BY s.nome) AS sector_ids,
  COALESCE((SELECT json_agg(json_build_object('id', s.id, 'nome', s.nome) ORDER BY s.nome)
            FROM user_sectors us JOIN sectors s ON s.id = us.sector_id
            WHERE us.user_id = u.id), '[]'::json) AS setores,
  ARRAY(SELECT uu.unit_id FROM user_units uu JOIN units un ON un.id = uu.unit_id
        WHERE uu.user_id = u.id ORDER BY un.nome) AS unit_ids,
  COALESCE((SELECT json_agg(json_build_object('id', un.id, 'nome', un.nome) ORDER BY un.nome)
            FROM user_units uu JOIN units un ON un.id = uu.unit_id
            WHERE uu.user_id = u.id), '[]'::json) AS unidades`;

// Localiza o usuario pelo identificador livre; o e-mail antigo continua aceito na migracao.
// Devolve a linha completa (inclusive o hash da senha): use só no login.
export async function findUserByIdentifier(identificador) {
  const { rows } = await query(
    'SELECT * FROM users WHERE identificador = $1 OR email = $1',
    [identificador]
  );
  return rows[0];
}

/** Id e hash da senha do usuário, para conferir a senha atual na troca de senha. */
export async function findUserCredentialsById(id) {
  const { rows } = await query('SELECT id, senha FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

/** Usuário sem a senha, com setores e unidades. execute permite usar dentro de uma transação. */
export async function findUserById(id, execute = query) {
  const { rows } = await execute(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = $1`, [id]);
  return rows[0];
}

export async function listUsers() {
  const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users u ORDER BY u.nome ASC`);
  return rows;
}

/** Perfil, setores e unidades atuais do usuário (null se ele não existe mais); usado a cada requisição pelo authenticate. */
export async function findUserAccess(userId) {
  const { rows } = await query(
    `SELECT u.role, u.must_change_password, ARRAY(SELECT us.sector_id FROM user_sectors us WHERE us.user_id = u.id) AS sector_ids,
            ARRAY(SELECT uu.unit_id FROM user_units uu WHERE uu.user_id = u.id) AS unit_ids
     FROM users u WHERE u.id = $1`,
    [userId]
  );
  return rows[0] || null;
}

/** Substitui todos os setores do usuário pela lista informada. */
async function replaceUserSectors(execute, userId, sectorIds) {
  await execute('DELETE FROM user_sectors WHERE user_id = $1', [userId]);
  await execute(
    'INSERT INTO user_sectors (user_id, sector_id) SELECT $1, UNNEST($2::int[]) ON CONFLICT DO NOTHING',
    [userId, sectorIds]
  );
}

/** Substitui todas as unidades do usuário pela lista informada. */
async function replaceUserUnits(execute, userId, unitIds) {
  await execute('DELETE FROM user_units WHERE user_id = $1', [userId]);
  await execute(
    'INSERT INTO user_units (user_id, unit_id) SELECT $1, UNNEST($2::int[]) ON CONFLICT DO NOTHING',
    [userId, unitIds]
  );
}

/** Cria o usuário com setores e unidades numa transação. A senha definida por quem cadastra é provisória. */
export async function createUser({ nome, identificador, senhaHash, role, sectorIds, unitIds = [], mustChangePassword = true }) {
  return withTransaction(async (client) => {
    const execute = client.query.bind(client);
    const { rows } = await execute(
      `INSERT INTO users (nome, identificador, senha, role, must_change_password) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [nome, identificador, senhaHash, role, Boolean(mustChangePassword)]
    );
    await replaceUserSectors(execute, rows[0].id, sectorIds);
    await replaceUserUnits(execute, rows[0].id, unitIds);
    return findUserById(rows[0].id, execute);
  });
}

// Atualiza dados administrativos, setores e unidades que determinam os manuais visíveis. senhaHash ausente mantém a senha;
// com provisional (senha redefinida por outra pessoa) o dono troca no próximo acesso.
export async function updateUser(id, { nome, identificador, role, sectorIds, unitIds, senhaHash, provisional = true }) {
  return withTransaction(async (client) => {
    const execute = client.query.bind(client);
    const { rows } = await execute(
      `UPDATE users SET nome = COALESCE($1, nome), identificador = COALESCE($2, identificador),
        role = COALESCE($3, role), senha = COALESCE($5, senha),
        must_change_password = CASE WHEN $5::text IS NULL THEN must_change_password ELSE $6::boolean END
       WHERE id = $4 RETURNING id`,
      [nome, identificador, role, id, senhaHash ?? null, Boolean(provisional)]
    );
    if (!rows[0]) return null;
    await replaceUserSectors(execute, id, sectorIds);
    await replaceUserUnits(execute, id, unitIds);
    return findUserById(id, execute);
  });
}

/** Exclui o usuário; setores, unidades, progresso e entregas saem junto (ON DELETE CASCADE). */
export async function deleteUser(id) {
  await query('DELETE FROM users WHERE id = $1', [id]);
}

/** Troca feita pelo próprio usuário: grava a nova senha e encerra a obrigação de trocar a provisória. */
export async function updatePassword(id, passwordHash) {
  await query('UPDATE users SET senha = $1, must_change_password = FALSE WHERE id = $2', [passwordHash, id]);
}

/**
 * Cadastro em massa (importação por planilha): todos os usuários, setores e unidades numa transação,
 * com poucas idas ao banco. Se um login já existir, nada é gravado.
 */
export async function createUsers(list) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      // Todos entram com senha provisória (gerada ou vinda da planilha): trocam no primeiro acesso.
      `INSERT INTO users (nome, identificador, senha, role, must_change_password)
       SELECT n, i, s, r, TRUE FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[]) AS t(n, i, s, r)
       RETURNING id, identificador`,
      [list.map((user) => user.nome), list.map((user) => user.identificador), list.map((user) => user.senhaHash), list.map((user) => user.role)]
    );
    const idByLogin = new Map(rows.map((row) => [row.identificador, row.id]));
    const pairs = list.flatMap((user) => user.sectorIds.map((sectorId) => [idByLogin.get(user.identificador), sectorId]));
    if (pairs.length) {
      await client.query(
        'INSERT INTO user_sectors (user_id, sector_id) SELECT * FROM UNNEST($1::int[], $2::int[]) ON CONFLICT DO NOTHING',
        [pairs.map((pair) => pair[0]), pairs.map((pair) => pair[1])]
      );
    }
    const unitPairs = list.flatMap((user) => (user.unitIds || []).map((unitId) => [idByLogin.get(user.identificador), unitId]));
    if (unitPairs.length) {
      await client.query(
        'INSERT INTO user_units (user_id, unit_id) SELECT * FROM UNNEST($1::int[], $2::int[]) ON CONFLICT DO NOTHING',
        [unitPairs.map((pair) => pair[0]), unitPairs.map((pair) => pair[1])]
      );
    }
    return rows.length;
  });
}
