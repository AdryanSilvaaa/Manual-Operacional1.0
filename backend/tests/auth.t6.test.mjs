// Testes de login, JWT e middleware de autenticação (T6).
// Sobem um Express real numa porta efêmera e usam fetch — sem banco real
// (o pool é substituído por um fake) e sem dependências novas.

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Ambiente mínimo válido para o boot de env.js.
process.env.DATABASE_URL ||= 'postgres://u:p@localhost:5432/db';
process.env.JWT_SECRET ||= 'segredo-de-teste-com-mais-de-32-caracteres';
process.env.REDIS_URL ||= 'redis://localhost:6379';
process.env.GCS_BUCKET ||= 'bucket-de-teste';

const { criarRotasAuth } = await import('../routes/auth.js');
const { autenticar } = await import('../src/middleware/autenticar.js');
const { assinarToken } = await import('../src/auth/jwt.js');

const SENHA = 'senha-correta';
const HASH = bcrypt.hashSync(SENHA, 10);

const USUARIOS = [
  { id: 1, email: 'admin@ex.com', senha_hash: HASH, papel: 'administrador', departamento_id: null },
  { id: 2, email: 'gerente@ex.com', senha_hash: HASH, papel: 'gerente', departamento_id: 7 },
  { id: 3, email: 'usuario@ex.com', senha_hash: HASH, papel: 'usuario', departamento_id: 7 },
];

// Fake do pool: responde à consulta por e-mail.
const dbFake = {
  async query(_sql, [email]) {
    const usuario = USUARIOS.find((u) => u.email === email);
    return { rows: usuario ? [usuario] : [] };
  },
};

// Sobe um app com as rotas de auth e duas rotas protegidas de exemplo.
async function comServidor(fn) {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', criarRotasAuth({ db: dbFake }));

  // Rota protegida: só exige autenticação (401 sem token válido).
  app.get('/api/protegida', autenticar, (req, res) => res.json({ user: req.user }));

  // Rota que exige papel: autenticado mas sem permissão => 403 (não 401).
  // O RBAC completo é do T7; aqui só provamos a distinção 401 x 403.
  app.get('/api/somente-admin', autenticar, (req, res) => {
    if (req.user.papel !== 'administrador') {
      return res.status(403).json({ erro: 'Sem permissão' });
    }
    return res.json({ ok: true });
  });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const login = (base, corpo) =>
  fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  });

// --- Login ---

test('login correto devolve JWT com papel e departamento no payload', async () => {
  await comServidor(async (base) => {
    const resposta = await login(base, { email: 'gerente@ex.com', senha: SENHA });
    assert.equal(resposta.status, 200);
    const corpo = await resposta.json();
    assert.ok(corpo.token, 'token presente');

    const payload = jwt.decode(corpo.token);
    assert.equal(payload.id, 2);
    assert.equal(payload.papel, 'gerente');
    assert.equal(payload.departamento_id, 7);
    assert.ok(payload.exp > payload.iat, 'token tem expiração');

    // A resposta não vaza o hash da senha.
    assert.equal(corpo.usuario.papel, 'gerente');
    assert.equal(corpo.usuario.departamento_id, 7);
    assert.equal('senha_hash' in corpo.usuario, false);
  });
});

test('administrador recebe departamento_id nulo no payload', async () => {
  await comServidor(async (base) => {
    const corpo = await (await login(base, { email: 'admin@ex.com', senha: SENHA })).json();
    const payload = jwt.decode(corpo.token);
    assert.equal(payload.papel, 'administrador');
    assert.equal(payload.departamento_id, null);
  });
});

test('senha errada recebe 401', async () => {
  await comServidor(async (base) => {
    const resposta = await login(base, { email: 'gerente@ex.com', senha: 'errada' });
    assert.equal(resposta.status, 401);
  });
});

test('e-mail inexistente recebe 401 (mesma mensagem de senha errada)', async () => {
  await comServidor(async (base) => {
    const r1 = await login(base, { email: 'ninguem@ex.com', senha: SENHA });
    const r2 = await login(base, { email: 'gerente@ex.com', senha: 'errada' });
    assert.equal(r1.status, 401);
    assert.deepEqual(await r1.json(), await r2.json());
  });
});

test('campos faltando recebem 400', async () => {
  await comServidor(async (base) => {
    assert.equal((await login(base, { email: 'a@b.com' })).status, 400);
    assert.equal((await login(base, {})).status, 400);
  });
});

// --- Middleware autenticar ---

test('token válido passa e anexa req.user', async () => {
  await comServidor(async (base) => {
    const token = assinarToken({ id: 3, papel: 'usuario', departamento_id: 7 });
    const resposta = await fetch(`${base}/api/protegida`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(resposta.status, 200);
    const { user } = await resposta.json();
    assert.deepEqual(user, { id: 3, papel: 'usuario', departamento_id: 7 });
  });
});

test('token ausente recebe 401', async () => {
  await comServidor(async (base) => {
    assert.equal((await fetch(`${base}/api/protegida`)).status, 401);
  });
});

test('cabeçalho malformado (sem Bearer) recebe 401', async () => {
  await comServidor(async (base) => {
    const token = assinarToken({ id: 1, papel: 'administrador', departamento_id: null });
    const resposta = await fetch(`${base}/api/protegida`, {
      headers: { authorization: token }, // sem o esquema "Bearer"
    });
    assert.equal(resposta.status, 401);
  });
});

test('token expirado recebe 401', async () => {
  await comServidor(async (base) => {
    const token = assinarToken(
      { id: 2, papel: 'gerente', departamento_id: 7 },
      { expiresIn: '-1s' },
    );
    const resposta = await fetch(`${base}/api/protegida`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(resposta.status, 401);
  });
});

test('token assinado com chave errada recebe 401', async () => {
  await comServidor(async (base) => {
    const token = jwt.sign({ id: 2, papel: 'gerente', departamento_id: 7 }, 'outra-chave-qualquer', {
      algorithm: 'HS256',
      expiresIn: '1h',
    });
    const resposta = await fetch(`${base}/api/protegida`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(resposta.status, 401);
  });
});

test('token com algoritmo none recebe 401', async () => {
  await comServidor(async (base) => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    // Token forjado: alg "none" e assinatura vazia.
    const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
      id: 1,
      papel: 'administrador',
      departamento_id: null,
    })}.`;
    const resposta = await fetch(`${base}/api/protegida`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(resposta.status, 401);
  });
});

// --- 401 x 403 ---

test('autenticado sem permissão recebe 403, não 401', async () => {
  await comServidor(async (base) => {
    const tokenUsuario = assinarToken({ id: 3, papel: 'usuario', departamento_id: 7 });
    const proibido = await fetch(`${base}/api/somente-admin`, {
      headers: { authorization: `Bearer ${tokenUsuario}` },
    });
    assert.equal(proibido.status, 403);

    // Sem token, a mesma rota devolve 401 (não autenticado).
    assert.equal((await fetch(`${base}/api/somente-admin`)).status, 401);

    // Com o papel certo, passa.
    const tokenAdmin = assinarToken({ id: 1, papel: 'administrador', departamento_id: null });
    const permitido = await fetch(`${base}/api/somente-admin`, {
      headers: { authorization: `Bearer ${tokenAdmin}` },
    });
    assert.equal(permitido.status, 200);
  });
});

test('assinarToken recusa papel inválido', () => {
  assert.throws(() => assinarToken({ id: 1, papel: 'root', departamento_id: null }), /Papel inválido/);
});
