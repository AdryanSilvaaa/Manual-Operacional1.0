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

export async function uploadFile(file, folder) {
  const extension = path.extname(file.originalname);
  const fileName = `${folder}/${uuid()}${extension}`;

  if (supabase) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file.buffer, {
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
  await fs.writeFile(diskPath, file.buffer);

  return `/uploads/${folder}/${diskName}`;
}
