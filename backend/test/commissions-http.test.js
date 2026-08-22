import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'commissions-http-test-secret-with-at-least-32-characters';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_ISSUER = 'barbearia-api';
process.env.JWT_AUDIENCE = 'barbearia-web';

const { app } = await import('../src/app.js');
const { issueAccessToken } = await import('../src/auth/jwtIssuer.js');
const { hashPassword } = await import('../src/auth/password.js');
const { pool } = await import('../src/config/database.js');
const { grantRole } = await import('../src/repositories/roleRepository.js');

const marker = `C11-${randomUUID().slice(0, 8)}`;
let server;
let base;
let admin;
let client;
let barberUser;
let barberId;
let serviceId;
let otherServiceId;
let planId;
let appointmentId;
let commissionId;

async function addUser(role, suffix) {
  const [result] = await pool.execute(
    'INSERT INTO usuarios(nome,email,telefone,senha_hash,perfil) VALUES(?,?,?,?,?)',
    [
      `${marker} ${suffix}`,
      `${marker}-${suffix}@example.test`,
      `81${String(Date.now() + Math.floor(Math.random() * 9999)).slice(-9)}`,
      await hashPassword('SenhaTeste123'),
      role,
    ],
  );
  await grantRole(result.insertId, role);
  const [[user]] = await pool.execute('SELECT id,auth_versao FROM usuarios WHERE id=?', [
    result.insertId,
  ]);
  return { id: result.insertId, token: issueAccessToken(user) };
}

