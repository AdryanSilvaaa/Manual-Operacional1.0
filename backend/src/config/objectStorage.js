/**
 * Armazenamento em bucket compatível com S3 (Cloudflare R2, AWS S3, MinIO; Google Cloud Storage pela API XML).
 * O bucket fica privado: o navegador envia direto por uma URL assinada de PUT e lê por URLs assinadas de GET.
 * No banco fica só a chave do objeto (ex.: videos/uuid.mp4), nunca a URL assinada.
 * Configuração em S3_* no .env; trocar de fornecedor é mudar endpoint, região, bucket e chaves.
 */
import fs from 'fs';
import { v4 as uuid } from 'uuid';

const EXTENSIONS = { 'application/pdf': '.pdf', 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };
const KEY_PATTERN = /^(pdfs|videos)\/[0-9a-f-]{36}\.(pdf|mp4|webm|mov)$/;

const bucket = process.env.S3_BUCKET;
const uploadTtl = Number(process.env.UPLOAD_URL_TTL_SECONDS) || 600;
const readTtl = Number(process.env.FILE_URL_TTL_SECONDS) || 4 * 60 * 60;

let sdk;
// Carrega o SDK só quando o bucket é usado, para não pesar na inicialização dos outros modos.
async function client() {
  if (!sdk) {
    const [s3, presigner] = await Promise.all([import('@aws-sdk/client-s3'), import('@aws-sdk/s3-request-presigner')]);
    sdk = {
      ...s3,
      getSignedUrl: presigner.getSignedUrl,
      client: new s3.S3Client({
        region: process.env.S3_REGION || 'auto',
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
        credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
      })
    };
  }
  return sdk;
}

export const isObjectKey = (value) => KEY_PATTERN.test(String(value || ''));

export function newObjectKey(kind, contentType) {
  return `${kind === 'pdf' ? 'pdfs' : 'videos'}/${uuid()}${EXTENSIONS[contentType] || ''}`;
}

/** URL assinada para o navegador enviar o arquivo direto ao bucket, válida por UPLOAD_URL_TTL_SECONDS. */
export async function createUploadUrl(key, contentType) {
  const { client: s3, PutObjectCommand, getSignedUrl } = await client();
  const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn: uploadTtl });
  return { url, headers: { 'Content-Type': contentType }, expiresIn: uploadTtl };
}

/** URL assinada de leitura; gerada a cada abertura do manual, depois de conferir o acesso do usuário. */
export async function createReadUrl(key) {
  const { client: s3, GetObjectCommand, getSignedUrl } = await client();
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentDisposition: 'inline' }), { expiresIn: readTtl });
}

export async function describeObject(key) {
  const { client: s3, HeadObjectCommand } = await client();
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { size: Number(head.ContentLength) || 0, contentType: head.ContentType || '' };
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') return null;
    throw error;
  }
}

export async function readObject(key) {
  const { client: s3, GetObjectCommand } = await client();
  const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return Buffer.from(await result.Body.transformToByteArray());
}

export async function writeObject(key, body, contentType, contentLength) {
  const { client: s3, PutObjectCommand } = await client();
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, ContentLength: contentLength }));
}

export async function writeObjectFromFile(key, filePath, size, contentType) {
  await writeObject(key, fs.createReadStream(filePath), contentType, size);
}

export async function deleteObject(key) {
  const { client: s3, DeleteObjectCommand } = await client();
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {});
}
