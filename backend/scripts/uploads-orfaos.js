/**
 * Relatório (SOMENTE LEITURA) da pasta backend/uploads, usada quando STORAGE_DRIVER=local.
 * Rode: npm run uploads:check   (precisa do DATABASE_URL no backend/.env)
 *
 * Mostra:
 *  - órfãos: arquivos na pasta que nenhum manual (atual ou versão antiga em manual_version_history) usa;
 *  - duplicados: arquivos com conteúdo idêntico (mesmo hash SHA-256), mesmo com nomes diferentes;
 *  - faltando: caminhos gravados no banco cujo arquivo não existe na pasta.
 *
 * O script NÃO apaga nada. Antes de apagar um órfão, confira se não há backup ou outro ambiente usando o mesmo banco.
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const uploadsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
const FOLDERS = ['pdfs', 'videos']; // únicas subpastas que o backend grava

// Calcula o SHA-256 lendo o arquivo em partes (não carrega vídeos grandes inteiros na memória).
function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(file).on('data', (chunk) => hash.update(chunk)).on('end', () => resolve(hash.digest('hex'))).on('error', reject);
  });
}

// Lista os arquivos de uploads/pdfs e uploads/videos como "/uploads/pasta/nome" (mesmo formato salvo no banco).
async function listFiles() {
  const files = [];
  for (const folder of FOLDERS) {
    const names = await readdir(path.join(uploadsDir, folder)).catch(() => []);
    for (const name of names) {
      const full = path.join(uploadsDir, folder, name);
      const info = await stat(full);
      if (info.isFile()) files.push({ ref: `/uploads/${folder}/${name}`, full, size: info.size });
    }
  }
  return files;
}

// Caminhos /uploads/... citados pelos manuais atuais e pelo histórico de versões.
async function listReferences() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não definido no backend/.env');
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined
  });
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT pdf_url AS ref FROM manuals UNION SELECT video_url FROM manuals
       UNION SELECT pdf_url FROM manual_version_history UNION SELECT video_url FROM manual_version_history`
    );
    return new Set(rows.map((row) => row.ref).filter((ref) => typeof ref === 'string' && ref.startsWith('/uploads/')));
  } finally {
    await client.end();
  }
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const files = await listFiles();
const references = await listReferences();
const onDisk = new Set(files.map((file) => file.ref));

const orphans = files.filter((file) => !references.has(file.ref));
const missing = [...references].filter((ref) => !onDisk.has(ref));

// Só calcula hash de arquivos com tamanho repetido (arquivo de tamanho único não pode ter cópia idêntica).
const bySize = Map.groupBy(files, (file) => file.size);
const byHash = new Map();
for (const group of bySize.values()) {
  if (group.length < 2) continue;
  for (const file of group) {
    const hash = await sha256(file.full);
    byHash.set(hash, [...(byHash.get(hash) || []), file]);
  }
}
const duplicates = [...byHash.values()].filter((group) => group.length > 1);

console.log(`Pasta: ${uploadsDir}`);
console.log(`Arquivos: ${files.length} (${mb(files.reduce((sum, file) => sum + file.size, 0))}) | Referências no banco: ${references.size}\n`);

console.log(`ÓRFÃOS (nenhum manual usa): ${orphans.length} — ${mb(orphans.reduce((sum, file) => sum + file.size, 0))}`);
orphans.forEach((file) => console.log(`  ${file.ref}  (${mb(file.size)})`));

console.log(`\nDUPLICADOS (mesmo conteúdo): ${duplicates.length} grupo(s)`);
duplicates.forEach((group, index) => {
  console.log(`  Grupo ${index + 1} — ${mb(group[0].size)} cada`);
  group.forEach((file) => console.log(`    ${file.ref}${references.has(file.ref) ? '  [em uso]' : '  [órfão]'}`));
});

console.log(`\nFALTANDO (no banco, mas não na pasta): ${missing.length}`);
missing.forEach((ref) => console.log(`  ${ref}`));
console.log('\nNada foi apagado. Revise a lista antes de remover qualquer arquivo.');
