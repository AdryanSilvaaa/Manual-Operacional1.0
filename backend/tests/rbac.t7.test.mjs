// Testes do RBAC de três papéis com escopo de departamento (T7).
// Cobrem a matriz da seção 2 nas funções puras e um caminho HTTP real para
// provar a distinção 401/403 e que o 403 não vaza dado do recurso.

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

process.env.DATABASE_URL ||= 'postgres://u:p@localhost:5432/db';
process.env.JWT_SECRET ||= 'segredo-de-teste-com-mais-de-32-caracteres';
process.env.REDIS_URL ||= 'redis://localhost:6379';
process.env.GCS_BUCKET ||= 'bucket-de-teste';

const {
  mesmoDepartamento,
  podeGerenciarSistema,
  podeGerenciarManual,
  podeVerManual,
  departamentoDoRecurso,
  ehAdministrador,
} = await import('../src/auth/escopo.js');
const { exigirPapel, negarAcesso } = await import('../src/middleware/exigirPapel.js');
const { autenticar } = await import('../src/middleware/autenticar.js');
const { assinarToken } = await import('../src/auth/jwt.js');

// Departamento A = 1, Departamento B = 2.
const admin = { id: 1, papel: 'administrador', departamento_id: null };
const gerenteA = { id: 2, papel: 'gerente', departamento_id: 1 };
const gerenteB = { id: 3, papel: 'gerente', departamento_id: 2 };
const usuarioA = { id: 4, papel: 'usuario', departamento_id: 1 };

const sistemaA = { id: 10, nome: 'Sistema A', departamento_id: 1 };
const sistemaB = { id: 20, nome: 'Sistema B', departamento_id: 2 };
// Manual cujo departamento vem do sistema aninhado (manual -> sistema -> depto).
const manualA = { id: 100, titulo: 'Manual A', sistema_id: 10, sistema: { departamento_id: 1 } };
const manualB = { id: 200, titulo: 'Manual B', sistema_id: 20, sistema: { departamento_id: 2 } };

// --- mesmoDepartamento ---

test('administrador ignora o escopo de departamento', () => {
  assert.equal(mesmoDepartamento(admin, sistemaA), true);
  assert.equal(mesmoDepartamento(admin, sistemaB), true);
  assert.equal(ehAdministrador(admin), true);
});

test('gerente e usuário só acessam o próprio departamento', () => {
  assert.equal(mesmoDepartamento(gerenteA, sistemaA), true);
  assert.equal(mesmoDepartamento(gerenteA, sistemaB), false);
  assert.equal(mesmoDepartamento(usuarioA, sistemaA), true);
  assert.equal(mesmoDepartamento(usuarioA, sistemaB), false);
});

test('compara ids de tipos diferentes (número x string)', () => {
  assert.equal(mesmoDepartamento({ papel: 'gerente', departamento_id: 1 }, { departamento_id: '1' }), true);
  assert.equal(mesmoDepartamento({ papel: 'gerente', departamento_id: '1' }, { departamento_id: 2 }), false);
});

test('falha fechada: departamento indeterminado nega o acesso', () => {
  assert.equal(mesmoDepartamento(gerenteA, {}), false);
  assert.equal(mesmoDepartamento(gerenteA, null), false);
  assert.equal(mesmoDepartamento(gerenteA, { departamento_id: null }), false);
  // Gerente sem departamento não acessa nada com escopo.
  assert.equal(mesmoDepartamento({ papel: 'gerente', departamento_id: null }, sistemaA), false);
});

test('o departamento do manual vem do seu sistema', () => {
  assert.equal(departamentoDoRecurso(manualA), 1);
  // Também aceita o formato achatado por join.
  assert.equal(departamentoDoRecurso({ sistema_departamento_id: 5 }), 5);
  assert.equal(departamentoDoRecurso({}), undefined);
});

// --- Matriz: gerenciar sistemas ---

test('podeGerenciarSistema segue a matriz', () => {
  // Administrador: qualquer departamento.
  assert.equal(podeGerenciarSistema(admin, sistemaA), true);
  assert.equal(podeGerenciarSistema(admin, sistemaB), true);
  // Gerente: só o próprio.
  assert.equal(podeGerenciarSistema(gerenteA, sistemaA), true);
  assert.equal(podeGerenciarSistema(gerenteA, sistemaB), false);
  assert.equal(podeGerenciarSistema(gerenteB, sistemaB), true);
  // Usuário: nunca.
  assert.equal(podeGerenciarSistema(usuarioA, sistemaA), false);
  assert.equal(podeGerenciarSistema(usuarioA, sistemaB), false);
});

// --- Matriz: criar/editar manuais ---

