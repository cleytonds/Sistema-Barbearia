import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'phase4-test-secret-with-at-least-32-characters-123';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_ISSUER = 'barbearia-api';
process.env.JWT_AUDIENCE = 'barbearia-web';
const { app } = await import('../src/app.js');
const { pool } = await import('../src/config/database.js');
const { issueAccessToken } = await import('../src/auth/jwtIssuer.js');
const { hashPassword } = await import('../src/auth/password.js');
const { grantRole } = await import('../src/repositories/roleRepository.js');
const key = randomUUID().replaceAll('-', '').slice(0, 10),
  serviceName = `Serviço Fase4 ${key}`,
  barberEmail = `barber-${key}@example.com`,
  adminEmail = `admin-${key}@example.com`,
  clientEmail = `client-${key}@example.com`;
let server,
  base,
  adminId,
  clientId,
  barberUserId,
  barberId,
  serviceId,
  adminToken,
  clientToken,
  barberToken;
async function req(path, { method = 'GET', body, token } = {}) {
  return fetch(base + path, {
    method,
    headers: {
      ...(body && { 'content-type': 'application/json' }),
      ...(token && { authorization: `Bearer ${token}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
}
test.before(async () => {
  const h = await hashPassword('SenhaTeste123');
  for (const [email, profile] of [
    [adminEmail, 'admin'],
    [clientEmail, 'cliente'],
  ]) {
    const [r] = await pool.execute(
      'INSERT INTO usuarios(nome,email,telefone,senha_hash,perfil)VALUES(?,?,?,?,?)',
      [`Teste ${profile}`, email, `81${Math.random().toString().slice(2, 11)}`, h, profile],
    );
    await grantRole(r.insertId, profile);
    if (profile === 'admin') adminId = r.insertId;
    else clientId = r.insertId;
  }
  const [[a]] = await pool.execute('SELECT id,auth_versao FROM usuarios WHERE id=?', [adminId]);
  const [[c]] = await pool.execute('SELECT id,auth_versao FROM usuarios WHERE id=?', [clientId]);
  adminToken = issueAccessToken(a);
  clientToken = issueAccessToken(c);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(async () => {
  if (barberId) await pool.execute('DELETE FROM barbeiro_servicos WHERE barbeiro_id=?', [barberId]);
  if (barberId)
    await pool.execute('DELETE FROM bloqueios_agenda WHERE barbeiro_id=? OR criado_por IN (?,?)', [
      barberId,
      adminId,
      barberUserId,
    ]);
  if (barberId) await pool.execute('DELETE FROM horarios_trabalho WHERE barbeiro_id=?', [barberId]);
  if (barberId) await pool.execute('DELETE FROM barbeiros WHERE id=?', [barberId]);
  if (serviceId) await pool.execute('DELETE FROM servicos WHERE id=?', [serviceId]);
  for (const id of [barberUserId, adminId, clientId])
    if (id) await pool.execute('DELETE FROM usuarios WHERE id=?', [id]);
  await new Promise((r) => server.close(r));
  await pool.end();
});
test('permissões administrativas e CRUD de serviços', async () => {
  assert.equal((await req('/admin/servicos', { token: clientToken })).status, 403);
  let r = await req('/admin/servicos', {
      method: 'POST',
      token: adminToken,
      body: { nome: `  ${serviceName}  `, descricao: 'Teste', preco: '49.90', duracao_minutos: 45 },
    }),
    j = await r.json();
  assert.equal(r.status, 201);
  serviceId = j.data.id;
  r = await req('/admin/servicos', {
    method: 'POST',
    token: adminToken,
    body: { nome: serviceName, preco: '10.00', duracao_minutos: 10 },
  });
  assert.equal(r.status, 409);
  r = await req(`/admin/servicos/${serviceId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { ativo: false },
  });
  assert.equal(r.status, 200);
  assert.equal((await req(`/servicos/${serviceId}`)).status, 404);
  await req(`/admin/servicos/${serviceId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { ativo: true },
  });
  assert.equal((await req(`/servicos/${serviceId}`)).status, 200);
});
test('criação transacional de barbeiro, vínculo e área própria', async () => {
  let r = await req('/admin/barbeiros', {
      method: 'POST',
      token: adminToken,
      body: {
        nome: 'Barbeiro Teste',
        email: barberEmail,
        telefone: `819${key.replace(/\D/g, '').padEnd(8, '8').slice(0, 8)}`,
        senha: 'SenhaBarber123',
        confirmacaoSenha: 'SenhaBarber123',
        descricao: 'Profissional',
        foto_url: 'http://localhost/foto.jpg',
        especialidades: 'Cortes',
      },
    }),
    j = await r.json();
  assert.equal(r.status, 201);
  barberId = j.data.id;
  barberUserId = j.data.usuario_id;
  assert.equal(j.data.senha_hash, undefined);
  r = await req(`/admin/barbeiros/${barberId}/servicos`, {
    method: 'PUT',
    token: adminToken,
    body: { servicoIds: [serviceId] },
  });
  assert.equal(r.status, 200);
  r = await req(`/admin/barbeiros/${barberId}/servicos`, {
    method: 'PUT',
    token: adminToken,
    body: { servicoIds: [serviceId, serviceId] },
  });
  assert.equal(r.status, 422);
  const [[u]] = await pool.execute('SELECT id,auth_versao FROM usuarios WHERE id=?', [
    barberUserId,
  ]);
  barberToken = issueAccessToken(u);
  r = await req('/barbeiro/me', { token: barberToken });
  assert.equal(r.status, 200);
  r = await req('/barbeiro/me/servicos', { token: barberToken });
  j = await r.json();
  assert.equal(j.data.length, 1);
  assert.equal((await req('/admin/barbeiros', { token: barberToken })).status, 403);
});
test('listagem pública filtra barbeiros por serviço sem duplicar ou expor inativos', async () => {
  let response = await req('/barbeiros?page=1&limit=1');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).pagination.limit, 1);

  response = await req(`/barbeiros?servicoId=${serviceId}`);
  assert.equal(response.status, 200);
  let payload = await response.json();
  assert.equal(payload.data.filter((item) => item.id === String(barberId)).length, 1);
  assert.equal(payload.data[0].email, undefined);
  assert.equal((await req('/barbeiros?servicoId=abc')).status, 422);
  assert.equal((await req('/barbeiros?servicoId=999999999')).status, 404);

  await pool.execute('UPDATE servicos SET ativo=FALSE WHERE id=?', [serviceId]);
  assert.equal((await req(`/barbeiros?servicoId=${serviceId}`)).status, 404);
  await pool.execute('UPDATE servicos SET ativo=TRUE WHERE id=?', [serviceId]);

  await pool.execute('UPDATE barbeiros SET ativo=FALSE WHERE id=?', [barberId]);
  payload = await (await req(`/barbeiros?servicoId=${serviceId}`)).json();
  assert.equal(
    payload.data.some((item) => item.id === String(barberId)),
    false,
  );
  await pool.execute('UPDATE barbeiros SET ativo=TRUE WHERE id=?', [barberId]);

  await pool.execute('UPDATE usuarios SET ativo=FALSE WHERE id=?', [barberUserId]);
  payload = await (await req(`/barbeiros?servicoId=${serviceId}`)).json();
  assert.equal(
    payload.data.some((item) => item.id === String(barberId)),
    false,
  );
  await pool.execute('UPDATE usuarios SET ativo=TRUE WHERE id=?', [barberUserId]);

  const source = await readFile(
    new URL('../src/repositories/barbeiroRepository.js', import.meta.url),
    'utf8',
  );
  assert.match(source, /bs\.servico_id=\?/);
  assert.doesNotMatch(source, /bs\.servico_id=\$\{/);
});
test('configurações e horários respeitam exposição e papéis', async () => {
  const pub = await req('/configuracoes/publicas');
  const p = await pub.json();
  assert.equal(pub.status, 200);
  assert.equal(p.data.nomeBarbearia, p.data.nome_barbearia);
  assert.equal(p.data.fusoHorario, p.data.fuso_horario);
  assert.equal(p.data.antecedenciaMaximaDias, 30);
  assert.match(p.data.agora, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  assert.equal(p.data.tempo_minimo_cancelamento_horas, undefined);
  assert.equal(p.data.intervalo_entre_atendimentos_minutos, undefined);
  assert.equal((await req('/admin/configuracoes', { token: clientToken })).status, 403);
  assert.equal((await req('/admin/configuracoes', { token: adminToken })).status, 200);
  assert.equal((await req('/configuracoes/horarios')).status, 200);
  assert.equal((await req('/barbeiro/me/horarios', { token: barberToken })).status, 200);
});
test('bloqueios próprios e globais aplicam propriedade', async () => {
  const payload = {
    inicioLocal: '2035-08-10T09:00:00',
    fimLocal: '2035-08-10T10:00:00',
    motivo: 'Teste automatizado',
  };
  let r = await req('/barbeiro/me/bloqueios', {
      method: 'POST',
      token: barberToken,
      body: { ...payload, barbeiroId: null },
    }),
    j = await r.json();
  assert.equal(r.status, 201);
  assert.equal(j.data.barbeiro_id, String(barberId));
  const ownId = j.data.id;
  r = await req('/admin/bloqueios', {
    method: 'POST',
    token: adminToken,
    body: {
      ...payload,
      inicioLocal: '2035-08-11T09:00:00',
      fimLocal: '2035-08-11T10:00:00',
      barbeiroId: null,
    },
  });
  j = await r.json();
  assert.equal(r.status, 201);
  assert.equal(j.data.barbeiro_id, null);
  await pool.execute('DELETE FROM bloqueios_agenda WHERE id=?', [j.data.id]);
  assert.equal(
    (await req(`/barbeiro/me/bloqueios/${ownId}`, { method: 'DELETE', token: barberToken })).status,
    204,
  );
});
