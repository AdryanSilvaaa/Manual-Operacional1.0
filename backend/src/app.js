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
import unitRoutes from './routes/units.js';
import systemRoutes from './routes/systems.js';
import userRoutes from './routes/users.js';
import progressRoutes from './routes/progress.js';
import examRoutes from './routes/exams.js';
import examTemplateRoutes from './routes/examTemplates.js';
import uploadRoutes from './routes/uploads.js';
import brandingRoutes from './routes/branding.js';
import { pool } from './config/db.js';

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const uploadsDirectory = path.join(currentDirectory, '..', 'uploads');
const frontendDirectory = path.join(currentDirectory, '..', '..', 'frontend', 'dist');

const app = express();

// Não revela que o servidor é Express (dificulta a vida de quem procura falhas conhecidas).
app.disable('x-powered-by');
// Atrás do balanceador do Google Cloud, req.ip passa a ser o IP real do usuário (usado no bloqueio de login).
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
// Compacta JSON e textos (o relatório do Painel de Uso cai para cerca de 1/10 do tamanho). Vídeos e PDFs não são recompactados.
app.use(compression());

// Cabeçalhos de segurança aplicados a todas as respostas (sem depender de biblioteca extra):
// - nosniff: o navegador não "adivinha" o tipo do arquivo (um PDF não vira HTML executável);
// - X-Frame-Options/frame-ancestors: o sistema não pode ser aberto dentro de iframe de outro site (clickjacking);
// - Referrer-Policy: não vaza o endereço completo das telas para sites externos;
// - HSTS (só em produção, atrás de HTTPS): o navegador passa a usar sempre HTTPS.
app.use((request, response, next) => {
  response.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  });
  if (process.env.NODE_ENV === 'production') response.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Só os endereços do frontend listados em FRONTEND_URL (separados por vírgula) podem chamar a API pelo navegador.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins }));
// A aparência leva as logos (até 512 KB cada) no próprio JSON; por isso tem limite maior e vem antes do parser geral.
app.use('/api/branding', express.json({ limit: '2mb' }), brandingRoutes);
app.use(express.json({ limit: '1mb' }));
// Os arquivos enviados têm nome único (uuid), então o navegador pode guardá-los em cache sem revalidar.
// dotfiles/index: não entrega arquivos ocultos nem lista pastas.
app.use('/uploads', express.static(uploadsDirectory, { maxAge: '7d', immutable: true, dotfiles: 'deny', index: false }));

// Vivacidade: responde 200 sempre que o processo está de pé (não consulta o banco).
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

// Rotas da API, uma por assunto. Cada arquivo em routes/ define autenticação e permissão de cada endpoint.
app.use('/api/auth', authRoutes);
app.use('/api/systems', systemRoutes);
app.use('/api/manuals', manualRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sectors', sectorRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/exam-templates', examTemplateRoutes);
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

// Qualquer endereço não atendido acima.
app.use((request, response) => {
  response.status(404).json({ message: 'Rota não encontrada' });
});

// Mensagens para violações de restrição do PostgreSQL, em vez do texto técnico do banco.
const DUPLICATE_MESSAGES = {
  idx_users_identificador_unique: 'Já existe um usuário com este login',
  users_email_key: 'Já existe um usuário com este e-mail',
  sectors_nome_key: 'Já existe um setor com este nome',
  idx_units_nome_unique: 'Já existe uma unidade com esse nome'
};

// Tratador final de erros: transforma erros conhecidos em mensagens claras e esconde detalhes internos.
app.use((error, request, response, next) => {
  console.error(error);
  const databaseUnavailable = ['28P01', 'ECONNREFUSED', '3D000'].includes(error?.code);

  if (error?.code === '23505') {
    return response.status(409).json({ message: DUPLICATE_MESSAGES[error.constraint] || 'Este registro já existe' });
  }
  if (error?.code === '23503') {
    return response.status(409).json({ message: 'Não é possível concluir: o registro está ligado a outros dados' });
  }
  // 22P02: texto onde o banco esperava número (ex.: /api/manuals/abc). 22001: texto maior que a coluna.
  if (error?.code === '22P02') return response.status(400).json({ message: 'Identificador inválido' });
  if (error?.code === '22001') return response.status(400).json({ message: 'Um dos campos passa do tamanho permitido' });
  // Corpo JSON malformado ou grande demais (erros do express.json).
  if (error?.type === 'entity.parse.failed') return response.status(400).json({ message: 'Dados enviados em formato inválido' });
  if (error?.type === 'entity.too.large') return response.status(413).json({ message: 'Dados enviados maiores que o permitido' });

  if (databaseUnavailable) {
    return response.status(503).json({ message: 'Banco de dados indisponível ou credenciais incorretas' });
  }
  // Erros com status definido pelo próprio código (400, 403, 404, 413...) mostram a mensagem escrita para o usuário.
  // Os demais (500) são falhas inesperadas: a mensagem técnica fica só no log, nunca na resposta.
  const status = Number(error?.status) || 500;
  response.status(status).json({ message: status < 500 ? error.message : 'Erro interno do servidor' });
});

export default app;
