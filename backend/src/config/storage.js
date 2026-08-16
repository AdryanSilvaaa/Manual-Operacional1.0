/**
 * Salva PDFs e vídeos no Supabase ou, sem credenciais, em backend/uploads.
 * Altere bucket/pastas aqui para mudar destinos; regras de arquivo ficam em middleware/upload.js.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuid } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_BUCKET || 'manuals';

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Alguns PDFs gerados por sistemas externos incluem JavaScript que abre a janela
// de impressão automaticamente. Mantém o arquivo intacto em tamanho/estrutura,
// mas troca apenas as chamadas de impressão por uma expressão sem efeito.
function sanitizePdfBuffer(file) {
  if (file.mimetype !== 'application/pdf') return file.buffer;

  const source = file.buffer.toString('latin1');
  const sanitized = source
    .replaceAll('this.print', 'void      ')
    .replaceAll('app.execMenuItem("Print")', 'void(0)                  ')
    .replaceAll("app.execMenuItem('Print')", 'void(0)                  ');

  return sanitized === source ? file.buffer : Buffer.from(sanitized, 'latin1');
}

export async function uploadFile(file, folder) {
  const extension = path.extname(file.originalname);
  const fileName = `${folder}/${uuid()}${extension}`;
  const uploadBuffer = sanitizePdfBuffer(file);

  if (supabase) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, uploadBuffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      throw new Error(`Falha no upload para o Supabase: ${error.message}`);
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
  }

  const uploadsDir = path.join(__dirname, '..', '..', 'uploads', folder);
  await fs.mkdir(uploadsDir, { recursive: true });
  const diskName = `${uuid()}${extension}`;
  const diskPath = path.join(uploadsDir, diskName);
  await fs.writeFile(diskPath, uploadBuffer);

  return `/uploads/${folder}/${diskName}`;
}
