// src/storage/gcs.js
//
// Provider de storage sobre o Google Cloud Storage. Toda a mídia (PDFs e vídeos)
// vive aqui e NUNCA passa pela API: as rotas pedem uma URL assinada e o
// navegador baixa direto do Cloud Storage (via Cloud CDN).
//
// A assinatura V4 é um cálculo LOCAL a partir da chave da service account —
// não é chamada de rede. Em produção, a service account é a do Cloud Run; em
// desenvolvimento pode-se apontar `apiEndpoint` para um emulador local.

import { Storage } from '@google-cloud/storage';
import { env } from '../config/env.js';

export const ALGORITMO_V4 = 'GOOG4-RSA-SHA256';
export const SETE_DIAS_SEGUNDOS = 7 * 24 * 60 * 60;

/**
 * Valida o TTL (em segundos) de uma URL assinada: recusa zero, negativo e
 * qualquer valor acima de 7 dias (limite do Cloud Storage para V4).
 * @param {number} ttlSeconds
 */
export function validarTtl(ttlSeconds) {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error('TTL da URL assinada deve ser maior que zero.');
  }
  if (ttlSeconds > SETE_DIAS_SEGUNDOS) {
    throw new Error('TTL da URL assinada não pode exceder 7 dias.');
  }
}

/**
 * Acesso a arquivos no Cloud Storage atrás de uma interface estável.
 * Implementa o contrato descrito em src/storage/index.js.
 */
export class GCSProvider {
  /**
   * @param {object} opts
   * @param {string} opts.bucket nome do bucket de mídia.
   * @param {string} [opts.apiEndpoint] endpoint alternativo (emulador local).
   * @param {number} [opts.ttlPadrao] TTL padrão das URLs assinadas (segundos).
   * @param {object} [opts.credentials] service account { client_email, private_key }.
   * @param {string} [opts.projectId]
   */
  constructor({ bucket, apiEndpoint, ttlPadrao, credentials, projectId } = {}) {
    if (!bucket) {
      throw new Error('GCSProvider requer o nome do bucket.');
    }
    this.nomeBucket = bucket;
    this.ttlPadrao = ttlPadrao ?? env.signedUrlTtlSeconds;

    const opcoes = {};
    if (apiEndpoint) opcoes.apiEndpoint = apiEndpoint;
    if (credentials) opcoes.credentials = credentials;
    if (projectId) opcoes.projectId = projectId;

    this.storage = new Storage(opcoes);
    this.bucket = this.storage.bucket(bucket);
  }

  _arquivo(objeto) {
    return this.bucket.file(objeto);
  }

  /**
   * URL assinada V4 para leitura (GET). Assinatura local; não toca a rede.
   * @param {string} objeto chave do objeto no bucket.
   * @param {{ ttlSeconds?: number }} [opts]
   * @returns {Promise<string>}
   */
  async createReadUrl(objeto, { ttlSeconds = this.ttlPadrao } = {}) {
    validarTtl(ttlSeconds);
    const [url] = await this._arquivo(objeto).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + ttlSeconds * 1000,
    });
    return url;
  }

  /**
   * URL assinada V4 para upload (PUT).
   * @param {string} objeto
   * @param {{ ttlSeconds?: number, contentType?: string }} [opts]
   * @returns {Promise<string>}
   */
  async createUploadUrl(objeto, { ttlSeconds = this.ttlPadrao, contentType } = {}) {
    validarTtl(ttlSeconds);
    const [url] = await this._arquivo(objeto).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + ttlSeconds * 1000,
      ...(contentType ? { contentType } : {}),
    });
    return url;
  }

  /**
   * @param {string} objeto
   * @returns {Promise<boolean>}
   */
  async exists(objeto) {
    const [existe] = await this._arquivo(objeto).exists();
    return existe;
  }

  /**
   * Metadados do objeto (sem baixar o conteúdo).
   * @param {string} objeto
   * @returns {Promise<{nome:string,tamanho:number,contentType:string|undefined,atualizadoEm:string|undefined,etag:string|undefined}>}
   */
  async stat(objeto) {
    const [metadata] = await this._arquivo(objeto).getMetadata();
    return {
      nome: objeto,
      tamanho: Number(metadata.size ?? 0),
      contentType: metadata.contentType,
      atualizadoEm: metadata.updated,
      etag: metadata.etag,
    };
  }

  /**
   * Envia bytes/string para o objeto (uso administrativo/seed; o fluxo normal
   * de upload é via createUploadUrl, direto no Cloud Storage).
   * @param {string} objeto
   * @param {Buffer|string} dados
   * @param {{ contentType?: string }} [opts]
   * @returns {Promise<void>}
   */
  async put(objeto, dados, { contentType } = {}) {
    await this._arquivo(objeto).save(dados, contentType ? { contentType } : {});
  }

  /**
   * Remove o objeto (não falha se já não existir).
   * @param {string} objeto
   * @returns {Promise<void>}
   */
  async remove(objeto) {
    await this._arquivo(objeto).delete({ ignoreNotFound: true });
  }

  /**
   * Lista os nomes dos objetos, opcionalmente por prefixo.
   * @param {string} [prefixo]
   * @returns {Promise<string[]>}
   */
  async list(prefixo = '') {
    const [arquivos] = await this.bucket.getFiles(prefixo ? { prefix: prefixo } : {});
    return arquivos.map((arquivo) => arquivo.name);
  }
}
