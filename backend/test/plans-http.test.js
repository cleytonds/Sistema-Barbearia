import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'plans-http-test-secret-with-at-least-32-characters-1234';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_ISSUER = 'barbearia-api';
process.env.JWT_AUDIENCE = 'barbearia-web';

const { app } = await import('../src/app.js');
const { issueAccessToken } = await import('../src/auth/jwtIssuer.js');
const { hashPassword } = await import('../src/auth/password.js');
const { pool } = await import('../src/config/database.js');
const { grantRole } = await import('../src/repositories/roleRepository.js');

const marker = `PH-${randomUUID().slice(0, 8)}`;
const zones = 'America/Recife';

let server;
let base;
let adminId;
let clientId;
let otherClientId;
let barberUserId;
let barberToken;
let barberId;
let serviceId;
let service2Id;
let planId;
let adminSubscriptionId;
let adminToken;
let clientToken;
let otherClientToken;

async function api(path, { method = 'GET', token, body, key } = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token && { cookie: `barbearia_session=${token}` }),
      ...(token &&
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && {
          origin: 'http://localhost:5173',
          'x-csrf-protection': '1',
        }),
      ...(body && { 'content-type': 'application/json' }),
      ...(key && { 'Idempotency-Key': key }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
}

async function addUser(profile, suffix) {
  const password = await hashPassword('SenhaTeste123');
  const [result] = await pool.execute(
    'INSERT INTO usuarios(nome,email,telefone,senha_hash,perfil) VALUES(?,?,?,?,?)',
    [
      `${marker} ${suffix}`,
      `${marker}-${suffix}@example.test`,
      `81${String(Date.now() + Math.floor(Math.random() * 9999)).slice(-9)}`,
      password,
      profile,
    ],
  );
  await grantRole(result.insertId, profile);
  const [[user]] = await pool.execute('SELECT id,auth_versao FROM usuarios WHERE id=?', [
    result.insertId,
  ]);
  return { id: result.insertId, token: issueAccessToken(user) };
}

function planPayload(overrides = {}) {
  return {
    nome: `${marker} Plano`,
    descricao: 'Plano de teste',
    preco: '99.90',
    adesaoInicio: '2026-08-01',
    adesaoFim: '2026-12-31',
    utilizacaoInicio: '2026-08-01',
    utilizacaoFim: '2026-12-31',
    possuiLimiteSemanal: true,
    limiteSemanal: 2,
    possuiLimiteTotal: true,
    limiteTotal: 8,
    servicos: [serviceId],
    barbeiros: [barberId],
    ...overrides,
  };
}

function signPayload(overrides = {}) {
  return {
    inicioEm: '2026-09-01',
    fimEm: '2026-09-30',
    fusoHorario: zones,
    ...overrides,
  };
}

