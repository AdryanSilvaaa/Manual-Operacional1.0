/**
 * Monta a aplicação Express, seus middlewares e rotas, sem iniciar o servidor.
 * Altere aqui CORS, limites globais, novas rotas e o tratamento final de erros.
 */
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

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const uploadsDirectory = path.join(currentDirectory, '..', 'uploads');

const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadsDirectory));

app.get('/health', (request, response) => {
  response.json({ status: 'ok', service: 'Manual Operacional Digital API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/systems', systemRoutes);
app.use('/api/manuals', manualRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sectors', sectorRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/exams', examRoutes);

app.use((request, response) => {
  response.status(404).json({ message: 'Rota não encontrada' });
});

app.use((error, request, response, next) => {
  console.error(error);
  const databaseUnavailable = ['28P01', 'ECONNREFUSED', '3D000'].includes(error?.code);

  response.status(error.status || 500).json({
    message: databaseUnavailable
      ? 'Banco de dados indisponível ou credenciais incorretas'
      : error.message || 'Erro interno do servidor'
  });
});

export default app;
