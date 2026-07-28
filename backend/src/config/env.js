// src/config/env.js
//
// Leitura e validação do ambiente. A regra é falhar cedo: se algo obrigatório
// faltar ou for inválido, o boot quebra com uma mensagem clara (todas as falhas
// de uma vez). Importar este módulo já dispara a validação — ao carregar sem
// erro, a config validada fica disponível como `env` (congelada).
//
// Nada de segredo no código: tudo vem do ambiente (Secret Manager em produção).

import process from 'node:process';

const PRODUCTION = 'production';

// Sete dias em segundos — teto de validade de uma URL assinada (V4, ver T4).
const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

// Variáveis de emulador local. São úteis em desenvolvimento, mas em produção
// apontar para um emulador é quase sempre um erro de configuração perigoso,
// então recusamos explicitamente.
const EMULATOR_VARS = [
  'STORAGE_EMULATOR_HOST',
  'GCS_API_ENDPOINT',
  'PUBSUB_EMULATOR_HOST',
  'REDIS_EMULATOR_HOST',
];

// Em desenvolvimento, carrega um .env local por conveniência. dotenv não
// sobrescreve variáveis já presentes no processo, então em produção (onde as
// variáveis vêm do Cloud Run / Secret Manager) este passo é ignorado.
if ((process.env.NODE_ENV ?? '').trim() !== PRODUCTION) {
  try {
    const dotenv = await import('dotenv');
    dotenv.config();
  } catch {
    // dotenv é opcional: sem ele, seguimos apenas com o process.env do sistema.
  }
}

function toTrimmed(value) {
  return value == null ? '' : String(value).trim();
}

// Lê um inteiro opcional com valor padrão. Registra erro se estiver presente
// mas for inválido ou estiver fora do intervalo aceito.
function readInt(name, rawValue, fallback, errors, { min, max } = {}) {
  const raw = toTrimmed(rawValue);
  if (raw === '') {
    return fallback;
  }
  if (!/^-?\d+$/.test(raw)) {
    errors.push(`${name} deve ser um número inteiro (recebido: "${raw}").`);
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (min != null && parsed < min) {
    errors.push(`${name} deve ser no mínimo ${min} (recebido: ${parsed}).`);
    return fallback;
  }
  if (max != null && parsed > max) {
    errors.push(`${name} deve ser no máximo ${max} (recebido: ${parsed}).`);
    return fallback;
  }
  return parsed;
}

/**
 * Valida o ambiente informado e devolve a configuração congelada.
 * @param {NodeJS.ProcessEnv} [source] fonte das variáveis (padrão: process.env).
 * @returns {Readonly<object>} configuração validada.
 * @throws {Error} se qualquer variável obrigatória faltar ou for inválida.
 */
export function loadEnv(source = process.env) {
  const errors = [];

  const nodeEnv = toTrimmed(source.NODE_ENV) || 'development';
  const isProduction = nodeEnv === PRODUCTION;

  // Obrigatórias: sem elas a aplicação não funciona.
  const required = (name) => {
    const value = toTrimmed(source[name]);
    if (value === '') {
      errors.push(`${name} é obrigatória e não foi definida.`);
    }
    return value;
  };

  const databaseUrl = required('DATABASE_URL');
  const jwtSecret = required('JWT_SECRET');
  const redisUrl = required('REDIS_URL');
  const gcsBucket = required('GCS_BUCKET');

  // Em produção o segredo do JWT precisa ser forte.
  if (isProduction && jwtSecret !== '' && jwtSecret.length < 32) {
    errors.push('JWT_SECRET deve ter no mínimo 32 caracteres em produção.');
  }

  // Em produção, recusar qualquer variável de emulador local.
  if (isProduction) {
    for (const name of EMULATOR_VARS) {
      if (toTrimmed(source[name]) !== '') {
        errors.push(
          `${name} é uma variável de emulador local e não pode ser usada em produção.`,
        );
      }
    }
  }

  // Opcionais com valor padrão.
  const port = readInt('PORT', source.PORT, 8080, errors, { min: 1, max: 65535 });
  const signedUrlTtlSeconds = readInt(
    'SIGNED_URL_TTL_SECONDS',
    source.SIGNED_URL_TTL_SECONDS,
    300,
    errors,
    { min: 1, max: SEVEN_DAYS_SECONDS },
  );
  const cacheTtlSeconds = readInt(
    'CACHE_TTL_SECONDS',
    source.CACHE_TTL_SECONDS,
    300,
    errors,
    { min: 1 },
  );
  const dbPoolMax = readInt('DB_POOL_MAX', source.DB_POOL_MAX, 5, errors, { min: 1 });

  if (errors.length > 0) {
    const detail = errors.map((message) => `  - ${message}`).join('\n');
    throw new Error(`Configuração de ambiente inválida:\n${detail}`);
  }

  return Object.freeze({
    nodeEnv,
    isProduction,
    port,
    databaseUrl,
    jwtSecret,
    redisUrl,
    gcsBucket,
    signedUrlTtlSeconds,
    cacheTtlSeconds,
    dbPoolMax,
    // Endpoint alternativo do Cloud Storage para o emulador local (T4).
    // Sempre indefinido em produção (a variável é recusada acima).
    gcsApiEndpoint: isProduction ? undefined : toTrimmed(source.GCS_API_ENDPOINT) || undefined,
  });
}

// Validação no boot: importar o módulo já garante um ambiente válido.
export const env = loadEnv();

export default env;
