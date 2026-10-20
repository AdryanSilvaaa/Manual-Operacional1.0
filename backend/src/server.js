/**
 * Entrada do backend: carrega o ambiente e abre a porta HTTP.
 * Altere PORT no .env para mudar a porta; a configuração da API fica em app.js.
 * Ao receber SIGTERM (deploy ou redução de instâncias no Cloud Run), termina as requisições em andamento antes de sair.
 */
import 'dotenv/config';
import app from './app.js';
import { pool } from './config/db.js';

const port = Number(process.env.PORT) || 4000;

const server = app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});

// Mantém conexões keep-alive abertas por mais tempo que o balanceador, evitando erros 502 intermitentes.
server.keepAliveTimeout = Number(process.env.KEEP_ALIVE_TIMEOUT_MS) || 65000;
server.headersTimeout = server.keepAliveTimeout + 5000;

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} recebido: encerrando o servidor`);
  // Força a saída se alguma requisição longa (upload) não terminar a tempo.
  setTimeout(() => process.exit(1), Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10000).unref();
  server.close(() => {
    pool.end().catch(() => {}).finally(() => process.exit(0));
  });
  server.closeIdleConnections?.();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('Promise rejeitada sem tratamento:', reason);
});
