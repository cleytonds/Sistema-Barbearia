import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { DateTime } from 'luxon';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'guest-create-test-secret-with-at-least-32-characters';
process.env.JWT_ISSUER = 'barbearia-api';
process.env.JWT_AUDIENCE = 'barbearia-web';

const { app } = await import('../src/app.js');
const { issueAccessToken } = await import('../src/auth/jwtIssuer.js');
const { hashPassword } = await import('../src/auth/password.js');
const { pool } = await import('../src/config/database.js');
const { grantRole } = await import('../src/repositories/roleRepository.js');

const marker = `guest-create-${randomUUID().slice(0, 8)}`;
const zone = 'America/Recife';
const date = DateTime.now().setZone(zone).plus({ days: 3 }).toFormat('yyyy-MM-dd');
const day = DateTime.fromISO(date, { zone }).weekday % 7;
let sequence = 0;
let base;
let server;
let admin;
let client;
let cadu;
let jonatas;
let caduId;
let jonatasId;
let serviceId;
let unlinkedServiceId;
let originalHours;
let originalSettings;

async function user(profile, name) {
  const password = await hashPassword('SenhaTeste123');
  const [result] = await pool.execute(
    'INSERT INTO usuarios(nome,email,telefone,senha_hash,perfil) VALUES(?,?,?,?,?)',
    [
      `${marker} ${name}`,
      `${marker}-${++sequence}@example.test`,
      `819${String(sequence).padStart(8, '0')}`,
      password,
      profile,
    ],
  );
  await grantRole(result.insertId, profile);
  const [[row]] = await pool.execute('SELECT id,auth_versao FROM usuarios WHERE id=?', [
    result.insertId,
  ]);
  return { id: result.insertId, token: issueAccessToken(row) };
}

async function api(path, { token, body, method = 'POST', key = randomUUID() }) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      cookie: `barbearia_session=${token}`,
      origin: 'http://localhost:5173',
      'x-csrf-protection': '1',
      'Idempotency-Key': key,
      ...(body && { 'content-type': 'application/json' }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
}

function payload(overrides = {}) {
  return {
    clienteNome: `${marker} visitante`,
    servicoId: serviceId,
    data: date,
    horaInicio: '10:00',
    ...overrides,
  };
}

