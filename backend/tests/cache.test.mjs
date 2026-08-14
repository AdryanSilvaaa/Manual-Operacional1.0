// Testes da camada de cache (T3). Usam um Redis falso em memória e um Redis
// "quebrado" (lança em tudo) para exercitar a degradação segura — sem Redis real.

import test from 'node:test';
import assert from 'node:assert/strict';

// Ambiente mínimo válido para o boot de env.js ao importar o cache.
process.env.DATABASE_URL ||= 'postgres://u:p@localhost:5432/db';
process.env.JWT_SECRET ||= 'segredo-de-teste-com-mais-de-32-caracteres';
process.env.REDIS_URL ||= 'redis://localhost:6379';
process.env.GCS_BUCKET ||= 'bucket-de-teste';

const { criarCache, chaveComEscopo, prefixoEscopo } = await import('../src/cache/cache.js');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function combinaGlob(pattern, texto) {
  const re = new RegExp(
    '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
  );
  return re.test(texto);
}

// Redis falso em memória. Não implementa KEYS de propósito: se o código usasse
// KEYS em vez de SCAN, quebraria — provando que delByPrefix usa SCAN.
function redisFalso() {
  const store = new Map();
  return {
    async get(k) {
      return store.has(k) ? store.get(k) : null;
    },
    async set(k, v) {
      store.set(k, v);
      return 'OK';
    },
    async del(k) {
      const chaves = Array.isArray(k) ? k : [k];
      let n = 0;
      for (const c of chaves) if (store.delete(c)) n += 1;
      return n;
    },
    async scan(cursor, { MATCH }) {
      const keys = [...store.keys()].filter((k) => combinaGlob(MATCH, k));
      return { cursor: 0, keys };
    },
    _store: store,
  };
}

// Redis que sempre falha (simula Redis fora do ar).
function redisQuebrado() {
  const erro = () => {
    throw new Error('Redis indisponível');
  };
  return { get: erro, set: erro, del: erro, scan: erro };
}

test('duas leituras da mesma chave produzem 1 miss e 1 hit', async () => {
  const cache = criarCache({ client: redisFalso(), ttlPadrao: 60 });
  let cargas = 0;
  const carregar = async () => {
    cargas += 1;
    return { valor: 1 };
  };
  const primeira = await cache.wrap('k', carregar); // miss -> carrega
  const segunda = await cache.wrap('k', carregar); // hit
  assert.deepEqual(primeira, { valor: 1 });
  assert.deepEqual(segunda, { valor: 1 });
  assert.equal(cargas, 1);
  const stats = cache.getStats();
  assert.equal(stats.misses, 1);
  assert.equal(stats.hits, 1);
  assert.equal(stats.hitRatio, 0.5);
});

test('get/set/del diretos funcionam e contam hit/miss', async () => {
  const cache = criarCache({ client: redisFalso() });
  assert.equal(await cache.get('x'), null); // miss
  await cache.set('x', { a: 1 });
  assert.deepEqual(await cache.get('x'), { a: 1 }); // hit
  await cache.del('x');
  assert.equal(await cache.get('x'), null); // miss
  const stats = cache.getStats();
  assert.equal(stats.hits, 1);
  assert.equal(stats.misses, 2);
});

test('wrap deduplica cargas concorrentes: N misses = 1 consulta', async () => {
  const cache = criarCache({ client: redisFalso() });
  let cargas = 0;
  const carregar = async () => {
    cargas += 1;
    await delay(15);
    return cargas;
  };
  const resultados = await Promise.all(
    Array.from({ length: 5 }, () => cache.wrap('c', carregar)),
  );
  assert.equal(cargas, 1);
  assert.deepEqual(resultados, [1, 1, 1, 1, 1]);
});

test('Redis fora degrada para o banco, sem lançar (nada de 500)', async () => {
  const cache = criarCache({ client: redisQuebrado() });
  const valor = await cache.wrap('k', async () => 'do-banco');
  assert.equal(valor, 'do-banco');
  // Nenhuma operação de cache deve lançar quando o Redis está fora.
  assert.equal(await cache.get('x'), null);
  await cache.set('x', 1);
  await cache.del('x');
  assert.equal(await cache.delByPrefix('p:'), 0);
});

test('sem client, o cache opera degradado (tudo miss / no-op)', async () => {
  const cache = criarCache({ client: null });
  assert.equal(await cache.get('x'), null);
  const v = await cache.wrap('k', async () => 42);
  assert.equal(v, 42);
  assert.equal(cache.getStats().misses >= 1, true);
});

test('delByPrefix remove por prefixo usando SCAN (nunca KEYS)', async () => {
  const client = redisFalso();
  const cache = criarCache({ client });
  await cache.set('manuais:dep=5:papel=gerente:lista', [1]);
  await cache.set('manuais:dep=5:papel=usuario:lista', [2]);
  await cache.set('manuais:dep=9:papel=gerente:lista', [3]);
  const removidas = await cache.delByPrefix('manuais:dep=5:');
  assert.equal(removidas, 2);
  assert.equal(await cache.get('manuais:dep=5:papel=gerente:lista'), null);
  assert.equal(await cache.get('manuais:dep=5:papel=usuario:lista'), null);
  assert.deepEqual(await cache.get('manuais:dep=9:papel=gerente:lista'), [3]);
});

test('chaveComEscopo inclui SEMPRE papel e departamento', () => {
  const gerenteA = chaveComEscopo('manuais', { papel: 'gerente', departamento_id: 1 }, 'lista');
  const gerenteB = chaveComEscopo('manuais', { papel: 'gerente', departamento_id: 2 }, 'lista');
  assert.match(gerenteA, /papel=gerente/);
  assert.match(gerenteA, /dep=1/);
  // Departamentos diferentes -> chaves diferentes (não vaza entre departamentos).
  assert.notEqual(gerenteA, gerenteB);

  const usuarioA = chaveComEscopo('manuais', { papel: 'usuario', departamento_id: 1 }, 'lista');
  // Papéis diferentes no mesmo depto -> chaves diferentes.
  assert.notEqual(gerenteA, usuarioA);

  const admin = chaveComEscopo('manuais', { papel: 'administrador', departamento_id: null }, 'lista');
  assert.match(admin, /dep=global/);
  assert.match(admin, /papel=administrador/);
});

test('prefixoEscopo agrupa por departamento para invalidação', () => {
  assert.equal(prefixoEscopo('sistemas', 7), 'sistemas:dep=7:');
  assert.equal(prefixoEscopo('sistemas', null), 'sistemas:dep=global:');
});

test('getStats começa zerado com hitRatio 0', () => {
  const cache = criarCache({ client: redisFalso() });
  assert.deepEqual(cache.getStats(), { hits: 0, misses: 0, hitRatio: 0 });
});
