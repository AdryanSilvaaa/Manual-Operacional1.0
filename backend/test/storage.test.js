import test from 'node:test';
import assert from 'node:assert/strict';
import { isObjectKey, newObjectKey } from '../src/config/objectStorage.js';
import { resolveFileUrl, sanitizePdfBuffer } from '../src/config/storage.js';

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
