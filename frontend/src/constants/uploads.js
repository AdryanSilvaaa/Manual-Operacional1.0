/**
 * Limites de upload dos manuais. Mantenha iguais a UPLOAD_MAX_PDF_MB e UPLOAD_MAX_VIDEO_MB do backend (.env);
 * o backend confere de novo, esta cópia só evita esperar o envio para descobrir o erro.
 */
export const MAX_PDF_MB = 20;
export const MAX_VIDEO_MB = 200;
export const MAX_VIDEO_MINUTES = 10;

const MB = 1024 * 1024;

function readVideoDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const done = (value) => { URL.revokeObjectURL(url); resolve(value); };
    video.preload = 'metadata';
    video.onloadedmetadata = () => done(video.duration);
    video.onerror = () => done(null);
    video.src = url;
  });
}

/** Devolve a mensagem de erro do arquivo ou '' quando ele está dentro dos limites. */
export async function validateManualFile(kind, file) {
  if (!file) return '';
  if (kind === 'pdf') return file.size > MAX_PDF_MB * MB ? `O PDF tem ${(file.size / MB).toFixed(1)} MB. O limite é ${MAX_PDF_MB} MB.` : '';
  if (file.size > MAX_VIDEO_MB * MB) return `O vídeo tem ${(file.size / MB).toFixed(0)} MB. O limite é ${MAX_VIDEO_MB} MB.`;
  const duration = await readVideoDuration(file);
  // Se o navegador não conseguir ler a duração (ex.: formato .mov em alguns navegadores), só o tamanho é conferido.
  if (duration && duration > MAX_VIDEO_MINUTES * 60 + 1) {
    const minutes = Math.floor(duration / 60);
    const seconds = String(Math.round(duration % 60)).padStart(2, '0');
    return `O vídeo tem ${minutes}:${seconds} min. O limite é ${MAX_VIDEO_MINUTES} minutos.`;
  }
  return '';
}
