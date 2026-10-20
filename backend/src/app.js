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
import { pool } from './config/db.js';

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const uploadsDirectory = path.join(currentDirectory, '..', 'uploads');

const app = express();

app.disable('x-powered-by');
// Atrás do balanceador do Google Cloud, req.ip passa a ser o IP real do usuário (usado no bloqueio de login).
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
// Compacta JSON e textos (o relatório do Painel de Uso cai para cerca de 1/10 do tamanho). Vídeos e PDFs não são recompactados.
app.use(compression());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
// Os arquivos enviados têm nome único (uuid), então o navegador pode guardá-los em cache sem revalidar.
app.use('/uploads', express.static(uploadsDirectory, { maxAge: '7d', immutable: true }));

app.get('/health', (request, response) => {
  response.json({ status: 'ok', service: 'Manual Operacional Digital API' });
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
