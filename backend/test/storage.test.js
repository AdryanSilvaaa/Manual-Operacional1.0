import test from 'node:test';
import assert from 'node:assert/strict';
import { isObjectKey, newObjectKey } from '../src/config/objectStorage.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteStoredFile, resolveFileUrl, sanitizePdfBuffer } from '../src/config/storage.js';

const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('newObjectKey gera chave na pasta e com a extensão do tipo', () => {
  assert.match(newObjectKey('pdf', 'application/pdf'), /^pdfs\/[0-9a-f-]{36}\.pdf$/);
  assert.match(newObjectKey('video', 'video/quicktime'), /^videos\/[0-9a-f-]{36}\.mov$/);
});

test('isObjectKey recusa caminhos fora do padrão', () => {
  assert.equal(isObjectKey(newObjectKey('video', 'video/mp4')), true);
  assert.equal(isObjectKey('../segredo.pdf'), false);
  assert.equal(isObjectKey('pdfs/abc.pdf'), false);
  assert.equal(isObjectKey('/uploads/pdfs/x.pdf'), false);
});

test('resolveFileUrl mantém URLs antigas (locais e públicas) como estão', async () => {
  assert.equal(await resolveFileUrl('/uploads/pdfs/a.pdf'), '/uploads/pdfs/a.pdf');
  assert.equal(await resolveFileUrl('https://exemplo.com/a.pdf'), 'https://exemplo.com/a.pdf');
  assert.equal(await resolveFileUrl(null), null);
});

test('sanitizePdfBuffer neutraliza a impressão automática sem mudar o tamanho', () => {
  const original = Buffer.from('%PDF-1.4 this.print({bUI:false})', 'latin1');
  const sanitized = sanitizePdfBuffer(original);
  assert.equal(sanitized.length, original.length);
  assert.ok(!sanitized.toString('latin1').includes('this.print'));
});

test('deleteStoredFile apaga só arquivos locais gravados pelo sistema', async () => {
  const name = '00000000-0000-4000-8000-000000000000.pdf';
  const dir = path.join(backendDir, 'uploads', 'pdfs');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), '%PDF-1.4');

  await deleteStoredFile('/uploads/pdfs/../../package.json');
  await deleteStoredFile(`/uploads/pdfs/${name}`);
  await assert.rejects(fs.access(path.join(dir, name)));
  await fs.access(path.join(backendDir, 'package.json'));
});
