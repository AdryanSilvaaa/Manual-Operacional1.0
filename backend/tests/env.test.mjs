// Testes da leitura/validação de ambiente (T1).
// Usam loadEnv(source) com fontes explícitas para ficarem hermético.

import test from 'node:test';
import assert from 'node:assert/strict';

// Garante que a validação no boot do módulo passe ao importar, independente
// do .env local: definimos um ambiente mínimo válido antes do import dinâmico.
process.env.DATABASE_URL ||= 'postgres://u:p@localhost:5432/db';
process.env.JWT_SECRET ||= 'segredo-de-teste-com-mais-de-32-caracteres';
process.env.REDIS_URL ||= 'redis://localhost:6379';
process.env.GCS_BUCKET ||= 'bucket-de-teste';

const { loadEnv, env } = await import('../src/config/env.js');

function baseEnv(overrides = {}) {
  return {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgres://u:p@localhost:5432/db',
    JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres',
    REDIS_URL: 'redis://localhost:6379',
    GCS_BUCKET: 'bucket-de-teste',
    ...overrides,
  };
}

test('ambiente completo carrega sem erro', () => {
  const config = loadEnv(baseEnv());
  assert.equal(config.databaseUrl, 'postgres://u:p@localhost:5432/db');
  assert.equal(config.gcsBucket, 'bucket-de-teste');
  assert.equal(config.isProduction, false);
});

test('o módulo expõe a config validada no boot', () => {
  assert.ok(env);
  assert.equal(typeof env.databaseUrl, 'string');
  assert.ok(Object.isFrozen(env));
});

test('falta de variável obrigatória quebra o boot com mensagem clara', () => {
  assert.throws(
    () => loadEnv(baseEnv({ DATABASE_URL: undefined })),
    (err) => {
      assert.match(err.message, /Configuração de ambiente inválida/);
      assert.match(err.message, /DATABASE_URL é obrigatória/);
      return true;
    },
  );
});

test('acumula TODAS as variáveis obrigatórias ausentes numa só mensagem', () => {
  assert.throws(
    () => loadEnv({ NODE_ENV: 'development' }),
    (err) => {
      for (const name of ['DATABASE_URL', 'JWT_SECRET', 'REDIS_URL', 'GCS_BUCKET']) {
        assert.match(err.message, new RegExp(name));
      }
      return true;
    },
  );
});

test('valores padrão são aplicados quando as opcionais faltam', () => {
  const config = loadEnv(baseEnv());
  assert.equal(config.port, 8080);
  assert.equal(config.signedUrlTtlSeconds, 300);
  assert.equal(config.cacheTtlSeconds, 300);
  assert.equal(config.dbPoolMax, 5);
});

test('opcional inválida (não inteiro) quebra o boot', () => {
  assert.throws(
    () => loadEnv(baseEnv({ DB_POOL_MAX: 'abc' })),
    /DB_POOL_MAX deve ser um número inteiro/,
  );
});

test('TTL de URL assinada acima de 7 dias é recusado', () => {
  assert.throws(
    () => loadEnv(baseEnv({ SIGNED_URL_TTL_SECONDS: String(7 * 24 * 60 * 60 + 1) })),
    /SIGNED_URL_TTL_SECONDS deve ser no máximo/,
  );
});

test('produção exige JWT_SECRET com no mínimo 32 caracteres', () => {
  assert.throws(
    () => loadEnv(baseEnv({ NODE_ENV: 'production', JWT_SECRET: 'curto' })),
    /JWT_SECRET deve ter no mínimo 32 caracteres em produção/,
  );
});

test('produção recusa variáveis de emulador local', () => {
  assert.throws(
    () =>
      loadEnv(
        baseEnv({ NODE_ENV: 'production', STORAGE_EMULATOR_HOST: 'http://localhost:4443' }),
      ),
    /STORAGE_EMULATOR_HOST é uma variável de emulador local/,
  );
});

test('desenvolvimento aceita endpoint de emulador do storage', () => {
  const config = loadEnv(baseEnv({ GCS_API_ENDPOINT: 'http://localhost:4443' }));
  assert.equal(config.gcsApiEndpoint, 'http://localhost:4443');
});
