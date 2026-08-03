/**
 * Configura o recebimento em memória dos campos pdf e video.
 * Altere fileSize para o limite por arquivo e fields para nomes/quantidades aceitos.
 */
import multer from 'multer';

const storage = multer.memoryStorage();

export const uploadManualFiles = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'video/mp4',
      'video/webm',
      'video/quicktime'
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Formato de arquivo nao permitido'));
    }

    cb(null, true);
  }
}).fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]);
