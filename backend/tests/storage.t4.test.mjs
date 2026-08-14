// Testes do provider de storage (T4). A assinatura V4 é local: geramos um par
// de chaves RSA descartável e montamos uma "service account" de teste, então
// nenhuma rede é tocada.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Ambiente mínimo válido para o boot de env.js ao importar o storage.
process.env.DATABASE_URL ||= 'postgres://u:p@localhost:5432/db';
process.env.JWT_SECRET ||= 'segredo-de-teste-com-mais-de-32-caracteres';
process.env.REDIS_URL ||= 'redis://localhost:6379';
process.env.GCS_BUCKET ||= 'bucket-de-teste';

const { createStorageProvider } = await import('../src/storage/index.js');
const { validarTtl, SETE_DIAS_SEGUNDOS } = await import('../src/storage/gcs.js');

// Service account de teste (chave RSA gerada na hora — só para assinar local).
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

function provider() {
  return createStorageProvider({
    bucket: 'meu-bucket',
    projectId: 'projeto-teste',
    credentials: {
      client_email: 'teste@projeto-teste.iam.gserviceaccount.com',
      private_key: privateKey,
    },
  });
}

test('createReadUrl devolve URL assinada V4 com X-Goog-Algorithm correto', async () => {
  const url = await provider().createReadUrl('pdfs/manual-1.pdf', { ttlSeconds: 300 });
  assert.match(url, /X-Goog-Algorithm=GOOG4-RSA-SHA256/);
  assert.match(url, /X-Goog-Signature=/);
  assert.match(url, /meu-bucket/);
  assert.match(url, /manual-1\.pdf/);
});

test('createUploadUrl devolve URL assinada V4 (PUT) com o algoritmo correto', async () => {
  const url = await provider().createUploadUrl('pdfs/novo.pdf', {
    ttlSeconds: 600,
    contentType: 'application/pdf',
  });
  assert.match(url, /X-Goog-Algorithm=GOOG4-RSA-SHA256/);
  assert.match(url, /novo\.pdf/);
});

test('objetos diferentes produzem assinaturas diferentes', async () => {
  const p = provider();
  const a = await p.createReadUrl('pdfs/a.pdf', { ttlSeconds: 300 });
  const b = await p.createReadUrl('pdfs/b.pdf', { ttlSeconds: 300 });
  assert.notEqual(a, b);
});

test('validarTtl recusa zero, negativo e acima de 7 dias', () => {
  assert.throws(() => validarTtl(0), /maior que zero/);
  assert.throws(() => validarTtl(-10), /maior que zero/);
  assert.throws(() => validarTtl(SETE_DIAS_SEGUNDOS + 1), /7 dias/);
  // Válidos não lançam.
  assert.doesNotThrow(() => validarTtl(1));
  assert.doesNotThrow(() => validarTtl(SETE_DIAS_SEGUNDOS));
});

test('createReadUrl rejeita TTL inválido antes de assinar', async () => {
  const p = provider();
  await assert.rejects(() => p.createReadUrl('x', { ttlSeconds: 0 }), /maior que zero/);
  await assert.rejects(
    () => p.createReadUrl('x', { ttlSeconds: SETE_DIAS_SEGUNDOS + 1 }),
    /7 dias/,
  );
});

test('GCSProvider exige um bucket', () => {
  assert.throws(() => createStorageProvider({ bucket: '' }), /bucket/);
});

// Done-criterion: nenhuma rota importa @google-cloud/storage diretamente.
test('nenhuma rota importa @google-cloud/storage diretamente', () => {
  const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const candidatos = ['routes', 'src/routes']
    .map((d) => path.join(backendDir, d))
    .filter((d) => existsSync(d));

  const arquivos = [];
  const coletar = (dir) => {
    for (const nome of readdirSync(dir)) {
      const alvo = path.join(dir, nome);
      if (statSync(alvo).isDirectory()) coletar(alvo);
      else if (/\.(mjs|cjs|js)$/.test(nome)) arquivos.push(alvo);
    }
  };
  candidatos.forEach(coletar);

  for (const arquivo of arquivos) {
    const conteudo = readFileSync(arquivo, 'utf8');
    assert.ok(
      !conteudo.includes('@google-cloud/storage'),
      `${arquivo} importa @google-cloud/storage diretamente — use src/storage.`,
    );
  }
});