test('podeGerenciarManual segue a matriz (departamento herdado do sistema)', () => {
  assert.equal(podeGerenciarManual(admin, manualA), true);
  assert.equal(podeGerenciarManual(admin, manualB), true);
  assert.equal(podeGerenciarManual(gerenteA, manualA), true);
  assert.equal(podeGerenciarManual(gerenteA, manualB), false);
  // Usuário nunca cria nem edita, nem no próprio departamento.
  assert.equal(podeGerenciarManual(usuarioA, manualA), false);
  assert.equal(podeGerenciarManual(usuarioA, manualB), false);
});

// --- Matriz: visualizar manuais ---

test('podeVerManual segue a matriz', () => {
  assert.equal(podeVerManual(admin, manualA), true);
  assert.equal(podeVerManual(admin, manualB), true);
  // Gerente e usuário: só o próprio departamento.
  assert.equal(podeVerManual(gerenteA, manualA), true);
  assert.equal(podeVerManual(gerenteA, manualB), false);
  assert.equal(podeVerManual(usuarioA, manualA), true);
  assert.equal(podeVerManual(usuarioA, manualB), false);
});

test('usuário vê mas não gerencia o manual do próprio departamento', () => {
  assert.equal(podeVerManual(usuarioA, manualA), true);
  assert.equal(podeGerenciarManual(usuarioA, manualA), false);
});

// --- exigirPapel + HTTP ---

async function comServidor(fn) {
  const app = express();
  app.use(express.json());

  // Só administrador (ex.: departamentos, usuários — T8/T11).
  app.get('/api/departamentos', autenticar, exigirPapel('administrador'), (req, res) =>
    res.json({ ok: true }),
  );
  // Administrador ou gerente (ex.: escrita de sistemas — T9).
  app.post('/api/sistemas', autenticar, exigirPapel('administrador', 'gerente'), (req, res) =>
    res.json({ ok: true }),
  );
  // Escopo por departamento: o 403 não pode vazar nada do recurso.
  app.get('/api/manuais/:id/download', autenticar, (req, res) => {
    const manual = req.params.id === '100' ? manualA : manualB;
    if (!podeVerManual(req.user, manual)) return negarAcesso(res);
    return res.json({ url: 'https://signed.example/manual?X-Goog-Signature=abc', expiresAt: 1 });
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

const comToken = (user) => ({ authorization: `Bearer ${assinarToken(user)}` });

test('exigirPapel: 403 para papel errado, 200 para papel permitido', async () => {
  await comServidor(async (base) => {
    // Só administrador.
    assert.equal((await fetch(`${base}/api/departamentos`, { headers: comToken(admin) })).status, 200);
    assert.equal((await fetch(`${base}/api/departamentos`, { headers: comToken(gerenteA) })).status, 403);
    assert.equal((await fetch(`${base}/api/departamentos`, { headers: comToken(usuarioA) })).status, 403);

    // Administrador ou gerente: usuário nunca cria.
    const post = (user) =>
      fetch(`${base}/api/sistemas`, { method: 'POST', headers: comToken(user) });
    assert.equal((await post(admin)).status, 200);
    assert.equal((await post(gerenteA)).status, 200);
    assert.equal((await post(usuarioA)).status, 403);
  });
});

test('exigirPapel sem autenticação devolve 401, não 403', async () => {
  await comServidor(async (base) => {
    assert.equal((await fetch(`${base}/api/departamentos`)).status, 401);
  });
});

test('gerente do depto A recebe 403 em manual do depto B e o 403 não vaza dado', async () => {
  await comServidor(async (base) => {
    const proibido = await fetch(`${base}/api/manuais/200/download`, { headers: comToken(gerenteA) });
    assert.equal(proibido.status, 403);
    const corpo = await proibido.json();
    // Nada do recurso: sem título, sem URL assinada, sem chave de objeto.
    assert.deepEqual(corpo, { erro: 'Sem permissão' });
    const texto = JSON.stringify(corpo);
    assert.equal(texto.includes('Manual B'), false);
    assert.equal(texto.includes('X-Goog-Signature'), false);
    assert.equal(texto.includes('http'), false);

    // No próprio departamento, o mesmo usuário recebe a URL normalmente.
    const permitido = await fetch(`${base}/api/manuais/100/download`, { headers: comToken(gerenteA) });
    assert.equal(permitido.status, 200);
    assert.match((await permitido.json()).url, /X-Goog-Signature/);
  });
});

test('usuário do depto A também recebe 403 em recurso do depto B', async () => {
  await comServidor(async (base) => {
    const r = await fetch(`${base}/api/manuais/200/download`, { headers: comToken(usuarioA) });
    assert.equal(r.status, 403);
    assert.deepEqual(await r.json(), { erro: 'Sem permissão' });
  });
});
