import test from 'node:test';
import assert from 'node:assert/strict';
import { checkEnv } from '../src/config/env.js';

const base = { DATABASE_URL: 'postgres://u:p@localhost/db', JWT_SECRET: 'x'.repeat(48), FRONTEND_URL: 'https://prumo.exemplo.com' };

test('ambiente completo de produção passa sem erros', () => {
  const { errors } = checkEnv({ ...base, NODE_ENV: 'production', STORAGE_DRIVER: 'local' });
  assert.deepEqual(errors, []);
});

test('produção recusa JWT_SECRET curto ou o valor de exemplo', () => {
  assert.equal(checkEnv({ ...base, NODE_ENV: 'production', JWT_SECRET: 'curto' }).errors.length, 1);
  assert.equal(checkEnv({ ...base, NODE_ENV: 'production', JWT_SECRET: 'troque-este-segredo' }).errors.length, 1);
  // Em desenvolvimento o segredo curto é aceito.
  assert.deepEqual(checkEnv({ ...base, JWT_SECRET: 'curto' }).errors, []);
});

test('produção recusa o modo demonstração', () => {
  const { errors } = checkEnv({ ...base, NODE_ENV: 'production', DEV_DEMO_MODE: 'true' });
  assert.ok(errors.some((message) => message.includes('DEV_DEMO_MODE')));
});

test('DATABASE_URL e JWT_SECRET são obrigatórias (o banco é dispensado só no modo demonstração local)', () => {
  const { errors } = checkEnv({});
  assert.ok(errors.some((message) => message.includes('DATABASE_URL')));
  assert.ok(errors.some((message) => message.includes('JWT_SECRET')));
  assert.ok(!checkEnv({ JWT_SECRET: 'dev', DEV_DEMO_MODE: 'true' }).errors.some((message) => message.includes('DATABASE_URL')));
});

test('bucket S3 exige nome e chaves', () => {
  const { errors } = checkEnv({ ...base, S3_BUCKET: 'manuais' });
  assert.equal(errors.length, 2);
  assert.deepEqual(checkEnv({ ...base, S3_BUCKET: 'manuais', S3_ACCESS_KEY_ID: 'a', S3_SECRET_ACCESS_KEY: 'b' }).errors, []);
  assert.equal(checkEnv({ ...base, STORAGE_DRIVER: 'ftp' }).errors.length, 1);
});

test('armazenamento local em produção gera só aviso', () => {
  const { errors, warnings } = checkEnv({ ...base, NODE_ENV: 'production' });
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 1);
});
