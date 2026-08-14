// src/cache/cache.js
//
// Cache-aside sobre Redis (Memorystore) com:
//  - get / set / del / delByPrefix (SCAN, nunca KEYS) / wrap (cache-aside);
//  - deduplicação de cargas concorrentes em wrap (N misses = 1 consulta ao banco);
//  - degradação segura: se o Redis cair, tudo cai para o banco, sem lançar 500;
//  - getStats() com hits, misses e hitRatio.
//
// REGRA CRÍTICA: a chave de cache inclui SEMPRE o papel E o departamento do
// usuário. Use `chaveComEscopo`/`prefixoEscopo` para construir chaves — assim a
// separação por papel+departamento é garantida e conteúdo não vaza entre
// departamentos (ver matriz da seção 2 e o teste crítico do T14).

import { env } from '../config/env.js';

/**
 * Prefixo de um recurso dentro de um departamento. É a base da invalidação
 * "por departamento" (delByPrefix). Administrador (departamento nulo) usa
 * o escopo "global".
 * @param {string} recurso ex.: "manuais", "sistemas".
 * @param {number|string|null|undefined} departamentoId
 * @returns {string}
 */
export function prefixoEscopo(recurso, departamentoId) {
  return `${recurso}:dep=${departamentoId ?? 'global'}:`;
}

/**
 * Constrói a chave de cache garantindo papel E departamento.
 * @param {string} recurso
 * @param {{ papel?: string, departamento_id?: number|string|null }} user
 * @param {...(string|number)} partes segmentos adicionais (ex.: id, filtro).
 * @returns {string}
 */
export function chaveComEscopo(recurso, user, ...partes) {
  const base = prefixoEscopo(recurso, user?.departamento_id);
  const cauda = [`papel=${user?.papel ?? 'anon'}`, ...partes.map(String)].join(':');
  return base + cauda;
}

/**
 * Cria a camada de cache sobre um client Redis já existente (injeção de
 * dependência — o client é criado uma única vez no container, T5). Se `client`
 * for nulo, o cache opera em modo degradado (tudo é miss / no-op).
 *
 * @param {object} [opts]
 * @param {import('redis').RedisClientType|null} [opts.client]
 * @param {number} [opts.ttlPadrao] TTL padrão em segundos (default: env.cacheTtlSeconds).
 */
export function criarCache({ client = null, ttlPadrao = env.cacheTtlSeconds } = {}) {
  const stats = { hits: 0, misses: 0 };
  // Cargas em andamento por chave — deduplica misses concorrentes.
  const emVoo = new Map();

  async function get(chave) {
    if (!client) {
      stats.misses += 1;
      return null;
    }
    try {
      const bruto = await client.get(chave);
      if (bruto == null) {
        stats.misses += 1;
        return null;
      }
      stats.hits += 1;
      return JSON.parse(bruto);
    } catch {
      // Redis fora: trata como miss e segue para o banco.
      stats.misses += 1;
      return null;
    }
  }

  async function set(chave, valor, ttl = ttlPadrao) {
    if (!client || valor === undefined) return;
    try {
      await client.set(chave, JSON.stringify(valor), { EX: ttl });
    } catch {
      // Degrada silenciosamente: não conseguir escrever no cache não é erro fatal.
    }
  }

  async function del(chave) {
    if (!client) return;
    try {
      await client.del(chave);
    } catch {
      /* degrada */
    }
  }

  /**
   * Remove todas as chaves com o prefixo dado usando SCAN (nunca KEYS, que
   * bloquearia o Redis). Retorna quantas chaves removeu.
   */
  async function delByPrefix(prefixo) {
    if (!client) return 0;
    let removidas = 0;
    try {
      let cursor = 0;
      do {
        const resposta = await client.scan(cursor, { MATCH: `${prefixo}*`, COUNT: 100 });
        cursor = resposta.cursor;
        const chaves = resposta.keys ?? [];
        if (chaves.length > 0) {
          await client.del(chaves);
          removidas += chaves.length;
        }
      } while (Number(cursor) !== 0);
    } catch {
      /* degrada */
    }
    return removidas;
  }

  /**
   * Cache-aside: devolve o valor cacheado ou carrega via `carregar()`, grava e
   * devolve. Misses concorrentes na mesma chave compartilham UMA única carga.
   * @template T
   * @param {string} chave
   * @param {() => Promise<T>} carregar consulta ao banco quando há miss.
   * @param {number} [ttl]
   * @returns {Promise<T>}
   */
  async function wrap(chave, carregar, ttl = ttlPadrao) {
    const cacheado = await get(chave);
    if (cacheado !== null) return cacheado;

    // Miss: se já há uma carga em andamento para esta chave, aproveita-a.
    if (emVoo.has(chave)) return emVoo.get(chave);

    const promessa = (async () => {
      const valor = await carregar();
      await set(chave, valor, ttl);
      return valor;
    })();
    emVoo.set(chave, promessa);
    try {
      return await promessa;
    } finally {
      emVoo.delete(chave);
    }
  }

  function getStats() {
    const total = stats.hits + stats.misses;
    return {
      hits: stats.hits,
      misses: stats.misses,
      hitRatio: total === 0 ? 0 : stats.hits / total,
    };
  }

  return { get, set, del, delByPrefix, wrap, getStats };
}

/**
 * Cria e conecta um client Redis a partir do ambiente. Usado pelo container
 * (T5), uma única vez por processo. Não derruba o boot se o Redis estiver fora:
 * o client tenta reconectar em segundo plano e o cache degrada enquanto isso.
 *
 * @param {string} [url] endereço do Redis (default: env.redisUrl).
 * @returns {Promise<import('redis').RedisClientType>}
 */
export async function criarClienteRedis(url = env.redisUrl) {
  const { createClient } = await import('redis');
  const client = createClient({ url });
  // Sem um handler de 'error', uma falha de conexão viraria exceção não tratada.
  client.on('error', () => {});
  try {
    await client.connect();
  } catch {
    // Segue com o client desconectado; comandos degradam e ele reconecta sozinho.
  }
  return client;
}
