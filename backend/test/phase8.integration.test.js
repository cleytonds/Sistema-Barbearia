import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'phase8-test-secret-with-at-least-32-characters-123';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_ISSUER = 'barbearia-api';
process.env.JWT_AUDIENCE = 'barbearia-web';
const { app } = await import('../src/app.js');
const { pool } = await import('../src/config/database.js');
const { issueAccessToken } = await import('../src/auth/jwtIssuer.js');
const { hashPassword } = await import('../src/auth/password.js');
const { grantRole } = await import('../src/repositories/roleRepository.js');
const marker = `F8-${randomUUID().slice(0, 8)}`;
let server, base, admin, client, barberUser, barberId;
async function addUser(perfil) {
  const [result] = await pool.execute(
    'INSERT INTO usuarios(nome,email,telefone,senha_hash,perfil)VALUES(?,?,?,?,?)',
    [
      `${marker} ${perfil}`,
      `${marker}-${perfil}@example.test`,
      `81${String(Date.now() + Math.random())
        .replace(/\D/g, '')
        .slice(-9)}`,
      await hashPassword('SenhaTeste123'),
      perfil,
    ],
  );
  await grantRole(result.insertId, perfil);
  const [[user]] = await pool.execute('SELECT id,auth_versao FROM usuarios WHERE id=?', [
    result.insertId,
  ]);
  return { id: result.insertId, token: issueAccessToken(user) };
}
async function api(path, token, options = {}) {
  return fetch(base + path, {
    ...options,
    headers: {
      ...(options.body && { 'content-type': 'application/json' }),
      authorization: `Bearer ${token}`,
    },
  });
}
test.before(async () => {
  admin = await addUser('admin');
  client = await addUser('cliente');
  barberUser = await addUser('barbeiro');
  const [result] = await pool.execute('INSERT INTO barbeiros(usuario_id,descricao)VALUES(?,?)', [
    barberUser.id,
    marker,
  ]);
  barberId = result.insertId;
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(async () => {
  if (barberId) await pool.execute('DELETE FROM barbeiros WHERE id=?', [barberId]);
  for (const user of [barberUser, client, admin])
    if (user) await pool.execute('DELETE FROM usuarios WHERE id=?', [user.id]);
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
});
test('dashboards respeitam perfis e não expõem indicadores financeiros', async () => {
  const date = new Date().toISOString().slice(0, 10);
  let response = await api(`/barbeiro/dashboard?data=${date}`, barberUser.token);
  assert.equal(response.status, 200);
  let body = await response.json();
  assert.equal(body.data.total, 0);
  const serialized = JSON.stringify(body).toLowerCase();
  for (const forbidden of ['receita', 'faturamento', 'lucro', 'comissao', 'preco'])
    assert.equal(serialized.includes(forbidden), false);
  response = await api(`/admin/dashboard?data=${date}`, admin.token);
  assert.equal(response.status, 200);
  body = await response.json();
  assert.ok(Array.isArray(body.data.porBarbeiro));
  assert.equal((await api(`/admin/dashboard?data=${date}`, barberUser.token)).status, 403);
  assert.equal((await api(`/barbeiro/dashboard?data=${date}`, client.token)).status, 403);
});
test('busca e histórico de clientes são paginados e exclusivos do admin', async () => {
  assert.equal((await api('/admin/clientes?search=a', admin.token)).status, 422);
  const uniqueClientSearch = `${marker}-cliente@example.test`;
  let response = await api(
    `/admin/clientes?search=${encodeURIComponent(uniqueClientSearch)}&page=1&limit=10`,
    admin.token,
  );
  assert.equal(response.status, 200);
  let body = await response.json();
  assert.equal(body.data[0].id, String(client.id));
  assert.equal('senha_hash' in body.data[0], false);
  response = await api(`/admin/clientes/${client.id}/agendamentos?page=1&limit=10`, admin.token);
  assert.equal(response.status, 200);
  body = await response.json();
  assert.equal(body.data.resumo.total, 0);
  const responseText = JSON.stringify(body).toLowerCase();
  for (const forbidden of ['senha_hash', 'token', 'idempotency_key_hash', 'stack'])
    assert.equal(responseText.includes(forbidden), false);
  assert.equal((await api(`/admin/clientes?search=${marker}`, barberUser.token)).status, 403);
});
test('perfil próprio aceita somente campos profissionais e bloqueios são paginados', async () => {
  let response = await api('/barbeiro/me', barberUser.token, {
    method: 'PUT',
    body: JSON.stringify({
      descricao: `${marker} atualizado`,
      especialidades: 'Cortes',
      foto_url: null,
    }),
  });
  assert.equal(response.status, 200);
  for (const field of ['nome', 'email', 'telefone', 'perfil', 'ativo', 'senha']) {
    response = await api('/barbeiro/me', barberUser.token, {
      method: 'PUT',
      body: JSON.stringify({ [field]: 'Inválido' }),
    });
    assert.equal(response.status, 422, field);
  }
  response = await api('/barbeiro/me/bloqueios?page=1&limit=10&order=asc', barberUser.token);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.pagination, { page: 1, limit: 10, total: 0, totalPages: 0 });
});

test('todas as rotas administrativas novas exigem admin', async () => {
  const date = new Date().toISOString().slice(0, 10);
  for (const path of [
    `/admin/dashboard?data=${date}`,
    `/admin/clientes?search=${marker}`,
    `/admin/clientes/${client.id}/agendamentos`,
    '/admin/servicos',
    '/admin/barbeiros',
    '/admin/bloqueios',
    '/admin/configuracoes',
  ]) {
    assert.equal((await api(path, client.token)).status, 403, path);
    assert.equal((await api(path, barberUser.token)).status, 403, path);
  }
});
