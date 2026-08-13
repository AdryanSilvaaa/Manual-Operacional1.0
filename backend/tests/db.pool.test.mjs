// Testes do pool e do helper de transação (T2).
//
// Os testes de comTransacao/verificarBanco usam um pool falso (sem banco real),
// verificando a sequência BEGIN/COMMIT/ROLLBACK e o release do client.
// Há também um teste de integração que conecta num Postgres local — ele é
// pulado automaticamente quando não há banco acessível.

import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';

// Ambiente mínimo válido para o boot de env.js ao importar o pool.
process.env.DATABASE_URL ||= 'postgres://u:p@localhost:5432/db';
process.env.JWT_SECRET ||= 'segredo-de-teste-com-mais-de-32-caracteres';
process.env.REDIS_URL ||= 'redis://localhost:6379';
process.env.GCS_BUCKET ||= 'bucket-de-teste';

const { criarPool, comTransacao, verificarBanco } = await import('../src/db/pool.js');

// --- Pool falso: registra as queries e o release, sem tocar em banco. ---
function poolFalso({ falharCallback = false } = {}) {
  const queries = [];
  const client = {
    liberado: false,
    async query(sql) {
      queries.push(sql);
      if (/^SELECT/i.test(sql)) return { rows: [{ ok: 1 }] };
      return { rows: [] };
    },
    release() {
      this.liberado = true;
    },
  };
  const pool = {
    connect: async () => client,
  };
  return { pool, client, queries, falharCallback };
}

test('comTransacao faz commit e devolve o resultado no caminho feliz', async () => {
  const { pool, client, queries } = poolFalso();
  const resultado = await comTransacao(pool, async (c) => {
    await c.query('INSERT INTO t VALUES (1)');
    return 42;
  });
  assert.equal(resultado, 42);
  assert.deepEqual(queries, ['BEGIN', 'INSERT INTO t VALUES (1)', 'COMMIT']);
  assert.equal(client.liberado, true);
});

test('comTransacao faz rollback quando o callback lança erro', async () => {
  const { pool, client, queries } = poolFalso();
  await assert.rejects(
    () =>
      comTransacao(pool, async () => {
        throw new Error('boom');
      }),
    /boom/,
  );
  assert.deepEqual(queries, ['BEGIN', 'ROLLBACK']);
  assert.equal(queries.includes('COMMIT'), false);
  assert.equal(client.liberado, true);
});

test('libera o client mesmo se o próprio ROLLBACK falhar, propagando o erro original', async () => {
  const client = {
    liberado: false,
    async query(sql) {
      if (sql === 'ROLLBACK') throw new Error('rollback falhou');
      // BEGIN e a query do callback passam.
    },
    release() {
      this.liberado = true;
    },
  };
  const pool = { connect: async () => client };
  await assert.rejects(
    () =>
      comTransacao(pool, async (c) => {
        await c.query('UPDATE t SET x = 1');
        throw new Error('erro original');
      }),
    /erro original/,
  );
  assert.equal(client.liberado, true);
});

test('verificarBanco resolve true quando o banco responde SELECT 1', async () => {
  const pool = { query: async () => ({ rows: [{ ok: 1 }] }) };
  assert.equal(await verificarBanco(pool), true);
});

test('verificarBanco propaga o erro quando o banco está fora', async () => {
  const pool = {
    query: async () => {
      throw new Error('conexão recusada');
    },
  };
  await assert.rejects(() => verificarBanco(pool), /conexão recusada/);
});

test('criarPool usa DATABASE_URL e o max do ambiente', async () => {
  const pool = criarPool();
  try {
    assert.equal(pool.options.connectionString, process.env.DATABASE_URL);
    assert.equal(pool.options.max, 5); // padrão de DB_POOL_MAX
  } finally {
    await pool.end();
  }
});

test('criarPool aceita overrides pontuais', async () => {
  const pool = criarPool({ max: 3 });
  try {
    assert.equal(pool.options.max, 3);
  } finally {
    await pool.end();
  }
});

// --- Integração: conecta num Postgres local, se houver. ---
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

test(
  'integração: o pool conecta contra um Postgres local (SELECT 1)',
  { skip: temBanco ? false : 'sem Postgres local acessível' },
  async () => {
    const pool = criarPool();
    try {
      assert.equal(await verificarBanco(pool), true);
      const valor = await comTransacao(pool, async (c) => {
        const { rows } = await c.query('SELECT 7 AS n');
        return rows[0].n;
      });
      assert.equal(valor, 7);
    } finally {
      await pool.end();
    }
  },
);
