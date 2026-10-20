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
