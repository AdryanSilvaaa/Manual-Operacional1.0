// routes/auth.js
//
// Rotas de autenticação. Hoje: POST /api/auth/login.
//
// O router é criado por uma factory que recebe suas dependências, para poder
// ser testado sem banco real. O export default já vem ligado ao container
// (T5), que é o único lugar de onde as rotas obtêm { db, cache, storage }.

import express from 'express';
import bcrypt from 'bcryptjs';
import { assinarToken } from '../src/auth/jwt.js';
import { db as dbPadrao } from '../src/container.js';

// Hash descartável usado para gastar o mesmo tempo de bcrypt quando o e-mail
// não existe. Sem isso, a diferença de tempo de resposta revela quais e-mails
// estão cadastrados.
const HASH_FALSO = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8.CkPvyLMNsl3Vlq0Vd0zGZ3rFhq7C';

/**
 * @param {{ db?: import('pg').Pool }} [deps]
 * @returns {import('express').Router}
 */
export function criarRotasAuth({ db = dbPadrao } = {}) {
  const router = express.Router();

  router.post('/login', async (req, res, next) => {
    try {
      const { email, senha } = req.body ?? {};
      if (typeof email !== 'string' || typeof senha !== 'string' || !email || !senha) {
        return res.status(400).json({ erro: 'E-mail e senha são obrigatórios' });
      }

      const { rows } = await db.query(
        'SELECT id, email, senha_hash, papel, departamento_id FROM usuarios WHERE email = $1',
        [email],
      );
      const usuario = rows[0];

      // Compara sempre, mesmo sem usuário, para não vazar quais e-mails existem.
      const senhaConfere = await bcrypt.compare(senha, usuario?.senha_hash ?? HASH_FALSO);
      if (!usuario || !senhaConfere) {
        // Credencial errada é falha de autenticação: 401 (não 403).
        return res.status(401).json({ erro: 'Credenciais inválidas' });
      }

      const token = assinarToken(usuario);
      return res.json({
        token,
        usuario: {
          id: usuario.id,
          email: usuario.email,
          papel: usuario.papel,
          departamento_id: usuario.departamento_id ?? null,
        },
      });
    } catch (erro) {
      return next(erro);
    }
  });

  return router;
}

export default criarRotasAuth();