async function api(path, { method = 'GET', token, body } = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token && { cookie: `barbearia_session=${token}` }),
      ...(token &&
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && {
          origin: 'http://localhost:5173',
          'x-csrf-protection': '1',
        }),
      ...(body !== undefined && { 'content-type': 'application/json' }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

test.before(async () => {
  admin = await addUser('admin', 'admin');
  client = await addUser('cliente', 'cliente');
  barberUser = await addUser('barbeiro', 'barbeiro');
  const [barber] = await pool.execute('INSERT INTO barbeiros(usuario_id) VALUES(?)', [
    barberUser.id,
  ]);
  barberId = barber.insertId;
  const [service] = await pool.execute(
    'INSERT INTO servicos(nome,preco,duracao_minutos) VALUES(?,40.00,30)',
    [`${marker} Serviço`],
  );
  serviceId = service.insertId;
  const [otherService] = await pool.execute(
    'INSERT INTO servicos(nome,preco,duracao_minutos) VALUES(?,60.00,45)',
    [`${marker} Serviço fora`],
  );
  otherServiceId = otherService.insertId;
  const [plan] = await pool.execute(
    `INSERT INTO planos
       (nome,preco,adesao_inicio,adesao_fim,utilizacao_inicio,utilizacao_fim,
        criado_por,atualizado_por)
     VALUES(?,100.00,'2026-08-01','2026-12-31','2026-08-01','2026-12-31',?,?)`,
    [`${marker} Plano`, admin.id, admin.id],
  );
  planId = plan.insertId;
  await pool.execute('INSERT INTO plano_servicos(plano_id,servico_id) VALUES(?,?)', [
    planId,
    serviceId,
  ]);
  const [appointment] = await pool.execute(
    `INSERT INTO agendamentos
       (cliente_id,barbeiro_id,servico_id,criado_por,origem,inicio_em,fim_em,
        fim_ocupacao_em,preco,duracao_minutos,buffer_minutos,status,concluido_em)
     VALUES(?,?,?,?,'admin','2026-08-10 12:00:00','2026-08-10 12:30:00',
       '2026-08-10 12:30:00',40.00,30,0,'concluido','2026-08-10 12:35:00')`,
    [client.id, barberId, serviceId, admin.id],
  );
  appointmentId = appointment.insertId;
  const [commission] = await pool.execute(
    `INSERT INTO comissoes
       (agendamento_id,barbeiro_id,tipo_cobranca,valor_base_snapshot,
        percentual_snapshot,valor_comissao,criado_em)
     VALUES(?,?,'avulso',40.00,50.00,20.00,'2026-08-10 12:35:00')`,
    [appointmentId, barberId],
  );
  commissionId = commission.insertId;
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(async () => {
  try {
    await pool.execute('DELETE FROM comissoes WHERE id=?', [commissionId]);
    await pool.execute('DELETE FROM agendamentos WHERE id=?', [appointmentId]);
    await pool.execute('DELETE FROM configuracoes_comissao_barbeiros WHERE barbeiro_id=?', [
      barberId,
    ]);
    await pool.execute('DELETE FROM plano_servicos WHERE plano_id=?', [planId]);
    await pool.execute('DELETE FROM planos WHERE id=?', [planId]);
    await pool.execute('DELETE FROM barbeiros WHERE id=?', [barberId]);
    await pool.execute('DELETE FROM servicos WHERE id IN (?,?)', [serviceId, otherServiceId]);
    await pool.execute('DELETE FROM usuarios WHERE id IN (?,?,?)', [
      admin.id,
      client.id,
      barberUser.id,
    ]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});

test('admin configura percentuais e valida limites e campos extras', async () => {
  const initial = await api(`/admin/barbeiros/${barberId}`, { token: admin.token });
  const initialData = (await initial.json()).data;
  assert.equal(initialData.percentualComissaoAvulsa, null);
  assert.equal(initialData.percentualComissaoPlano, null);
  const response = await api(`/admin/barbeiros/${barberId}/comissao`, {
    method: 'PUT',
    token: admin.token,
    body: { percentualAvulso: '50.00', percentualPlano: '40.00' },
  });
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.deepEqual(
    [data.barbeiroId, data.percentualAvulso, data.percentualPlano, data.ativo],
    [String(barberId), '50.00', '40.00', true],
  );
  const persisted = await api(`/admin/barbeiros/${barberId}`, { token: admin.token });
  const persistedData = (await persisted.json()).data;
  assert.equal(persistedData.percentualComissaoAvulsa, '50.00');
  assert.equal(persistedData.percentualComissaoPlano, '40.00');
  assert.equal('senha_hash' in persistedData, false);
  const publicResponse = await api(`/barbeiros/${barberId}`);
  const publicData = (await publicResponse.json()).data;
  assert.equal('percentualComissaoAvulsa' in publicData, false);
  assert.equal('percentualComissaoPlano' in publicData, false);
  for (const body of [
    { percentualAvulso: '100.01', percentualPlano: '40.00' },
    { percentualAvulso: '50.00', percentualPlano: '40.00', extra: true },
  ]) {
    const invalid = await api(`/admin/barbeiros/${barberId}/comissao`, {
      method: 'PUT',
      token: admin.token,
      body,
    });
    assert.equal(invalid.status, 422);
  }
});

test('admin configura valor-base apenas para serviço vinculado ao plano', async () => {
  const initial = await api(`/admin/planos/${planId}`, { token: admin.token });
  assert.equal((await initial.json()).data.servicos[0].valorBaseComissao, null);
  const response = await api(`/admin/planos/${planId}/servicos/${serviceId}/comissao`, {
    method: 'PUT',
    token: admin.token,
    body: { valorBase: '30.00' },
  });
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.deepEqual(data, {
    planoId: String(planId),
    servicoId: String(serviceId),
    valorBase: '30.00',
  });
  const persisted = await api(`/admin/planos/${planId}`, { token: admin.token });
  const persistedService = (await persisted.json()).data.servicos.find(
    (item) => String(item.id) === String(serviceId),
  );
  assert.equal(persistedService.valorBaseComissao, '30.00');
  const publicResponse = await api(`/planos/${planId}`);
  const publicService = (await publicResponse.json()).data.servicos[0];
  assert.equal('valorBaseComissao' in publicService, false);
  const missing = await api(`/admin/planos/${planId}/servicos/${otherServiceId}/comissao`, {
    method: 'PUT',
    token: admin.token,
    body: { valorBase: '20.00' },
  });
  assert.equal(missing.status, 404);
});

test('listagem filtra, pagina e mantém valores e IDs como strings', async () => {
  const response = await api(
    `/admin/comissoes?barbeiroId=${barberId}&inicio=2026-08-10&fim=2026-08-10&tipo=avulso&status=pendente`,
    { token: admin.token },
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].id, String(commissionId));
  assert.equal(body.data[0].agendamentoId, String(appointmentId));
  assert.equal(body.data[0].valorComissao, '20.00');
  assert.equal(body.pagination.total, 1);
});

test('pagamento é transacional e idempotente', async () => {
  const first = await api(`/admin/comissoes/${commissionId}/pagar`, {
    method: 'PUT',
    token: admin.token,
    body: {},
  });
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  assert.equal(firstBody.data.comissao.status, 'paga');
  assert.equal(firstBody.data.replay, false);
  const replay = await api(`/admin/comissoes/${commissionId}/pagar`, {
    method: 'PUT',
    token: admin.token,
    body: {},
  });
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).data.replay, true);
});

test('cliente e barbeiro não acessam a API administrativa', async () => {
  for (const token of [client.token, barberUser.token]) {
    const list = await api('/admin/comissoes', { token });
    assert.equal(list.status, 403);
    const pay = await api(`/admin/comissoes/${commissionId}/pagar`, {
      method: 'PUT',
      token,
      body: {},
    });
    assert.equal(pay.status, 403);
  }
});
