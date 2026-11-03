/**
 * Upload direto ao bucket: o backend só autoriza e assina; o arquivo vai do navegador para o armazenamento,
 * sem passar pela memória nem pelo limite de 32 MB do Cloud Run. A confirmação acontece ao salvar o manual.
 */
import { createUploadUrl, newObjectKey } from '../config/objectStorage.js';
import { storageDriver, supportsDirectUpload } from '../config/storage.js';
import { ALLOWED_TYPES, MAX_PDF_MB, MAX_VIDEO_MB, maxBytesFor } from '../middleware/upload.js';

/** Diz à tela como enviar arquivos neste ambiente e quais são os limites. */
export function config(req, res) {
  res.json({ directUpload: supportsDirectUpload, driver: storageDriver, limits: { pdfMb: MAX_PDF_MB, videoMb: MAX_VIDEO_MB } });
}

export async function presign(req, res) {
  if (!supportsDirectUpload) return res.status(400).json({ message: 'Upload direto não está configurado neste ambiente' });

  const { kind, contentType } = req.body;
  const size = Number(req.body.size);
  if (!ALLOWED_TYPES[kind]?.includes(contentType)) return res.status(400).json({ message: 'Formato de arquivo nao permitido' });
  if (!size || size > maxBytesFor(kind)) {
    return res.status(413).json({ message: `Arquivo muito grande. Limites: PDF até ${MAX_PDF_MB} MB e vídeo até ${MAX_VIDEO_MB} MB.` });
  }

  const key = newObjectKey(kind, contentType);
  const upload = await createUploadUrl(key, contentType);
  res.json({ key, method: 'PUT', ...upload });
}
