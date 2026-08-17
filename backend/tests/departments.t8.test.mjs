// Testes do CRUD de departamentos (T8). Express real + banco falso que imita
// os códigos de erro do PostgreSQL (unique e foreign key), para provar que
// violações viram 409, não 500.

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

process.env.DATABASE_URL ||= 'postgres://u:p@localhost:5432/db';
process.env.JWT_SECRET ||= 'segredo-de-teste-com-mais-de-32-caracteres';
process.env.REDIS_URL ||= 'redis://localhost:6379';
process.env.GCS_BUCKET ||= 'bucket-de-teste';

const { criarRotasDepartamentos } = await import('../routes/departments.js');
const { assinarToken } = await import('../src/auth/jwt.js');
const { criarCache } = await import('../src/cache/cache.js');

const admin = { id: 1, papel: 'administrador', departamento_id: null };
const gerente = { id: 2, papel: 'gerente', departamento_id: 1 };
const usuario = { id: 3, papel: 'usuario', departamento_id: 1 };

const comToken = (user) => ({
  authorization: `Bearer ${assinarToken(user)}`,
  'content-type': 'application/json',
});

function erroPg(code) {
  const e = new Error(`erro pg ${code}`);
  e.code = code;
  return e;
}

/**
 * Banco falso: guarda departamentos em memória e simula as restrições do
 * schema (nome único; exclusão bloqueada quando há vínculos).
 */
