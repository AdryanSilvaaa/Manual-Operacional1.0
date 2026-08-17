// Testes do schema inicial (migração 001).
//
// O teste de integração aplica a migração num Postgres real e verifica as
// regras que o banco precisa garantir sozinho (CHECK de papel/departamento e
// bloqueio de exclusão com vínculos). Sem banco acessível, ele é pulado — e
// restam as verificações estáticas do arquivo SQL, que guardam contra a
// remoção acidental dessas regras.

import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

process.env.DATABASE_URL ||= 'postgres://u:p@localhost:5432/db';
process.env.JWT_SECRET ||= 'segredo-de-teste-com-mais-de-32-caracteres';
process.env.REDIS_URL ||= 'redis://localhost:6379';
process.env.GCS_BUCKET ||= 'bucket-de-teste';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const caminhoMigracao = path.join(raiz, 'sql', 'migrations', '001_schema_inicial.sql');
const sql = readFileSync(caminhoMigracao, 'utf8');
// Só o DDL: sem os comentários, que também citam as regras em prosa.
const ddl = sql.replace(/--[^\n]*/g, '');

// --- Verificações estáticas (sempre rodam) ---

test('a migração cria as quatro tabelas do modelo', () => {
  for (const tabela of ['departamentos', 'sistemas', 'usuarios', 'manuais']) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${tabela}\\b`), `falta ${tabela}`);
  }
});

test('usuarios tem o CHECK que liga papel e departamento', () => {
  assert.match(sql, /usuarios_papel_valido/);
  assert.match(sql, /usuarios_departamento_por_papel/);
  assert.match(sql, /papel = 'administrador' AND departamento_id IS NULL/);
});

test('as FKs bloqueiam exclusão com vínculos (pendência 2, opção a)', () => {
  const restricts = ddl.match(/ON DELETE RESTRICT/g) ?? [];
  // sistemas->departamentos, usuarios->departamentos, manuais->sistemas
  assert.equal(restricts.length, 3);
  assert.equal(/ON DELETE CASCADE/.test(ddl), false, 'nenhuma FK em cascata');
  // Toda FK declarada tem política explícita de exclusão.
  assert.equal((ddl.match(/REFERENCES/g) ?? []).length, restricts.length);
});

test('manual não replica departamento: deriva do sistema', () => {
  const blocoManuais = ddl.slice(ddl.indexOf('CREATE TABLE IF NOT EXISTS manuais'));
  assert.match(blocoManuais, /sistema_id\s+INTEGER\s+NOT NULL/);
  assert.equal(
    /departamento_id/.test(blocoManuais.slice(0, blocoManuais.indexOf('COMMIT'))),
    false,
    'manuais não deve ter departamento_id próprio',
  );
});

// --- Integração: aplica a migração num Postgres real, se houver ---

function portaAberta(host, porta, timeout = 800) {
  return new Promise((resolve) => {
    const socket = net.connect(porta, host);
    const fim = (aberta) => {
      socket.destroy();
      resolve(aberta);
    };
    socket.once('connect', () => fim(true));
    socket.once('error', () => fim(false));
    socket.setTimeout(timeout, () => fim(false));
  });
}

const url = new URL(process.env.DATABASE_URL);
const temBanco = await portaAberta(url.hostname, Number(url.port) || 5432);
const pular = temBanco ? false : 'sem Postgres local acessível';

test('integração: a migração aplica e as regras valem no banco', { skip: pular }, async (t) => {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Roda tudo num schema temporário para não sujar o banco.
  const schema = `teste_migracao_${Date.now()}`;
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET search_path TO ${schema}`);

  try {
    await client.query(sql);

    await t.test('administrador não pode ter departamento', async () => {
      const { rows } = await client.query(
        `INSERT INTO departamentos (nome) VALUES ('Dep A') RETURNING id`,
      );
      const depA = rows[0].id;
      await assert.rejects(
        () =>
          client.query(
            `INSERT INTO usuarios (email, senha_hash, papel, departamento_id)
             VALUES ('a@ex.com', 'h', 'administrador', $1)`,
            [depA],
          ),
        /usuarios_departamento_por_papel/,
      );
    });

    await t.test('gerente e usuário exigem departamento', async () => {
      for (const papel of ['gerente', 'usuario']) {
        await assert.rejects(
          () =>
            client.query(
              `INSERT INTO usuarios (email, senha_hash, papel, departamento_id)
               VALUES ($1, 'h', $2, NULL)`,
              [`${papel}@ex.com`, papel],
            ),
          /usuarios_departamento_por_papel/,
        );
      }
    });

    await t.test('papel inválido é recusado', async () => {
      await assert.rejects(
        () =>
          client.query(
            `INSERT INTO usuarios (email, senha_hash, papel) VALUES ('r@ex.com', 'h', 'root')`,
          ),
        /usuarios_papel_valido/,
      );
    });

    await t.test('não exclui departamento com sistemas ou usuários vinculados', async () => {
      const { rows: d } = await client.query(
        `INSERT INTO departamentos (nome) VALUES ('Dep B') RETURNING id`,
      );
      const dep = d[0].id;
      await client.query(`INSERT INTO sistemas (nome, departamento_id) VALUES ('Sis', $1)`, [dep]);
      await assert.rejects(
        () => client.query(`DELETE FROM departamentos WHERE id = $1`, [dep]),
        /violates foreign key constraint/,
      );
    });

    await t.test('não exclui sistema com manuais vinculados', async () => {
      const { rows: d } = await client.query(
        `INSERT INTO departamentos (nome) VALUES ('Dep C') RETURNING id`,
      );
      const { rows: s } = await client.query(
        `INSERT INTO sistemas (nome, departamento_id) VALUES ('Sis C', $1) RETURNING id`,
        [d[0].id],
      );
      await client.query(
        `INSERT INTO manuais (titulo, objeto_key, sistema_id) VALUES ('M', 'k.pdf', $1)`,
        [s[0].id],
      );
      await assert.rejects(
        () => client.query(`DELETE FROM sistemas WHERE id = $1`, [s[0].id]),
        /violates foreign key constraint/,
      );
    });

    await t.test('o departamento do manual vem do sistema (join)', async () => {
      const { rows } = await client.query(
        `SELECT m.titulo, s.departamento_id
           FROM manuais m JOIN sistemas s ON s.id = m.sistema_id
          WHERE m.titulo = 'M'`,
      );
      assert.equal(rows.length, 1);
      assert.ok(rows[0].departamento_id);
    });

    await t.test('a migração é idempotente (roda duas vezes)', async () => {
      await client.query(sql);
    });
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  }
});
