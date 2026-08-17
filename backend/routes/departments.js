// routes/departments.js
//
// CRUD de departamentos — exclusivo do Administrador (matriz da seção 2:
// gerente e usuário recebem 403 em qualquer verbo). O departamento é a base do
// escopo de todo o resto (sistemas, usuários e, por herança, manuais).
//
// Exclusão: pendência 2 do documento, opção (a) — BLOQUEAR enquanto houver
// vínculos. O banco garante isso com ON DELETE RESTRICT; aqui traduzimos a
// violação de FK em 409 (conflito), nunca em 500.

import express from 'express';
import { autenticar } from '../src/middleware/autenticar.js';
import { exigirPapel } from '../src/middleware/exigirPapel.js';
import { chaveComEscopo, prefixoEscopo } from '../src/cache/cache.js';
import { db as dbPadrao, cache as cachePadrao } from '../src/container.js';

// Códigos de erro do PostgreSQL que viram resposta de negócio, não 500.
const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

const NOME_MAX = 120; // igual ao VARCHAR(120) da migração

/**
 * Valida e normaliza o nome vindo do corpo da requisição.
 * @returns {{ok:true, nome:string}|{ok:false, erro:string}}
 */
function validarNome(corpo) {
  const nome = typeof corpo?.nome === 'string' ? corpo.nome.trim() : '';
  if (!nome) return { ok: false, erro: 'nome é obrigatório' };
  if (nome.length > NOME_MAX) return { ok: false, erro: `nome deve ter até ${NOME_MAX} caracteres` };
  return { ok: true, nome };
}

/** Aceita apenas id inteiro positivo; devolve null quando malformado. */
function idValido(valor) {
  return /^\d+$/.test(String(valor)) ? Number(valor) : null;
}

/**
 * Invalida o cache afetado por uma mudança de departamento: a listagem de
 * departamentos e tudo que é escopado por aquele departamento (sistemas e
 * manuais), em qualquer papel.
 */
async function invalidarCache(cache, departamentoId) {
  await cache.delByPrefix('departamentos:');
  if (departamentoId != null) {
    await cache.delByPrefix(prefixoEscopo('sistemas', departamentoId));
    await cache.delByPrefix(prefixoEscopo('manuais', departamentoId));
  }
}

/**
 * @param {{ db?: import('pg').Pool, cache?: object }} [deps]
 * @returns {import('express').Router}
 */
export function criarRotasDepartamentos({ db = dbPadrao, cache = cachePadrao } = {}) {
  const router = express.Router();

  // Todo o CRUD é exclusivo do administrador.
  router.use(autenticar, exigirPapel('administrador'));

  // Listar
  router.get('/', async (req, res, next) => {
    try {
      const chave = chaveComEscopo('departamentos', req.user, 'lista');
      const departamentos = await cache.wrap(chave, async () => {
        const { rows } = await db.query(
          'SELECT id, nome FROM departamentos ORDER BY nome',
        );
        return rows;
      });
      return res.json(departamentos);
    } catch (erro) {
      return next(erro);
    }
  });

  // Detalhar
  router.get('/:id', async (req, res, next) => {
    try {
      const id = idValido(req.params.id);
      if (id === null) return res.status(400).json({ erro: 'id inválido' });
      const { rows } = await db.query('SELECT id, nome FROM departamentos WHERE id = $1', [id]);
      if (rows.length === 0) return res.status(404).json({ erro: 'Departamento não encontrado' });
      return res.json(rows[0]);
    } catch (erro) {
      return next(erro);
    }
  });

  // Criar
  router.post('/', async (req, res, next) => {
    try {
      const validacao = validarNome(req.body);
      if (!validacao.ok) return res.status(400).json({ erro: validacao.erro });

      const { rows } = await db.query(
        'INSERT INTO departamentos (nome) VALUES ($1) RETURNING id, nome',
        [validacao.nome],
      );
      await invalidarCache(cache, rows[0].id);
      return res.status(201).json(rows[0]);
    } catch (erro) {
      if (erro?.code === UNIQUE_VIOLATION) {
        return res.status(409).json({ erro: 'Já existe um departamento com esse nome' });
      }
      return next(erro);
    }
  });

  // Editar
  router.put('/:id', async (req, res, next) => {
    try {
      const id = idValido(req.params.id);
      if (id === null) return res.status(400).json({ erro: 'id inválido' });
      const validacao = validarNome(req.body);
      if (!validacao.ok) return res.status(400).json({ erro: validacao.erro });

      const { rows } = await db.query(
        `UPDATE departamentos SET nome = $1, atualizado_em = NOW()
          WHERE id = $2 RETURNING id, nome`,
        [validacao.nome, id],
      );
      if (rows.length === 0) return res.status(404).json({ erro: 'Departamento não encontrado' });
      await invalidarCache(cache, id);
      return res.json(rows[0]);
    } catch (erro) {
      if (erro?.code === UNIQUE_VIOLATION) {
        return res.status(409).json({ erro: 'Já existe um departamento com esse nome' });
      }
      return next(erro);
    }
  });

  // Remover — bloqueado enquanto houver sistemas ou usuários vinculados.
  router.delete('/:id', async (req, res, next) => {
    try {
      const id = idValido(req.params.id);
      if (id === null) return res.status(400).json({ erro: 'id inválido' });

      const { rows } = await db.query(
        'DELETE FROM departamentos WHERE id = $1 RETURNING id',
        [id],
      );
      if (rows.length === 0) return res.status(404).json({ erro: 'Departamento não encontrado' });
      await invalidarCache(cache, id);
      return res.status(204).end();
    } catch (erro) {
      if (erro?.code === FOREIGN_KEY_VIOLATION) {
        return res.status(409).json({
          erro: 'Departamento possui sistemas ou usuários vinculados',
        });
      }
      return next(erro);
    }
  });

  return router;
}

export default criarRotasDepartamentos();
