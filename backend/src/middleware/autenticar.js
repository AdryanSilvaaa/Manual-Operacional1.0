// src/middleware/autenticar.js
//
// Middleware de autenticação: valida o Bearer token em toda requisição
// protegida e anexa `req.user` = { id, papel, departamento_id }.
//
// A distinção de status é deliberada e vale para todo o código:
//   401 — não autenticado: token ausente, malformado, inválido, expirado ou
//         assinado com outra chave/algoritmo (inclui o ataque "none").
//   403 — autenticado, mas sem permissão para o recurso (papel ou departamento
//         errado). Quem decide isso é o RBAC (T7), nunca este middleware.

import { extrairBearer, verificarToken } from '../auth/jwt.js';

/** Resposta 401 padronizada — nunca revela por que o token falhou. */
function naoAutenticado(res, mensagem = 'Não autenticado') {
  return res.status(401).json({ erro: mensagem });
}

/**
 * Express middleware. Rejeita com 401 quando não há credencial válida.
 */
export function autenticar(req, res, next) {
  const token = extrairBearer(req.headers?.authorization);
  if (!token) {
    return naoAutenticado(res, 'Token ausente');
  }
  try {
    const payload = verificarToken(token);
    req.user = {
      id: payload.id,
      papel: payload.papel,
      departamento_id: payload.departamento_id ?? null,
    };
    return next();
  } catch {
    // Assinatura inválida, expirado, algoritmo não permitido ("none"),
    // formato quebrado — tudo é 401, sem detalhar para o cliente.
    return naoAutenticado(res, 'Token inválido ou expirado');
  }
}

export default autenticar;
