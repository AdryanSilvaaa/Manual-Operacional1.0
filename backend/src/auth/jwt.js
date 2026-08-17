// src/auth/jwt.js
//
// Emissão e verificação dos JWT. O payload carrega exatamente o que o RBAC
// precisa: id do usuário, papel e departamento_id (nulo para administrador,
// que é global). O algoritmo é fixado em HS256 — tokens com outro algoritmo,
// em especial "none", são rejeitados na verificação.

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const ALGORITMO = 'HS256';
export const EXPIRACAO_PADRAO = '8h';

export const PAPEIS = Object.freeze(['administrador', 'gerente', 'usuario']);

/**
 * Assina um JWT para o usuário informado.
 * @param {{id:number|string, papel:string, departamento_id:number|string|null}} usuario
 * @param {{ expiresIn?: string|number }} [opts]
 * @returns {string} token assinado.
 */
export function assinarToken(usuario, { expiresIn = EXPIRACAO_PADRAO } = {}) {
  if (!usuario?.id) {
    throw new Error('assinarToken requer o id do usuário.');
  }
  if (!PAPEIS.includes(usuario.papel)) {
    throw new Error(`Papel inválido: ${usuario.papel}`);
  }
  const payload = {
    id: usuario.id,
    papel: usuario.papel,
    // Administrador é global: departamento_id nulo.
    departamento_id: usuario.departamento_id ?? null,
  };
  return jwt.sign(payload, env.jwtSecret, { algorithm: ALGORITMO, expiresIn });
}

/**
 * Verifica assinatura e expiração do token.
 * Restringir `algorithms` a HS256 é o que barra o ataque de algoritmo "none"
 * (e a confusão de algoritmos em geral).
 * @param {string} token
 * @returns {{id:any, papel:string, departamento_id:any, iat:number, exp:number}}
 * @throws {Error} se o token for inválido, expirado ou usar outro algoritmo.
 */
export function verificarToken(token) {
  return jwt.verify(token, env.jwtSecret, { algorithms: [ALGORITMO] });
}

/**
 * Extrai o token de um cabeçalho `Authorization: Bearer <token>`.
 * @param {string|undefined} cabecalho
 * @returns {string|null} o token, ou null se ausente/malformado.
 */
export function extrairBearer(cabecalho) {
  if (typeof cabecalho !== 'string') return null;
  const partes = cabecalho.trim().split(/\s+/);
  if (partes.length !== 2) return null;
  const [esquema, token] = partes;
  if (!/^Bearer$/i.test(esquema) || !token) return null;
  return token;
}
