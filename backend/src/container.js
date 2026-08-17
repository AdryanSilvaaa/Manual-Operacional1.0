// src/container.js
//
// Container de dependências: banco, cache e storage são instanciados UMA vez por
// processo (nunca por requisição) e importados a partir daqui — este é o único
// lugar de onde as rotas obtêm { db, cache, storage }.
//
// Também expõe os healthchecks e o encerramento gracioso exigidos pelo Cloud Run:
//   - saude():      liveness (/healthz) — não toca em dependência externa.
//   - prontidao():  readiness (/readyz) — verifica banco e cache; Redis fora
//                   conta como degradado (ainda pronto se o banco responde).
//   - encerrar():   fecha pool e Redis.
//   - registrarEncerramento(server): fecha o servidor e as conexões no SIGTERM.
//   - conectar():   abre o handshake do Redis no startup (pool e storage são lazy).

import { createClient } from 'redis';
import { criarPool, verificarBanco } from './db/pool.js';
import { criarCache } from './cache/cache.js';
import { createStorageProvider } from './storage/index.js';
import { env } from './config/env.js';

/**
 * Monta o container a partir de dependências injetadas. Facilita testar a
 * lógica de saúde/prontidão/encerramento sem tocar em banco/Redis reais.
 *
 * @param {object} deps
 * @param {import('pg').Pool} deps.db
 * @param {object} deps.cache
 * @param {object} deps.storage
 * @param {import('redis').RedisClientType|null} [deps.clienteRedis]
 * @param {(db:any)=>Promise<boolean>} [deps.verificarDb]
 */
export function criarContainer({
  db,
  cache,
  storage,
  clienteRedis = null,
  verificarDb = verificarBanco,
} = {}) {
  // Liveness: só diz que o processo está de pé. Não toca em dependência externa.
  function saude() {
    return { status: 'ok', hora: new Date().toISOString() };
  }

  // Readiness: banco é obrigatório; Redis fora é apenas degradado.
  async function prontidao() {
    let banco = 'fora';
    try {
      banco = (await verificarDb(db)) ? 'ok' : 'fora';
    } catch {
      banco = 'fora';
    }

    let statusCache = 'degradado';
    if (clienteRedis) {
      try {
        const pong = await clienteRedis.ping();
        statusCache = pong ? 'ok' : 'degradado';
      } catch {
        statusCache = 'degradado';
      }
    }

    return { pronto: banco === 'ok', banco, cache: statusCache };
  }

  // Fecha as conexões. Erros de fechamento não impedem a saída.
  async function encerrar() {
    try {
      await db?.end?.();
    } catch {
      /* já pode estar fechado */
    }
    // `isOpen === false` = client real que nunca conectou: chamar quit() nele
    // pendura até um timeout. Fakes de teste não têm isOpen, então ainda fecham.
    if (clienteRedis && clienteRedis.isOpen !== false) {
      try {
        await clienteRedis.quit();
      } catch {
        try {
          await clienteRedis.disconnect();
        } catch {
          /* já desconectado */
        }
      }
    }
  }

  /**
   * Registra o encerramento gracioso: no sinal, para de aceitar novas conexões
   * (server.close) e então fecha pool e Redis, antes de sair.
   * @param {import('http').Server} server
   * @param {{ sinais?: string[], sair?: boolean }} [opts]
   * @returns {() => Promise<void>} o handler (útil para testes).
   */
  function registrarEncerramento(server, { sinais = ['SIGTERM', 'SIGINT'], sair = true } = {}) {
    let encerrando = false;
    const tratar = async () => {
      if (encerrando) return;
      encerrando = true;
      await new Promise((resolve) => {
        if (server && typeof server.close === 'function') server.close(() => resolve());
        else resolve();
      });
      await encerrar();
      if (sair) process.exit(0);
    };
    for (const sinal of sinais) process.on(sinal, tratar);
    return tratar;
  }

  return {
    db,
    cache,
    storage,
    clienteRedis,
    saude,
    prontidao,
    encerrar,
    registrarEncerramento,
  };
}

// --- Instâncias únicas por processo (nunca por requisição) ---
// Pool e Storage são lazy (não abrem rede no load). O client Redis é criado
// aqui, mas só conecta em conectar() — assim importar este módulo não abre
// sockets nem timers.
const db = criarPool();
const clienteRedis = createClient({ url: env.redisUrl });
clienteRedis.on('error', () => {}); // sem handler, um erro de conexão derrubaria o processo
const cache = criarCache({ client: clienteRedis });
const storage = createStorageProvider();

const container = criarContainer({ db, cache, storage, clienteRedis });

/**
 * Abre as conexões que exigem handshake (Redis). Pool e storage conectam sob
 * demanda. Não derruba o boot se o Redis estiver fora — o cache degrada e o
 * client reconecta sozinho.
 */
export async function conectar() {
  try {
    await clienteRedis.connect();
  } catch {
    /* degrada; reconecta em segundo plano */
  }
}

export const { saude, prontidao, encerrar, registrarEncerramento } = container;
export { db, cache, storage, clienteRedis };
export default container;
