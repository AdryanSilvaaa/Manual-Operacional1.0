/**
 * Monta a aplicação Express, seus middlewares e rotas, sem iniciar o servidor.
 * Altere aqui CORS, limites globais, novas rotas e o tratamento final de erros.
 */
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import manualRoutes from './routes/manuals.js';
import sectorRoutes from './routes/sectors.js';
import systemRoutes from './routes/systems.js';
import userRoutes from './routes/users.js';
import progressRoutes from './routes/progress.js';
import examRoutes from './routes/exams.js';
import uploadRoutes from './routes/uploads.js';
import brandingRoutes from './routes/branding.js';
import { pool } from './config/db.js';

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const uploadsDirectory = path.join(currentDirectory, '..', 'uploads');
const frontendDirectory = path.join(currentDirectory, '..', '..', 'frontend', 'dist');

const app = express();

app.disable('x-powered-by');
// Atrás do balanceador do Google Cloud, req.ip passa a ser o IP real do usuário (usado no bloqueio de login).
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
// Compacta JSON e textos (o relatório do Painel de Uso cai para cerca de 1/10 do tamanho). Vídeos e PDFs não são recompactados.
app.use(compression());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
// A aparência leva as logos (até 512 KB cada) no próprio JSON; por isso tem limite maior e vem antes do parser geral.
app.use('/api/branding', express.json({ limit: '2mb' }), brandingRoutes);
app.use(express.json({ limit: '1mb' }));
// Os arquivos enviados têm nome único (uuid), então o navegador pode guardá-los em cache sem revalidar.
app.use('/uploads', express.static(uploadsDirectory, { maxAge: '7d', immutable: true }));

app.get('/health', (request, response) => {
  response.json({ status: 'ok', service: 'Prumo API' });
});

// Prontidão: só responde 200 com o banco acessível. Use em health checks que decidem se a instância recebe tráfego.
app.get('/health/ready', async (request, response) => {
  try {
    await pool.query('SELECT 1');
    response.json({ status: 'ok', database: 'ok' });
  } catch (error) {
    // O motivo real (senha, SSL, endereço) só vai para o log do servidor, nunca para a resposta.
    console.error('Banco indisponível no /health/ready:', error.message);
    response.status(503).json({ status: 'unavailable', database: 'indisponivel' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/systems', systemRoutes);
app.use('/api/manuals', manualRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sectors', sectorRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/uploads', uploadRoutes);

// Piloto num computador só (SERVE_FRONTEND=true): o backend também entrega as telas geradas por
// `npm run build:piloto`, então telas, API e arquivos ficam no mesmo endereço e numa porta só.
if (process.env.SERVE_FRONTEND === 'true') {
  // Os arquivos de assets têm o hash no nome; o index.html é revalidado para pegar a versão nova após cada build.
  app.use('/assets', express.static(path.join(frontendDirectory, 'assets'), { maxAge: '1y', immutable: true }));
  app.use(express.static(frontendDirectory, { index: false }));
  app.get(/^\/(?!api\/|uploads\/|health)/, (request, response) => {
    response.set('Cache-Control', 'no-cache').sendFile(path.join(frontendDirectory, 'index.html'));
  });
}

app.use((request, response) => {
  response.status(404).json({ message: 'Rota não encontrada' });
});

// Mensagens para violações de restrição do PostgreSQL, em vez do texto técnico do banco.
const DUPLICATE_MESSAGES = {
  idx_users_identificador_unique: 'Já existe um usuário com este login',
  users_email_key: 'Já existe um usuário com este e-mail',
  sectors_nome_key: 'Já existe um setor com este nome'
};

app.use((error, request, response, next) => {
  console.error(error);
  const databaseUnavailable = ['28P01', 'ECONNREFUSED', '3D000'].includes(error?.code);

  if (error?.code === '23505') {
    return response.status(409).json({ message: DUPLICATE_MESSAGES[error.constraint] || 'Este registro já existe' });
  }
  if (error?.code === '23503') {
    return response.status(409).json({ message: 'Não é possível concluir: o registro está ligado a outros dados' });
  }

  response.status(error.status || 500).json({
    message: databaseUnavailable
      ? 'Banco de dados indisponível ou credenciais incorretas'
      : error.message || 'Erro interno do servidor'
  });
});

export default app;
