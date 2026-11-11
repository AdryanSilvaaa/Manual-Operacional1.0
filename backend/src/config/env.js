/**
 * Conferência do ambiente (.env ou variáveis do Cloud Run / VM) feita na subida do servidor (server.js).
 * Regra: falhar cedo. Se algo obrigatório faltar ou estiver inseguro em produção, o backend não sobe e mostra
 * todos os problemas de uma vez. Avisos (warnings) só aparecem no log.
 * Nada de segredo no código: tudo vem do ambiente.
 */

// Valor de exemplo do .env.example: em produção ele é recusado.
const EXAMPLE_JWT_SECRET = 'troque-este-segredo';
const STORAGE_DRIVERS = ['s3', 'supabase', 'local'];

const text = (value) => (value == null ? '' : String(value).trim());

/**
 * Confere as variáveis e devolve { errors, warnings } (listas de mensagens). Não lança erro: quem chama decide.
 * @param {Record<string, string|undefined>} source fonte das variáveis (padrão: process.env).
 */
export function checkEnv(source = process.env) {
  const errors = [];
  const warnings = [];
  const isProduction = text(source.NODE_ENV) === 'production';
  const demoMode = text(source.DEV_DEMO_MODE) === 'true';

  // Banco: obrigatório, exceto no modo demonstração de desenvolvimento (dados em memória).
  if (!text(source.DATABASE_URL) && !(demoMode && !isProduction)) errors.push('DATABASE_URL é obrigatória.');

  // Segredo que assina os tokens de login: quem o conhece consegue se passar por qualquer usuário.
  const jwtSecret = text(source.JWT_SECRET);
  if (!jwtSecret) errors.push('JWT_SECRET é obrigatória.');
  else if (isProduction && (jwtSecret.length < 32 || jwtSecret === EXAMPLE_JWT_SECRET)) {
    errors.push('JWT_SECRET deve ter no mínimo 32 caracteres aleatórios em produção (gere com: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))").');
  }

  // Modo demonstração tem admin com senha conhecida: proibido em produção.
  if (isProduction && demoMode) errors.push('DEV_DEMO_MODE=true não pode ser usado em produção.');

  // Armazenamento dos PDFs e vídeos (mesma detecção de config/storage.js).
  const driver = text(source.STORAGE_DRIVER)
    || (text(source.S3_BUCKET) ? 's3' : text(source.SUPABASE_URL) && text(source.SUPABASE_SERVICE_ROLE_KEY) ? 'supabase' : 'local');
  if (!STORAGE_DRIVERS.includes(driver)) errors.push(`STORAGE_DRIVER inválido: "${driver}" (use s3, supabase ou local).`);
  if (driver === 's3') {
    for (const name of ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) {
      if (!text(source[name])) errors.push(`${name} é obrigatória com STORAGE_DRIVER=s3.`);
    }
  }
  if (driver === 'supabase' && !(text(source.SUPABASE_URL) && text(source.SUPABASE_SERVICE_ROLE_KEY))) {
    errors.push('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias com STORAGE_DRIVER=supabase.');
  }
  if (isProduction && driver === 'local') {
    warnings.push('Arquivos em disco local (backend/uploads): funciona só com uma instância e precisa de backup da pasta.');
  }
  if (isProduction && !text(source.FRONTEND_URL) && text(source.SERVE_FRONTEND) !== 'true') {
    warnings.push('FRONTEND_URL não definida: o CORS só vai aceitar http://localhost:5173.');
  }

  return { errors, warnings };
}

/** Usado na subida do servidor: escreve os avisos no log e interrompe com a lista de erros, se houver. */
export function assertEnv(source = process.env) {
  const { errors, warnings } = checkEnv(source);
  warnings.forEach((message) => console.warn(`Aviso de configuração: ${message}`));
  if (errors.length) {
    throw new Error(`Configuração de ambiente inválida:\n${errors.map((message) => `  - ${message}`).join('\n')}`);
  }
}
