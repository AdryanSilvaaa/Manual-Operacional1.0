/**
 * Configura o recebimento dos campos pdf e video.
 * Limites de tamanho em UPLOAD_MAX_PDF_MB e UPLOAD_MAX_VIDEO_MB (.env); fields define nomes/quantidades aceitos.
 * Os arquivos vão para a pasta temporária do sistema (não para a memória do processo) e são apagados ao fim da requisição.
 */
import fs from 'fs/promises';
import os from 'os';
import multer from 'multer';

const storage = multer.diskStorage({ destination: os.tmpdir() });

const MB = 1024 * 1024;
// Limites por tipo, em MB. Mantenha iguais a frontend/src/constants/uploads.js.
// Vídeo: 10 min em 1080p H.264 a ~2,5 Mbps fica perto de 190 MB.
export const MAX_PDF_MB = Number(process.env.UPLOAD_MAX_PDF_MB) || 20;
export const MAX_VIDEO_MB = Number(process.env.UPLOAD_MAX_VIDEO_MB) || 200;

// Tipos aceitos por campo; também usados no upload direto ao bucket (controllers/uploadController.js).
export const ALLOWED_TYPES = {
  pdf: ['application/pdf'],
  video: ['video/mp4', 'video/webm', 'video/quicktime']
};
export const maxBytesFor = (kind) => (kind === 'pdf' ? MAX_PDF_MB : MAX_VIDEO_MB) * MB;

const receiveManualFiles = multer({
  storage,
  limits: {
    // O multer só aceita um limite geral; o do PDF, menor, é conferido depois do recebimento.
    fileSize: Math.max(MAX_PDF_MB, MAX_VIDEO_MB) * MB
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES[file.fieldname]?.includes(file.mimetype)) {
      return cb(new Error('Formato de arquivo nao permitido'));
    }

    cb(null, true);
  }
}).fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]);

function removeTemporaryFiles(req) {
  const files = Object.values(req.files || {}).flat();
  return Promise.all(files.map((file) => fs.rm(file.path, { force: true }).catch(() => {})));
}

export function uploadManualFiles(req, res, next) {
  // 'close' dispara tanto em resposta concluída quanto em conexão interrompida.
  res.on('close', () => { removeTemporaryFiles(req); });
  receiveManualFiles(req, res, (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: `Arquivo muito grande. Limites: PDF até ${MAX_PDF_MB} MB e vídeo até ${MAX_VIDEO_MB} MB.` });
    }
    if (error) return res.status(400).json({ message: error.message });

    const pdf = req.files?.pdf?.[0];
    if (pdf && pdf.size > MAX_PDF_MB * MB) {
      return res.status(413).json({ message: `O PDF passa de ${MAX_PDF_MB} MB. Reduza o arquivo antes de enviar.` });
    }
    next();
  });
}
