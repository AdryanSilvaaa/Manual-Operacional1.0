// src/db/pool.js
//
// Pool de conexões PostgreSQL. Aponta para o pooler (via Cloud SQL Auth Proxy),
// nunca direto no banco. O pooler roda em pool_mode=transaction, então o código
// NÃO pode usar prepared statements nomeados, SET de sessão nem LISTEN/NOTIFY —
// toda query aqui é simples (sem `name`) e cada transação vive num único client.

import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

/**
 * Cria um pool de conexões a partir do ambiente.
 *
 * O `max` é baixo de propósito: o total real de conexões contra o pooler é
 * `max` x número de instâncias do Cloud Run. `DATABASE_URL` deve apontar para o
 * pooler, nunca direto no banco.
 *
 * @param {import('pg').PoolConfig} [overrides] ajustes pontuais (ex.: testes).
 * @returns {import('pg').Pool}
 */
export function criarPool(overrides = {}) {
  return new Pool({
    connectionString: env.databaseUrl,
    max: env.dbPoolMax,
    // Devolve conexões ociosas para manter o footprint baixo quando o Cloud Run
    // reduz a escala.
    idleTimeoutMillis: 30_000,
    // Falha rápido se o pooler não responder, em vez de pendurar a requisição.
    connectionTimeoutMillis: 10_000,
    ...overrides,
  });
}

/**
 * Executa `fn` dentro de uma transação usando UM único client:
 * BEGIN → `fn` → COMMIT no caminho feliz; ROLLBACK se `fn` (ou o COMMIT) lançar.
 * Seguro para pool_mode=transaction porque toda a transação usa o mesmo checkout.
 *
 * @template T
 * @param {import('pg').Pool} pool
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function comTransacao(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (erro) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Se o ROLLBACK falhar (ex.: conexão já perdida), ainda propagamos o erro
      // original — é o que interessa a quem chamou.
    }
    throw erro;
  } finally {
    client.release();
  }
}

/**
 * Verificação leve de saúde do banco para o readiness (/readyz).
 * Resolve `true` se o banco respondeu; propaga o erro se não respondeu.
 *
 * @param {import('pg').Pool} pool
 * @returns {Promise<boolean>}
 */
export async function verificarBanco(pool) {
  const { rows } = await pool.query('SELECT 1 AS ok');
  return rows[0]?.ok === 1;
}
