/**
 * Upload direto ao bucket (modo s3 do backend): pede ao backend uma URL assinada e envia o arquivo
 * do navegador para o armazenamento, mostrando o progresso. O backend confere o arquivo ao salvar o manual.
 */
import { createAuthHeaders, readResponse } from './api.js';

export async function getUploadConfig(apiUrl, token) {
  return readResponse(await fetch(`${apiUrl}/api/uploads/config`, { headers: createAuthHeaders(token) }));
}

function putWithProgress(url, headers, file, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    Object.entries(headers || {}).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100)); };
    request.onload = () => (request.status >= 200 && request.status < 300
      ? resolve()
      : reject(new Error(`O armazenamento recusou o arquivo (HTTP ${request.status}).`)));
    request.onerror = () => reject(new Error('Falha de rede ao enviar o arquivo. Verifique a conexão e o CORS do bucket.'));
    request.send(file);
  });
}

/** Envia o arquivo e devolve a chave do objeto, que vai no cadastro do manual como pdfKey ou videoKey. */
export async function uploadToBucket({ apiUrl, token, kind, file, onProgress }) {
  const response = await fetch(`${apiUrl}/api/uploads/presign`, {
    method: 'POST',
    headers: createAuthHeaders(token),
    body: JSON.stringify({ kind, contentType: file.type, size: file.size })
  });
  const upload = await readResponse(response);
  await putWithProgress(upload.url, upload.headers, file, onProgress);
  return upload.key;
}

/**
 * Corpo do cadastro (POST) ou da edição (PUT) do manual. Com bucket (directUpload), os arquivos vão do navegador
 * direto ao armazenamento e o corpo leva só as chaves; sem bucket, vai em multipart sem forçar Content-Type,
 * para preservar o boundary do navegador. Arquivo não escolhido fica fora; cada setor vai como um campo sectorIds.
 */
export async function buildManualRequest({ apiUrl, token, directUpload, fields, pdf, video, onStatus }) {
  if (!directUpload) {
    const payload = new FormData();
    Object.entries({ ...fields, pdf, video }).forEach(([key, value]) => {
      if (Array.isArray(value)) value.forEach((item) => payload.append(key, item));
      else if (value !== null && value !== undefined) payload.append(key, value);
    });
    return { headers: createAuthHeaders(token, false), body: payload };
  }
  const pdfKey = pdf ? await uploadToBucket({ apiUrl, token, kind: 'pdf', file: pdf, onProgress: (percent) => onStatus?.(`Enviando PDF... ${percent}%`) }) : undefined;
  const videoKey = video ? await uploadToBucket({ apiUrl, token, kind: 'video', file: video, onProgress: (percent) => onStatus?.(`Enviando vídeo... ${percent}%`) }) : undefined;
  onStatus?.('Salvando manual...');
  return { headers: createAuthHeaders(token), body: JSON.stringify({ ...fields, pdfKey, videoKey }) };
}
