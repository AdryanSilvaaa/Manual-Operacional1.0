// Testes do container de dependências e healthchecks (T5). A lógica é exercida
// com dependências falsas (sem banco/Redis reais). Um teste extra confirma que
// os singletons { db, cache, storage } vêm de um único lugar.

import test from 'node:test';
import assert from 'node:assert/strict';

// Ambiente mínimo válido para o boot de env.js.
process.env.DATABASE_URL ||= 'postgres://u:p@localhost:5432/db';
process.env.JWT_SECRET ||= 'segredo-de-teste-com-mais-de-32-caracteres';
process.env.REDIS_URL ||= 'redis://localhost:6379';
process.env.GCS_BUCKET ||= 'bucket-de-teste';

const { criarContainer } = await import('../src/container.js');

function dbOk() {
  return { query: async () => ({ rows: [{ ok: 1 }] }), end: async () => {} };
}
function dbFora() {
  return {
    query: async () => {
      throw new Error('sem conexão');
    },
    end: async () => {},
  };
}
function redisOk() {
  return { ping: async () => 'PONG', quit: async () => {} };
}
function redisFora() {
  return {
    ping: async () => {
      throw new Error('Redis fora');
    },
    quit: async () => {},
  };
}

test('saude() responde ok sem tocar em dependência externa', () => {
  // db.query lança se for chamado — saude() não deve chamá-lo.
  const db = {
    query: () => {
      throw new Error('saude não pode tocar o banco');
    },
  };
  const clienteRedis = {
    ping: () => {
      throw new Error('saude não pode tocar o Redis');
    },
  };
  const c = criarContainer({ db, cache: {}, storage: {}, clienteRedis });
  const r = c.saude();
  assert.equal(r.status, 'ok');
  assert.ok(r.hora);
});

test('prontidao(): banco ok + Redis ok => pronto e cache ok', async () => {
  const c = criarContainer({ db: dbOk(), cache: {}, storage: {}, clienteRedis: redisOk() });
  assert.deepEqual(await c.prontidao(), { pronto: true, banco: 'ok', cache: 'ok' });
});

test('prontidao(): Redis fora conta como degradado, mas segue pronto', async () => {
  const c = criarContainer({ db: dbOk(), cache: {}, storage: {}, clienteRedis: redisFora() });
  assert.deepEqual(await c.prontidao(), { pronto: true, banco: 'ok', cache: 'degradado' });
});

test('prontidao(): banco fora => não pronto', async () => {
  const c = criarContainer({ db: dbFora(), cache: {}, storage: {}, clienteRedis: redisOk() });
  const r = await c.prontidao();
  assert.equal(r.pronto, false);
  assert.equal(r.banco, 'fora');
});

test('prontidao(): sem clienteRedis, cache é degradado', async () => {
  const c = criarContainer({ db: dbOk(), cache: {}, storage: {}, clienteRedis: null });
  const r = await c.prontidao();
  assert.equal(r.cache, 'degradado');
  assert.equal(r.pronto, true);
});

test('encerrar() fecha pool e Redis', async () => {
  let poolFechado = false;
  let redisFechado = false;
  const db = { end: async () => { poolFechado = true; } };
  const clienteRedis = { quit: async () => { redisFechado = true; } };
  const c = criarContainer({ db, cache: {}, storage: {}, clienteRedis });
  await c.encerrar();
  assert.equal(poolFechado, true);
  assert.equal(redisFechado, true);
});

test('encerrar() cai para disconnect se quit falhar', async () => {
  let desconectado = false;
  const clienteRedis = {
    quit: async () => {
      throw new Error('quit falhou');
    },
    disconnect: async () => {
      desconectado = true;
    },
  };
  const c = criarContainer({ db: { end: async () => {} }, cache: {}, storage: {}, clienteRedis });
  await c.encerrar();
  assert.equal(desconectado, true);
});

test('registrarEncerramento fecha o servidor ANTES das conexões e não sai (sair:false)', async () => {
  const ordem = [];
  const server = {
    close(cb) {
      ordem.push('server-close');
      cb();
    },
  };
  const db = { end: async () => { ordem.push('db-end'); } };
  const clienteRedis = { quit: async () => { ordem.push('redis-quit'); } };
  const c = criarContainer({ db, cache: {}, storage: {}, clienteRedis });

  // sinais: [] para não registrar handlers globais; sair:false para não matar o teste.
  const tratar = c.registrarEncerramento(server, { sinais: [], sair: false });
  await tratar();

  assert.deepEqual(ordem, ['server-close', 'db-end', 'redis-quit']);
  // Idempotente: chamar de novo não refaz o encerramento.
  await tratar();
  assert.deepEqual(ordem, ['server-close', 'db-end', 'redis-quit']);
});

test('os singletons db, cache e storage vêm de um único lugar', async () => {
  const mod = await import('../src/container.js');
  try {
    assert.ok(mod.db, 'db exportado');
    assert.ok(mod.cache && typeof mod.cache.wrap === 'function', 'cache exportado');
    assert.ok(mod.storage && typeof mod.storage.createReadUrl === 'function', 'storage exportado');
    for (const nome of ['saude', 'prontidao', 'encerrar', 'registrarEncerramento', 'conectar']) {
      assert.equal(typeof mod[nome], 'function', `${nome} exportado`);
    }
    // O default também expõe as mesmas instâncias.
    assert.equal(mod.default.db, mod.db);
    assert.equal(mod.default.storage, mod.storage);
  } finally {
    // Fecha handles do singleton real para o processo de teste sair limpo.
    await mod.encerrar();
  }
});
