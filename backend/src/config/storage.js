/**
 * Salva e entrega PDFs e vídeos. Três destinos, escolhidos por STORAGE_DRIVER (ou detectados pelo .env):
 * - s3: bucket compatível com S3 (Cloudflare R2 no piloto). Upload direto do navegador e leitura por URL assinada.
 * - supabase: Supabase Storage com URL pública (legado).
 * - local: pasta backend/uploads. Serve para uma máquina só (desenvolvimento ou a VM de deploy/vm); não funciona com mais de uma instância.
 * Nos modos supabase e local, o arquivo chega pelo backend em disco temporário (middleware/upload.js).
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuid } from 'uuid';
import * as objectStorage from './objectStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseBucket = process.env.SUPABASE_BUCKET || 'manuals';

export const storageDriver = process.env.STORAGE_DRIVER
  || (process.env.S3_BUCKET ? 's3' : supabaseUrl && supabaseKey ? 'supabase' : 'local');

const supabase = storageDriver === 'supabase' ? createClient(supabaseUrl, supabaseKey) : null;

/** Só o bucket S3 recebe o arquivo direto do navegador; os outros modos usam o envio pelo backend. */
export const supportsDirectUpload = storageDriver === 's3';

// Alguns PDFs gerados por sistemas externos incluem JavaScript que abre a janela
// de impressão automaticamente. Mantém o arquivo intacto em tamanho/estrutura,
// mas troca apenas as chamadas de impressão por uma expressão sem efeito.
export function sanitizePdfBuffer(buffer) {
  const source = buffer.toString('latin1');
  const sanitized = source
    .replaceAll('this.print', 'void      ')
    .replaceAll('app.execMenuItem("Print")', 'void(0)                  ')
    .replaceAll("app.execMenuItem('Print')", 'void(0)                  ');

  return sanitized === source ? buffer : Buffer.from(sanitized, 'latin1');
}

/** Grava um arquivo recebido pelo backend e devolve o valor salvo no banco (chave, URL pública ou caminho local). */
export async function uploadFile(file, folder) {
  const extension = path.extname(file.originalname);
  const isPdf = file.mimetype === 'application/pdf';
  // Só o PDF é lido inteiro, para remover o comando de impressão automática.
  const pdfBuffer = isPdf ? sanitizePdfBuffer(await fs.readFile(file.path)) : null;

  if (storageDriver === 's3') {
    const key = objectStorage.newObjectKey(isPdf ? 'pdf' : 'video', file.mimetype);
    if (pdfBuffer) await objectStorage.writeObject(key, pdfBuffer, file.mimetype, pdfBuffer.length);
    else await objectStorage.writeObjectFromFile(key, file.path, file.size, file.mimetype);
    return key;
  }

  if (supabase) {
    const fileName = `${folder}/${uuid()}${extension}`;
    const { error } = await supabase.storage
      .from(supabaseBucket)
      .upload(fileName, pdfBuffer || await fs.readFile(file.path), {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      throw new Error(`Falha no upload para o Supabase: ${error.message}`);
    }

    const { data } = supabase.storage.from(supabaseBucket).getPublicUrl(fileName);
    return data.publicUrl;
  }

  const uploadsDir = path.join(__dirname, '..', '..', 'uploads', folder);
  await fs.mkdir(uploadsDir, { recursive: true });
  const diskName = `${uuid()}${extension}`;
  const diskPath = path.join(uploadsDir, diskName);
  if (pdfBuffer) await fs.writeFile(diskPath, pdfBuffer);
  else await fs.copyFile(file.path, diskPath);

  return `/uploads/${folder}/${diskName}`;
}

/**
 * Confere um arquivo enviado direto ao bucket antes de ligá-lo ao manual: existe, tem o tipo e o tamanho permitidos
 * e, se for PDF, começa como PDF. Neutraliza a impressão automática do PDF. Devolve a chave ou lança erro 400/413.
 */
export async function confirmDirectUpload(key, kind, { allowedTypes, maxBytes }) {
  const expectedFolder = kind === 'pdf' ? 'pdfs/' : 'videos/';
  if (!objectStorage.isObjectKey(key) || !key.startsWith(expectedFolder)) throw httpError(400, `Arquivo de ${kind === 'pdf' ? 'PDF' : 'vídeo'} inválido`);

  const object = await objectStorage.describeObject(key);
  if (!object) throw httpError(400, `O ${kind === 'pdf' ? 'PDF' : 'vídeo'} não foi encontrado no armazenamento. Envie de novo.`);
  if (object.size > maxBytes) {
    await objectStorage.deleteObject(key);
    throw httpError(413, `O ${kind === 'pdf' ? 'PDF' : 'vídeo'} passa do limite de ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }
  const contentType = object.contentType.split(';')[0].trim();
  if (!allowedTypes.includes(contentType)) throw httpError(400, 'Formato de arquivo nao permitido');

  if (kind === 'pdf') {
    const buffer = await objectStorage.readObject(key);
    if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw httpError(400, 'O arquivo enviado não é um PDF válido');
    const sanitized = sanitizePdfBuffer(buffer);
    if (sanitized !== buffer) await objectStorage.writeObject(key, sanitized, 'application/pdf', sanitized.length);
  }
  return key;
}

/** Valor salvo no banco → endereço que o navegador abre. Chaves do bucket viram URLs assinadas temporárias. */
export async function resolveFileUrl(value) {
  if (!value || !objectStorage.isObjectKey(value) || storageDriver !== 's3') return value;
  return objectStorage.createReadUrl(value);
}

// Só arquivos gravados por uploadFile: /uploads/pdfs/<uuid>.pdf ou /uploads/videos/<uuid>.mp4 (nada de "..").
const LOCAL_FILE_PATTERN = /^\/uploads\/(pdfs|videos)\/([0-9a-f-]{36}\.[a-z0-9]{2,5})$/i;

/**
 * Apaga do armazenamento um arquivo que saiu do manual (chave do bucket, caminho /uploads/... ou URL pública do Supabase).
 * Valores fora desses formatos são ignorados. Falhas não interrompem: o banco já foi atualizado.
 */
export async function deleteStoredFile(value) {
  if (!value) return;
  if (objectStorage.isObjectKey(value)) {
    if (storageDriver === 's3') await objectStorage.deleteObject(value);
    return;
  }
  const local = String(value).match(LOCAL_FILE_PATTERN);
  if (local) {
    await fs.unlink(path.join(__dirname, '..', '..', 'uploads', local[1], local[2])).catch(() => {});
    return;
  }
  const marker = `/storage/v1/object/public/${supabaseBucket}/`;
  const position = String(value).indexOf(marker);
  if (supabase && position >= 0) {
    await supabase.storage.from(supabaseBucket).remove([decodeURIComponent(value.slice(position + marker.length))]);
  }
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
