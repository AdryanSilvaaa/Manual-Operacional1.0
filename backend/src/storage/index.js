// src/storage/index.js
//
// Ponto único de acesso ao storage. As rotas e o container (T5) importam SOMENTE
// daqui — nenhuma rota importa @google-cloud/storage diretamente. Trocar de
// backend de storage no futuro é mudar apenas este arquivo e a implementação.
//
// Contrato do provider de storage (implementado por GCSProvider):
//
//   createReadUrl(objeto, { ttlSeconds? }): Promise<string>
//       URL assinada V4 para leitura (GET). Assinatura local (sem rede).
//   createUploadUrl(objeto, { ttlSeconds?, contentType? }): Promise<string>
//       URL assinada V4 para upload (PUT).
//   exists(objeto): Promise<boolean>
//   stat(objeto): Promise<{ nome, tamanho, contentType, atualizadoEm, etag }>
//   put(objeto, dados, { contentType? }): Promise<void>
//   remove(objeto): Promise<void>
//   list(prefixo?): Promise<string[]>
//
// Regras: o TTL das URLs é validado (recusa zero, negativo e acima de 7 dias);
// a URL assinada nunca deve ser cacheada (cacheia-se o metadado — ver T10).

import { GCSProvider } from './gcs.js';
import { env } from '../config/env.js';

/**
 * Cria o provider de storage a partir do ambiente (com overrides opcionais).
 *
 * @param {object} [config]
 * @param {string} [config.bucket] default: env.gcsBucket.
 * @param {string} [config.apiEndpoint] emulador local; default: env.gcsApiEndpoint.
 * @param {number} [config.ttlPadrao] default: env.signedUrlTtlSeconds.
 * @param {object} [config.credentials] service account (testes/local).
 * @param {string} [config.projectId]
 * @returns {GCSProvider}
 */
export function createStorageProvider(config = {}) {
  return new GCSProvider({
    bucket: config.bucket ?? env.gcsBucket,
    apiEndpoint: config.apiEndpoint ?? env.gcsApiEndpoint,
    ttlPadrao: config.ttlPadrao ?? env.signedUrlTtlSeconds,
    credentials: config.credentials,
    projectId: config.projectId,
  });
}

export { GCSProvider };