function dbFake({ comVinculos = new Set() } = {}) {
  const linhas = [
    { id: 1, nome: 'Odontologia' },
    { id: 2, nome: 'Recepção' },
  ];
  let proximoId = 3;
  return {
    linhas,
    async query(sql, params = []) {
      if (/^SELECT id, nome FROM departamentos ORDER BY nome/.test(sql)) {
        return { rows: [...linhas].sort((a, b) => a.nome.localeCompare(b.nome)) };
      }
      if (/^SELECT id, nome FROM departamentos WHERE id/.test(sql)) {
        const achado = linhas.find((d) => d.id === params[0]);
        return { rows: achado ? [achado] : [] };
      }
      if (/^INSERT INTO departamentos/.test(sql)) {
        const [nome] = params;
        if (linhas.some((d) => d.nome === nome)) throw erroPg('23505');
        const novo = { id: proximoId++, nome };
        linhas.push(novo);
        return { rows: [novo] };
      }
      if (/^UPDATE departamentos/.test(sql)) {
        const [nome, id] = params;
        if (linhas.some((d) => d.nome === nome && d.id !== id)) throw erroPg('23505');
        const alvo = linhas.find((d) => d.id === id);
        if (!alvo) return { rows: [] };
        alvo.nome = nome;
        return { rows: [alvo] };
      }
      if (/^DELETE FROM departamentos/.test(sql)) {
        const [id] = params;
        const indice = linhas.findIndex((d) => d.id === id);
        if (indice === -1) return { rows: [] };
        // ON DELETE RESTRICT: há sistemas/usuários vinculados.
        if (comVinculos.has(id)) throw erroPg('23503');
        linhas.splice(indice, 1);
        return { rows: [{ id }] };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    },
  };
}

async function comServidor(fn, { db = dbFake(), cache = criarCache({ client: null }) } = {}) {
  const app = express();
  app.use(express.json());
  app.use('/api/departamentos', criarRotasDepartamentos({ db, cache }));
  // Handler de erro central (como será no T12): garante que exceções não
  // tratadas apareçam como 500 e não derrubem o processo.
  app.use((erro, _req, res, _next) => res.status(500).json({ erro: 'Erro interno' }));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api/departamentos`;
  try {
    await fn(base, { db, cache });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

// --- Matriz: exclusivo do administrador ---

test('apenas administrador acessa o CRUD; gerente e usuário recebem 403', async () => {
  await comServidor(async (base) => {
    for (const user of [gerente, usuario]) {
      assert.equal((await fetch(base, { headers: comToken(user) })).status, 403);
      assert.equal(
        (
          await fetch(base, {
            method: 'POST',
            headers: comToken(user),
            body: JSON.stringify({ nome: 'Novo' }),
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await fetch(`${base}/1`, {
            method: 'PUT',
            headers: comToken(user),
            body: JSON.stringify({ nome: 'X' }),
          })
        ).status,
        403,
      );
      assert.equal(
        (await fetch(`${base}/1`, { method: 'DELETE', headers: comToken(user) })).status,
        403,
      );
    }
  });
});

test('sem token recebe 401, não 403', async () => {
  await comServidor(async (base) => {
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(`${base}/1`, { method: 'DELETE' })).status, 401);
  });
});

// --- CRUD do administrador ---

test('administrador lista departamentos', async () => {
  await comServidor(async (base) => {
    const resposta = await fetch(base, { headers: comToken(admin) });
    assert.equal(resposta.status, 200);
    const corpo = await resposta.json();
    assert.equal(corpo.length, 2);
    assert.deepEqual(corpo.map((d) => d.nome), ['Odontologia', 'Recepção']);
  });
});

test('administrador cria departamento (201) e ele passa a aparecer na listagem', async () => {
  await comServidor(async (base) => {
    const criado = await fetch(base, {
      method: 'POST',
      headers: comToken(admin),
      body: JSON.stringify({ nome: 'Financeiro' }),
    });
    assert.equal(criado.status, 201);
    const corpo = await criado.json();
    assert.equal(corpo.nome, 'Financeiro');
    assert.ok(corpo.id);

    const lista = await (await fetch(base, { headers: comToken(admin) })).json();
    assert.equal(lista.some((d) => d.nome === 'Financeiro'), true);
  });
});

test('nome duplicado recebe 409, não 500', async () => {
  await comServidor(async (base) => {
    const r = await fetch(base, {
      method: 'POST',
      headers: comToken(admin),
      body: JSON.stringify({ nome: 'Odontologia' }),
    });
    assert.equal(r.status, 409);
  });
});

test('nome ausente ou vazio recebe 400', async () => {
  await comServidor(async (base) => {
    for (const corpo of [{}, { nome: '   ' }, { nome: 123 }]) {
      const r = await fetch(base, {
        method: 'POST',
        headers: comToken(admin),
        body: JSON.stringify(corpo),
      });
      assert.equal(r.status, 400);
    }
  });
});

test('administrador edita departamento; id inexistente devolve 404', async () => {
  await comServidor(async (base) => {
    const editado = await fetch(`${base}/1`, {
      method: 'PUT',
      headers: comToken(admin),
      body: JSON.stringify({ nome: 'Odontologia Geral' }),
    });
    assert.equal(editado.status, 200);
    assert.equal((await editado.json()).nome, 'Odontologia Geral');

    const inexistente = await fetch(`${base}/999`, {
      method: 'PUT',
      headers: comToken(admin),
      body: JSON.stringify({ nome: 'Qualquer' }),
    });
    assert.equal(inexistente.status, 404);
  });
});

test('administrador remove departamento sem vínculos (204)', async () => {
  await comServidor(async (base) => {
    const r = await fetch(`${base}/2`, { method: 'DELETE', headers: comToken(admin) });
    assert.equal(r.status, 204);
    const lista = await (await fetch(base, { headers: comToken(admin) })).json();
    assert.equal(lista.some((d) => d.id === 2), false);
  });
});

// --- Pendência 2, opção (a): bloquear exclusão com vínculos ---

test('remover departamento com vínculos devolve 409 tratado, não 500', async () => {
  await comServidor(
    async (base) => {
      const r = await fetch(`${base}/1`, { method: 'DELETE', headers: comToken(admin) });
      assert.equal(r.status, 409);
      const corpo = await r.json();
      assert.match(corpo.erro, /vinculad/i);

      // O departamento continua existindo.
      const ainda = await fetch(`${base}/1`, { headers: comToken(admin) });
      assert.equal(ainda.status, 200);
    },
    { db: dbFake({ comVinculos: new Set([1]) }) },
  );
});

test('remover id inexistente devolve 404; id malformado devolve 400', async () => {
  await comServidor(async (base) => {
    assert.equal(
      (await fetch(`${base}/999`, { method: 'DELETE', headers: comToken(admin) })).status,
      404,
    );
    assert.equal(
      (await fetch(`${base}/abc`, { method: 'DELETE', headers: comToken(admin) })).status,
      400,
    );
  });
});

// --- Cache ---

test('a listagem usa cache e a escrita invalida o cache', async () => {
  // Cache em memória: prova o hit e a invalidação.
  const store = new Map();
  const clienteFalso = {
    async get(k) {
      return store.has(k) ? store.get(k) : null;
    },
    async set(k, v) {
      store.set(k, v);
      return 'OK';
    },
    async del(k) {
      for (const c of Array.isArray(k) ? k : [k]) store.delete(c);
      return 1;
    },
    async scan(_cursor, { MATCH }) {
      const prefixo = MATCH.replace(/\*$/, '');
      return { cursor: 0, keys: [...store.keys()].filter((k) => k.startsWith(prefixo)) };
    },
  };
  const cache = criarCache({ client: clienteFalso });

  await comServidor(
    async (base) => {
      await fetch(base, { headers: comToken(admin) }); // miss -> popula
      assert.equal(store.size, 1, 'listagem cacheada');
      await fetch(base, { headers: comToken(admin) }); // hit
      assert.equal(cache.getStats().hits, 1);

      // Escrita invalida a listagem.
      await fetch(base, {
        method: 'POST',
        headers: comToken(admin),
        body: JSON.stringify({ nome: 'Novo Setor' }),
      });
      assert.equal(store.size, 0, 'cache invalidado após criar');

      // A listagem seguinte reflete a mudança.
      const lista = await (await fetch(base, { headers: comToken(admin) })).json();
      assert.equal(lista.some((d) => d.nome === 'Novo Setor'), true);
    },
    { cache },
  );
});
