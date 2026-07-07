import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import manualRoutes from './routes/manuals.js';
import userRoutes from './routes/users.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Manual Operacional Digital API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/manuals', manualRoutes);
app.use('/api/users', userRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  const dbUnavailable = ['28P01', 'ECONNREFUSED', '3D000'].includes(err?.code);

  res.status(err.status || 500).json({
    message: dbUnavailable
      ? 'Banco de dados indisponivel ou credenciais incorretas'
      : err.message || 'Erro interno do servidor'
  });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
