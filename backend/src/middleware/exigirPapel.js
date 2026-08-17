// src/middleware/exigirPapel.js
//
// Autorização por papel. Roda SEMPRE depois de `autenticar` (T6), que é quem
// preenche req.user.
//
//   401 — não autenticado (não passou por autenticar, ou o token falhou).
//   403 — autenticado, mas sem permissão.
//
// Regra do documento: um 403 NUNCA vaza dado do recurso — nem título, nem
// chave do objeto, nem URL assinada. Por isso a resposta de negação é sempre
// o mesmo corpo mínimo (`negarAcesso`), independentemente do recurso.

const CORPO_403 = Object.freeze({ erro: 'Sem permissão' });

/**
 * Responde 403 com um corpo fixo e sem dado nenhum do recurso.
 * Use em todas as negações por escopo (T9/T10) para manter o 403 uniforme.
 * @param {import('express').Response} res
 */
export function negarAcesso(res) {
  return res.status(403).json(CORPO_403);
}

/**
 * Responde 401 padronizado.
 * @param {import('express').Response} res
 */
export function naoAutenticado(res) {
  return res.status(401).json({ erro: 'Não autenticado' });
}

/**
 * Middleware: só deixa passar os papéis informados.
 * @param {...(string|string[])} papeis ex.: exigirPapel('administrador', 'gerente')
 * @returns {import('express').RequestHandler}
 */
export function exigirPapel(...papeis) {
  const permitidos = new Set(papeis.flat());
  return function verificarPapel(req, res, next) {
    if (!req.user?.papel) {
      // Sem identidade: é falha de autenticação, não de permissão.
      return naoAutenticado(res);
    }
    if (!permitidos.has(req.user.papel)) {
      return negarAcesso(res);
    }
    return next();
  };
}

export default exigirPapel;