test.before(async () => {
  ({ id: adminId, token: adminToken } = await addUser('admin', 'admin'));
  ({ id: clientId, token: clientToken } = await addUser('cliente', 'cliente'));
  ({ id: otherClientId, token: otherClientToken } = await addUser('cliente', 'cliente2'));
  ({ id: barberUserId, token: barberToken } = await addUser('barbeiro', 'barbeiro'));
  const [barberResult] = await pool.execute('INSERT INTO barbeiros(usuario_id) VALUES(?)', [
    barberUserId,
  ]);
  barberId = barberResult.insertId;
  const [serviceResult] = await pool.execute(
    'INSERT INTO servicos(nome,preco,duracao_minutos) VALUES(?,40.00,30)',
    [`${marker} Serviço A`],
  );
  serviceId = serviceResult.insertId;
  const [serviceResult2] = await pool.execute(
    'INSERT INTO servicos(nome,preco,duracao_minutos) VALUES(?,50.00,45)',
    [`${marker} Serviço B`],
  );
  service2Id = serviceResult2.insertId;
  await pool.execute('INSERT INTO barbeiro_servicos(barbeiro_id,servico_id) VALUES(?,?)', [
    barberId,
    serviceId,
  ]);
  await pool.execute('INSERT INTO barbeiro_servicos(barbeiro_id,servico_id) VALUES(?,?)', [
    barberId,
    service2Id,
  ]);

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(async () => {
  await pool.execute(
    `DELETE h FROM historico_planos h
     WHERE h.plano_id IN (SELECT id FROM planos WHERE nome LIKE ?)
        OR h.assinatura_id IN (SELECT id FROM assinaturas_planos WHERE cliente_id IN (?, ?))`,
    [`${marker}%`, clientId, otherClientId],
  );
  await pool.execute(
    `DELETE FROM usos_planos WHERE assinatura_id IN
      (SELECT id FROM assinaturas_planos WHERE cliente_id IN (?, ?))`,
    [clientId, otherClientId],
  );
  await pool.execute(
    `DELETE FROM pagamentos_planos WHERE assinatura_id IN
      (SELECT id FROM assinaturas_planos WHERE cliente_id IN (?, ?))`,
    [clientId, otherClientId],
  );
  await pool.execute(
    `DELETE FROM assinatura_plano_servicos WHERE assinatura_id IN
      (SELECT id FROM assinaturas_planos WHERE cliente_id IN (?, ?))`,
    [clientId, otherClientId],
  );
  await pool.execute(
    `DELETE FROM assinatura_plano_barbeiros WHERE assinatura_id IN
      (SELECT id FROM assinaturas_planos WHERE cliente_id IN (?, ?))`,
    [clientId, otherClientId],
  );
  await pool.execute(`DELETE FROM assinaturas_planos WHERE cliente_id IN (?, ?)`, [
    clientId,
    otherClientId,
  ]);
  await pool.execute(
    `DELETE FROM plano_servicos WHERE plano_id IN (SELECT id FROM planos WHERE nome LIKE ?)`,
    [`${marker}%`],
  );
  await pool.execute(
    `DELETE FROM plano_barbeiros WHERE plano_id IN (SELECT id FROM planos WHERE nome LIKE ?)`,
    [`${marker}%`],
  );
  await pool.execute('DELETE FROM planos WHERE nome LIKE ?', [`${marker}%`]);
  await pool.execute('DELETE FROM barbeiro_servicos WHERE barbeiro_id=?', [barberId]);
  await pool.execute('DELETE FROM barbeiros WHERE id=?', [barberId]);
  await pool.execute('DELETE FROM servicos WHERE id IN (?,?)', [serviceId, service2Id]);
  await pool.execute('DELETE FROM usuarios WHERE id IN (?,?,?,?)', [
    adminId,
    clientId,
    otherClientId,
    barberUserId,
  ]);
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

// ===========================================================================
// Público
// ===========================================================================
test('público: lista planos ativos e exige campos essenciais', async () => {
  const response = await api('/planos');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(Array.isArray(body.data));
  assert.ok(body.pagination.total >= 0);
  for (const plan of body.data) {
    assert.equal(typeof plan.id, 'string');
    assert.equal(plan.criado_por, undefined);
    assert.equal(plan.uso_suspensao_motivo, undefined);
    assert.equal(plan.criado_em, undefined);
  }
});

test('público: GET /planos/:id retorna plano ou 404', async () => {
  const missing = await api('/planos/999999999');
  assert.equal(missing.status, 404);
});

// ===========================================================================
// Admin — planos
// ===========================================================================
test('admin: cria plano com 201 e validações', async () => {
  const response = await api('/admin/planos', {
    method: 'POST',
    token: adminToken,
    body: planPayload(),
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  planId = body.data.id;
  assert.equal(body.data.nome, `${marker} Plano`);
  assert.equal(body.data.preco, '99.90');
  assert.equal(body.data.servicos.length, 1);
  assert.equal(body.data.barbeiros.length, 1);

  const publicDetailResponse = await api(`/planos/${planId}`);
  assert.equal(publicDetailResponse.status, 200);
  const publicDetail = (await publicDetailResponse.json()).data;
  assert.deepEqual(publicDetail.servicos, [{ id: String(serviceId), nome: `${marker} Serviço A` }]);
  assert.deepEqual(publicDetail.barbeiros, [{ id: String(barberId), nome: `${marker} barbeiro` }]);
  assert.equal(publicDetail.barbeiros[0].email, undefined);
  assert.equal(publicDetail.barbeiros[0].telefone, undefined);
  assert.equal(publicDetail.barbeiros[0].usuario_id, undefined);

  const invalid = await api('/admin/planos', {
    method: 'POST',
    token: adminToken,
    body: planPayload({ preco: 'abc' }),
  });
  assert.equal(invalid.status, 422);

  const noAuth = await api('/admin/planos', { method: 'POST', body: planPayload() });
  assert.equal(noAuth.status, 401);
  const barber = await api('/admin/planos', { token: barberToken });
  assert.equal(barber.status, 403);
});

test('admin: lista e atualiza plano', async () => {
  const list = await api('/admin/planos', { token: adminToken });
  assert.equal(list.status, 200);
  const listBody = await list.json();
  assert.ok(listBody.data.some((item) => String(item.id) === String(planId)));

  const update = await api(`/admin/planos/${planId}`, {
    method: 'PUT',
    token: adminToken,
    body: planPayload({ preco: '129.90', servicos: [serviceId, service2Id] }),
  });
  assert.equal(update.status, 200);
  const updated = (await update.json()).data;
  assert.equal(updated.preco, '129.90');
  assert.equal(updated.servicos.length, 2);
});

test('admin: altera status do plano', async () => {
  const suspend = await api(`/admin/planos/${planId}/uso`, {
    method: 'PATCH',
    token: adminToken,
    body: { permitido: false, motivo: 'Manutenção' },
  });
  assert.equal(suspend.status, 200);
  assert.equal((await suspend.json()).data.uso_status, 'suspenso');

  const allow = await api(`/admin/planos/${planId}/uso`, {
    method: 'PATCH',
    token: adminToken,
    body: { permitido: true },
  });
  assert.equal(allow.status, 200);
  assert.equal((await allow.json()).data.uso_status, 'permitido');

  const close = await api(`/admin/planos/${planId}/adesoes`, {
    method: 'PATCH',
    token: adminToken,
    body: { abertas: false },
  });
  assert.equal(close.status, 200);
  const open = await api(`/admin/planos/${planId}/adesoes`, {
    method: 'PATCH',
    token: adminToken,
    body: { abertas: true },
  });
  assert.equal(open.status, 200);

  const deactivate = await api(`/admin/planos/${planId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { ativo: false },
  });
  assert.equal(deactivate.status, 200);
  assert.equal(Boolean((await deactivate.json()).data.ativo), false);

  const [[preservedPlan]] = await pool.execute('SELECT ativo FROM planos WHERE id=?', [planId]);
  const [[history]] = await pool.execute(
    "SELECT COUNT(*) AS total FROM historico_planos WHERE plano_id=? AND tipo_evento='plano_desativado'",
    [planId],
  );
  assert.equal(Boolean(preservedPlan.ativo), false);
  assert.equal(Number(history.total), 1);
  assert.equal((await api(`/planos/${planId}`)).status, 404);
  assert.equal((await api(`/admin/planos/${planId}`, { token: adminToken })).status, 200);

  const stringBoolean = await api(`/admin/planos/${planId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { ativo: 'false' },
  });
  assert.equal(stringBoolean.status, 422);
  assert.equal(
    (
      await api(`/admin/planos/${planId}/status`, {
        method: 'PATCH',
        body: { ativo: true },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await api(`/admin/planos/${planId}/status`, {
        method: 'PATCH',
        token: barberToken,
        body: { ativo: true },
      })
    ).status,
    403,
  );

  const activate = await api(`/admin/planos/${planId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { ativo: true },
  });
  assert.equal(activate.status, 200);
  assert.equal(Boolean((await activate.json()).data.ativo), true);

  const detail = await api(`/admin/planos/${planId}`, { token: adminToken });
  const subscribers = await api(`/admin/planos/${planId}/assinantes`, { token: adminToken });
  assert.equal(detail.status, 200);
  assert.equal(subscribers.status, 200);
});

// ===========================================================================
// Admin — assinaturas
// ===========================================================================
test('admin: cria assinatura administrativa e lista', async () => {
  const create = await api('/admin/assinaturas-planos', {
    method: 'POST',
    token: adminToken,
    body: {
      clienteId: clientId,
      planoId: planId,
      inicioEm: '2026-09-01',
      fimEm: '2026-09-30',
      fusoHorario: zones,
    },
  });
  assert.equal(create.status, 201);
  const created = (await create.json()).data;
  adminSubscriptionId = created.id;
  assert.equal(created.status, 'aguardando_pagamento');
  assert.equal(created.idempotency_key_hash, undefined);
  assert.equal(created.idempotency_payload_hash, undefined);

  const list = await api('/admin/assinaturas-planos', { token: adminToken });
  assert.equal(list.status, 200);
  const listBody = await list.json();
  assert.ok(listBody.data.some((item) => String(item.id) === String(created.id)));
});

test('admin: altera status da assinatura', async () => {
  const list = await api('/admin/assinaturas-planos', { token: adminToken });
  const assinatura = (await list.json()).data.find(
    (item) => String(item.cliente_id) === String(clientId),
  );
  assert.ok(assinatura);

  const payment = await api(
    `/admin/assinaturas-planos/${adminSubscriptionId}/confirmar-pagamento`,
    {
      method: 'PUT',
      token: adminToken,
      body: {
        referencia: '2026-09-01',
        valor: '129.90',
        forma: 'presencial',
      },
    },
  );
  assert.equal(payment.status, 200);
  let subscriptionDetail = await api(`/admin/assinaturas-planos/${assinatura.id}`, {
    token: adminToken,
  });
  assert.equal((await subscriptionDetail.json()).data.status, 'ativa');

  const suspend = await api(`/admin/assinaturas-planos/${assinatura.id}/suspender`, {
    method: 'PUT',
    token: adminToken,
    body: { motivo: 'Pausa administrativa' },
  });
  assert.equal(suspend.status, 200);
  assert.equal((await suspend.json()).data.status, 'suspensa');
  const reactivate = await api(`/admin/assinaturas-planos/${assinatura.id}/reativar`, {
    method: 'PUT',
    token: adminToken,
    body: { motivo: 'Retomada administrativa' },
  });
  assert.equal(reactivate.status, 200);
  assert.equal((await reactivate.json()).data.status, 'ativa');

  const cancel = await api(`/admin/assinaturas-planos/${assinatura.id}/cancelar`, {
    method: 'PUT',
    token: adminToken,
    body: { motivo: 'Pedido do cliente' },
  });
  assert.equal(cancel.status, 200);
  assert.equal((await cancel.json()).data.status, 'cancelada');
  const invalidReactivate = await api(`/admin/assinaturas-planos/${assinatura.id}/reativar`, {
    method: 'PUT',
    token: adminToken,
    body: { motivo: 'Reabertura indevida' },
  });
  assert.equal(invalidReactivate.status, 409);

  subscriptionDetail = await api(`/admin/assinaturas-planos/${assinatura.id}`, {
    token: adminToken,
  });
  const usages = await api(`/admin/assinaturas-planos/${assinatura.id}/usos`, {
    token: adminToken,
  });
  const history = await api(`/admin/assinaturas-planos/${assinatura.id}/historico`, {
    token: adminToken,
  });
  assert.equal(subscriptionDetail.status, 200);
  assert.equal(usages.status, 200);
  assert.equal(history.status, 200);
  assert.ok((await history.json()).data.length > 0);
});

// ===========================================================================
// Cliente
// ===========================================================================
test('cliente: assina plano com idempotência e my-plan/usos', async () => {
  const key = randomUUID();
  const body = signPayload();
  const response = await api(`/planos/${planId}/solicitacoes`, {
    method: 'POST',
    token: otherClientToken,
    body,
    key,
  });
  assert.equal(response.status, 201);
  const created = (await response.json()).data;
  assert.equal(created.status, 'aguardando_pagamento');
  assert.equal(created.idempotency_key_hash, undefined);

  const replay = await api(`/planos/${planId}/solicitacoes`, {
    method: 'POST',
    token: otherClientToken,
    body,
    key,
  });
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).data.id, created.id);

  const conflict = await api(`/planos/${planId}/solicitacoes`, {
    method: 'POST',
    token: otherClientToken,
    body: signPayload({ fimEm: '2026-09-29' }),
    key,
  });
  assert.equal(conflict.status, 409);

  const myPlan = await api('/meu-plano', { token: otherClientToken });
  assert.equal(myPlan.status, 200);
  assert.equal((await myPlan.json()).data.id, created.id);

  const usos = await api('/meu-plano/usos', { token: otherClientToken });
  assert.equal(usos.status, 200);
  assert.ok(Array.isArray((await usos.json()).data));
});

test('cliente cancela assinatura suspensa uma vez e preserva histórico', async () => {
  const [[subscription]] = await pool.execute(
    `SELECT id FROM assinaturas_planos
     WHERE cliente_id=? AND status='aguardando_pagamento' ORDER BY criado_em DESC LIMIT 1`,
    [otherClientId],
  );
  await pool.execute(
    `UPDATE assinaturas_planos SET status='suspensa', ativada_em=NOW(6),
     suspensa_em=NOW(6), motivo_status='Pausa de teste' WHERE id=?`,
    [subscription.id],
  );

  const response = await api('/meu-plano/cancelar', {
    method: 'POST',
    token: otherClientToken,
    body: { motivo: 'Cancelamento solicitado pelo cliente' },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.status, 'cancelada');

  const replay = await api('/meu-plano/cancelar', {
    method: 'POST',
    token: otherClientToken,
    body: { motivo: 'Nova tentativa' },
  });
  assert.equal(replay.status, 404);
  const [[history]] = await pool.execute(
    `SELECT COUNT(*) total FROM historico_planos
     WHERE assinatura_id=? AND tipo_evento='assinatura_cancelada'`,
    [subscription.id],
  );
  assert.equal(Number(history.total), 1);

  const activeCreation = await api(`/planos/${planId}/solicitacoes`, {
    method: 'POST',
    token: otherClientToken,
    body: signPayload(),
    key: randomUUID(),
  });
  assert.equal(activeCreation.status, 201);
  const activeId = (await activeCreation.json()).data.id;
  await pool.execute(
    `UPDATE assinaturas_planos SET status='ativa', ativada_em=NOW(6),
     suspensa_em=NULL, cancelada_em=NULL, motivo_status=NULL WHERE id=?`,
    [activeId],
  );
  const activeCancel = await api('/meu-plano/cancelar', {
    method: 'POST',
    token: otherClientToken,
    body: { motivo: 'Cancelamento da assinatura ativa' },
  });
  assert.equal(activeCancel.status, 200);
  assert.equal((await activeCancel.json()).data.status, 'cancelada');

  const missingReason = await api('/meu-plano/cancelar', {
    method: 'POST',
    token: clientToken,
    body: { motivo: '' },
  });
  assert.equal(missingReason.status, 422);
});

test('cliente: assinatura sem Idempotency-Key é rejeitada', async () => {
  const noAuth = await api(`/planos/${planId}/solicitacoes`, {
    method: 'POST',
    body: signPayload(),
    key: randomUUID(),
  });
  assert.equal(noAuth.status, 401);
  const response = await api(`/planos/${planId}/solicitacoes`, {
    method: 'POST',
    token: otherClientToken,
    body: signPayload(),
  });
  assert.equal(response.status, 422);
});

test('cliente: rejeita campos controlados pelo servidor', async () => {
  const invalid = await api(`/planos/${planId}/solicitacoes`, {
    method: 'POST',
    token: otherClientToken,
    key: randomUUID(),
    body: { ...signPayload(), clienteId: clientId, status: 'ativa' },
  });
  assert.equal(invalid.status, 422);
});

test('cliente: não acessa admin e admin não acessa meu-plano', async () => {
  const adminAsClient = await api('/meu-plano', { token: adminToken });
  assert.equal(adminAsClient.status, 403);
  const clientAsAdmin = await api('/admin/planos', { token: clientToken });
  assert.equal(clientAsAdmin.status, 403);
  const clientStatus = await api(`/admin/assinaturas-planos/${adminSubscriptionId}/suspender`, {
    method: 'PUT',
    token: clientToken,
    body: { motivo: 'Tentativa indevida' },
  });
  assert.equal(clientStatus.status, 403);
  const barberStatus = await api(`/admin/assinaturas-planos/${adminSubscriptionId}/cancelar`, {
    method: 'PUT',
    token: barberToken,
    body: { motivo: 'Tentativa indevida' },
  });
  assert.equal(barberStatus.status, 403);
});