test.before(async () => {
  [[originalHours]] = await pool.execute(
    'SELECT * FROM horarios_funcionamento WHERE dia_semana=?',
    [day],
  );
  [[originalSettings]] = await pool.execute('SELECT * FROM configuracoes WHERE id=1');
  admin = await user('admin', 'admin');
  client = await user('cliente', 'client');
  cadu = await user('barbeiro', 'cadu');
  jonatas = await user('barbeiro', 'jonatas');
  [{ insertId: caduId }] = await pool.execute('INSERT INTO barbeiros(usuario_id) VALUES(?)', [
    cadu.id,
  ]);
  [{ insertId: jonatasId }] = await pool.execute('INSERT INTO barbeiros(usuario_id) VALUES(?)', [
    jonatas.id,
  ]);
  [{ insertId: serviceId }] = await pool.execute(
    'INSERT INTO servicos(nome,preco,duracao_minutos) VALUES(?,40,30)',
    [`${marker} service`],
  );
  [{ insertId: unlinkedServiceId }] = await pool.execute(
    'INSERT INTO servicos(nome,preco,duracao_minutos) VALUES(?,40,30)',
    [`${marker} unlinked service`],
  );
  for (const barberId of [caduId, jonatasId]) {
    await pool.execute('INSERT INTO barbeiro_servicos(barbeiro_id,servico_id) VALUES(?,?)', [
      barberId,
      serviceId,
    ]);
    await pool.execute(
      "INSERT INTO horarios_trabalho(barbeiro_id,dia_semana,hora_inicio,hora_fim,ativo) VALUES(?,?,'08:00','20:00',TRUE)",
      [barberId, day],
    );
  }
  await pool.execute(
    "UPDATE horarios_funcionamento SET hora_inicio='08:00',hora_fim='20:00',intervalo_inicio=NULL,intervalo_fim=NULL,ativo=TRUE WHERE dia_semana=?",
    [day],
  );
  await pool.execute(
    'UPDATE configuracoes SET fuso_horario=?,intervalo_entre_atendimentos_minutos=0 WHERE id=1',
    [zone],
  );
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(async () => {
  const ids = [caduId, jonatasId];
  await pool.execute(
    `DELETE h FROM historico_agendamentos h JOIN agendamentos a ON a.id=h.agendamento_id WHERE a.barbeiro_id IN (?,?)`,
    ids,
  );
  await pool.execute('DELETE FROM agendamentos WHERE barbeiro_id IN (?,?)', ids);
  await pool.execute('DELETE FROM horarios_trabalho WHERE barbeiro_id IN (?,?)', ids);
  await pool.execute('DELETE FROM barbeiro_servicos WHERE barbeiro_id IN (?,?)', ids);
  await pool.execute('DELETE FROM barbeiros WHERE id IN (?,?)', ids);
  await pool.execute('DELETE FROM servicos WHERE id=?', [serviceId]);
  await pool.execute('DELETE FROM servicos WHERE id=?', [unlinkedServiceId]);
  await pool.execute('DELETE FROM usuario_papeis WHERE usuario_id IN (?,?,?,?)', [
    admin.id,
    client.id,
    cadu.id,
    jonatas.id,
  ]);
  await pool.execute('DELETE FROM usuarios WHERE id IN (?,?,?,?)', [
    admin.id,
    client.id,
    cadu.id,
    jonatas.id,
  ]);
  await pool.execute(
    'UPDATE horarios_funcionamento SET hora_inicio=?,hora_fim=?,intervalo_inicio=?,intervalo_fim=?,ativo=? WHERE dia_semana=?',
    [
      originalHours.hora_inicio,
      originalHours.hora_fim,
      originalHours.intervalo_inicio,
      originalHours.intervalo_fim,
      originalHours.ativo,
      day,
    ],
  );
  await pool.execute(
    'UPDATE configuracoes SET fuso_horario=?,intervalo_entre_atendimentos_minutos=? WHERE id=1',
    [originalSettings.fuso_horario, originalSettings.intervalo_entre_atendimentos_minutos],
  );
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('admin cria visitante para profissionais distintos; dados são avulsos e sem plano', async () => {
  const first = await api('/admin/agendamentos/sem-cadastro', {
    token: admin.token,
    body: payload({ barbeiroId: caduId, clienteTelefone: null }),
  });
  assert.equal(first.status, 201);
  const created = (await first.json()).data;
  assert.equal(created.tipoCobranca, 'avulso');
  const [[row]] = await pool.execute(
    'SELECT cliente_id,cliente_nome_snapshot,cliente_telefone_snapshot,tipo_cobranca,origem,criado_por,status FROM agendamentos WHERE id=?',
    [created.id],
  );
  assert.equal(row.cliente_id, null);
  assert.equal(row.cliente_nome_snapshot, `${marker} visitante`);
  assert.equal(row.cliente_telefone_snapshot, null);
  assert.equal(row.tipo_cobranca, 'avulso');
  assert.equal(row.origem, 'admin');
  assert.equal(String(row.criado_por), String(admin.id));
  assert.equal(row.status, 'pendente');
  const [[history]] = await pool.execute(
    'SELECT tipo_evento,status_anterior,status_novo FROM historico_agendamentos WHERE agendamento_id=?',
    [created.id],
  );
  assert.deepEqual(history, {
    tipo_evento: 'criado',
    status_anterior: null,
    status_novo: 'pendente',
  });
  const second = await api('/admin/agendamentos/sem-cadastro', {
    token: admin.token,
    body: payload({ barbeiroId: jonatasId, horaInicio: '11:00' }),
  });
  assert.equal(second.status, 201);
});

test('barbeiro deriva o próprio id, rejeita outro barbeiro e cliente é bloqueado', async () => {
  const caduCreate = await api('/barbeiro/agendamentos/sem-cadastro', {
    token: cadu.token,
    body: payload({ horaInicio: '12:00' }),
  });
  assert.equal(caduCreate.status, 201);
  const caduCreated = (await caduCreate.json()).data;
  const [[caduRow]] = await pool.execute(
    'SELECT barbeiro_id,origem,status FROM agendamentos WHERE id=?',
    [caduCreated.id],
  );
  assert.equal(String(caduRow.barbeiro_id), String(caduId));
  assert.equal(caduRow.origem, 'barbeiro');
  assert.equal(caduRow.status, 'pendente');
  const [[caduHistory]] = await pool.execute(
    'SELECT tipo_evento,status_anterior,status_novo FROM historico_agendamentos WHERE agendamento_id=?',
    [caduCreated.id],
  );
  assert.deepEqual(caduHistory, {
    tipo_evento: 'criado',
    status_anterior: null,
    status_novo: 'pendente',
  });
  const jonatasCreate = await api('/barbeiro/agendamentos/sem-cadastro', {
    token: jonatas.token,
    body: payload({ horaInicio: '12:30' }),
  });
  assert.equal(jonatasCreate.status, 201);
  const [[jonatasRow]] = await pool.execute('SELECT barbeiro_id FROM agendamentos WHERE id=?', [
    (await jonatasCreate.json()).data.id,
  ]);
  assert.equal(String(jonatasRow.barbeiro_id), String(jonatasId));
  const registered = await api('/barbeiro/agendamentos', {
    token: cadu.token,
    body: { clienteId: client.id, servicoId: serviceId, data: date, horaInicio: '14:00' },
  });
  assert.equal(registered.status, 201);
  const registeredCreated = (await registered.json()).data;
  const [[registeredRow]] = await pool.execute(
    'SELECT cliente_id,barbeiro_id,tipo_cobranca,status FROM agendamentos WHERE id=?',
    [registeredCreated.id],
  );
  assert.equal(String(registeredRow.cliente_id), String(client.id));
  assert.equal(String(registeredRow.barbeiro_id), String(caduId));
  assert.equal(registeredRow.tipo_cobranca, 'avulso');
  assert.equal(registeredRow.status, 'pendente');
  const [[registeredHistory]] = await pool.execute(
    'SELECT tipo_evento,status_anterior,status_novo FROM historico_agendamentos WHERE agendamento_id=?',
    [registeredCreated.id],
  );
  assert.deepEqual(registeredHistory, {
    tipo_evento: 'criado',
    status_anterior: null,
    status_novo: 'pendente',
  });
  const forged = await api('/barbeiro/agendamentos/sem-cadastro', {
    token: cadu.token,
    body: payload({ horaInicio: '13:00', barbeiroId: jonatasId }),
  });
  assert.equal(forged.status, 422);
  const forgedJonatas = await api('/barbeiro/agendamentos/sem-cadastro', {
    token: jonatas.token,
    body: payload({ horaInicio: '13:00', barbeiroId: caduId }),
  });
  assert.equal(forgedJonatas.status, 422);
  const emptyName = await api('/admin/agendamentos/sem-cadastro', {
    token: admin.token,
    body: payload({ barbeiroId: caduId, horaInicio: '13:30', clienteNome: '   ' }),
  });
  assert.equal(emptyName.status, 422);
  const unlinked = await api('/admin/agendamentos/sem-cadastro', {
    token: admin.token,
    body: payload({ barbeiroId: caduId, horaInicio: '13:30', servicoId: unlinkedServiceId }),
  });
  assert.equal(unlinked.status, 422);
  const forbidden = await api('/admin/agendamentos/sem-cadastro', {
    token: client.token,
    body: payload({ barbeiroId: caduId, horaInicio: '14:00' }),
  });
  assert.equal(forbidden.status, 403);
  const forbiddenRegistered = await api('/barbeiro/agendamentos', {
    token: client.token,
    body: { clienteId: client.id, servicoId: serviceId, data: date, horaInicio: '14:30' },
  });
  assert.equal(forbiddenRegistered.status, 403);
});

test('indisponibilidade conflita e cancelamento administrativo libera imediatamente', async () => {
  const created = await api('/admin/agendamentos/sem-cadastro', {
    token: admin.token,
    body: payload({ barbeiroId: jonatasId, horaInicio: '15:00' }),
  });
  const id = (await created.json()).data.id;
  const [[pending]] = await pool.execute('SELECT status FROM agendamentos WHERE id=?', [id]);
  assert.equal(pending.status, 'pendente');
  const conflict = await api('/admin/agendamentos/sem-cadastro', {
    token: admin.token,
    body: payload({ barbeiroId: jonatasId, horaInicio: '15:00' }),
  });
  assert.equal(conflict.status, 409);
  const cancel = await api(`/admin/agendamentos/${id}/cancelar`, {
    token: admin.token,
    method: 'PUT',
    body: { motivo: 'Cancelamento de teste', responsabilidade: 'barbearia' },
  });
  assert.equal(cancel.status, 200);
  const replacement = await api('/admin/agendamentos/sem-cadastro', {
    token: admin.token,
    body: payload({ barbeiroId: jonatasId, horaInicio: '15:00' }),
  });
  assert.equal(replacement.status, 201);
});
