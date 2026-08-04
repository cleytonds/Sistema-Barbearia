import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { DateTime } from 'luxon';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'phase6-test-secret-with-at-least-32-characters-123';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_ISSUER = 'barbearia-api';
process.env.JWT_AUDIENCE = 'barbearia-web';

const { app } = await import('../src/app.js');
const { issueAccessToken } = await import('../src/auth/jwtIssuer.js');
const { hashPassword } = await import('../src/auth/password.js');
const { pool } = await import('../src/config/database.js');
const appointmentService = await import('../src/services/agendamentoService.js');

const marker = `F6-${randomUUID().slice(0, 8)}`;
const zone = 'America/Recife';
const date = DateTime.now().setZone(zone).plus({ days: 7 }).toFormat('yyyy-MM-dd');
const day = DateTime.fromISO(date, { zone }).weekday % 7;
let server;
let base;
let originalSettings;
let originalHours;
let adminId;
let clientId;
let otherClientId;
let barberUserId;
let barberId;
let serviceId;
let secondBarberUserId;
let secondBarberId;
let clientAppointmentId;
let adminAppointmentId;
let adminToken;
let clientToken;
let otherClientToken;
let barberToken;

async function api(path, { method = 'GET', token, body, key } = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token && { authorization: `Bearer ${token}` }),
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
  const [[user]] = await pool.execute('SELECT id,auth_versao FROM usuarios WHERE id=?', [
    result.insertId,
  ]);
  return { id: result.insertId, token: issueAccessToken(user) };
}

test.before(async () => {
  [[originalSettings]] = await pool.execute('SELECT * FROM configuracoes WHERE id=1');
  [[originalHours]] = await pool.execute(
    'SELECT * FROM horarios_funcionamento WHERE dia_semana=?',
    [day],
  );
  ({ id: adminId, token: adminToken } = await addUser('admin', 'admin'));
  ({ id: clientId, token: clientToken } = await addUser('cliente', 'client'));
  ({ id: otherClientId, token: otherClientToken } = await addUser('cliente', 'client2'));
  ({ id: barberUserId, token: barberToken } = await addUser('barbeiro', 'barber'));
  ({ id: secondBarberUserId } = await addUser('barbeiro', 'barber2'));
  const [barberResult] = await pool.execute('INSERT INTO barbeiros(usuario_id) VALUES(?)', [
    barberUserId,
  ]);
  barberId = barberResult.insertId;
  const [secondBarberResult] = await pool.execute('INSERT INTO barbeiros(usuario_id) VALUES(?)', [
    secondBarberUserId,
  ]);
  secondBarberId = secondBarberResult.insertId;
  const [serviceResult] = await pool.execute(
    'INSERT INTO servicos(nome,preco,duracao_minutos) VALUES(?,40.00,30)',
    [`${marker} Serviço`],
  );
  serviceId = serviceResult.insertId;
  await pool.execute('INSERT INTO barbeiro_servicos(barbeiro_id,servico_id) VALUES(?,?)', [
    barberId,
    serviceId,
  ]);
  await pool.execute('INSERT INTO barbeiro_servicos(barbeiro_id,servico_id) VALUES(?,?)', [
    secondBarberId,
    serviceId,
  ]);
  await pool.execute(
    `INSERT INTO horarios_trabalho
    (barbeiro_id,dia_semana,hora_inicio,hora_fim,intervalo_inicio,intervalo_fim,ativo)
    VALUES(?,?,'08:00','18:00',NULL,NULL,TRUE)`,
    [barberId, day],
  );
  await pool.execute(
    `INSERT INTO horarios_trabalho
    (barbeiro_id,dia_semana,hora_inicio,hora_fim,intervalo_inicio,intervalo_fim,ativo)
    VALUES(?,?,'08:00','18:00',NULL,NULL,TRUE)`,
    [secondBarberId, day],
  );
  await pool.execute(
    `UPDATE horarios_funcionamento SET hora_inicio='08:00',hora_fim='18:00',
    intervalo_inicio=NULL,intervalo_fim=NULL,ativo=TRUE WHERE dia_semana=?`,
    [day],
  );
  await pool.execute(
    `UPDATE configuracoes SET fuso_horario=?, antecedencia_maxima_dias=30,
    intervalo_entre_atendimentos_minutos=10,tempo_minimo_cancelamento_horas=2 WHERE id=1`,
    [zone],
  );
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(async () => {
  await pool.execute(
    `DELETE h FROM historico_agendamentos h INNER JOIN agendamentos a
    ON a.id=h.agendamento_id WHERE a.barbeiro_id IN (?,?)`,
    [barberId, secondBarberId],
  );
  await pool.execute('DELETE FROM agendamentos WHERE barbeiro_id=?', [barberId]);
  await pool.execute('DELETE FROM agendamentos WHERE barbeiro_id=?', [secondBarberId]);
  await pool.execute('DELETE FROM horarios_trabalho WHERE barbeiro_id IN (?,?)', [
    barberId,
    secondBarberId,
  ]);
  await pool.execute('DELETE FROM barbeiro_servicos WHERE barbeiro_id IN (?,?)', [
    barberId,
    secondBarberId,
  ]);
  await pool.execute('DELETE FROM barbeiros WHERE id IN (?,?)', [barberId, secondBarberId]);
  await pool.execute('DELETE FROM servicos WHERE id=?', [serviceId]);
  await pool.execute('DELETE FROM usuarios WHERE id IN (?,?,?,?,?)', [
    adminId,
    clientId,
    otherClientId,
    barberUserId,
    secondBarberUserId,
  ]);
  await pool.execute(
    `UPDATE configuracoes SET nome_barbearia=?,telefone=?,endereco=?,fuso_horario=?,
    tempo_minimo_cancelamento_horas=?,antecedencia_maxima_dias=?,intervalo_entre_atendimentos_minutos=? WHERE id=1`,
    [
      originalSettings.nome_barbearia,
      originalSettings.telefone,
      originalSettings.endereco,
      originalSettings.fuso_horario,
      originalSettings.tempo_minimo_cancelamento_horas,
      originalSettings.antecedencia_maxima_dias,
      originalSettings.intervalo_entre_atendimentos_minutos,
    ],
  );
  await pool.execute(
    `UPDATE horarios_funcionamento SET hora_inicio=?,hora_fim=?,intervalo_inicio=?,
    intervalo_fim=?,ativo=? WHERE dia_semana=?`,
    [
      originalHours.hora_inicio,
      originalHours.hora_fim,
      originalHours.intervalo_inicio,
      originalHours.intervalo_fim,
      originalHours.ativo,
      day,
    ],
  );
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('criação cliente é idempotente, preserva snapshots e histórico', async () => {
  const key = randomUUID();
  const payload = {
    barbeiroId: String(barberId),
    servicoId: String(serviceId),
    data: date,
    horaInicio: '09:00',
    observacoes: 'Teste',
  };
  let response = await api('/agendamentos', {
    method: 'POST',
    token: clientToken,
    body: payload,
    key,
  });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('idempotent-replayed'), 'false');
  const original = (await response.json()).data;
  clientAppointmentId = original.id;
  response = await api('/agendamentos', { method: 'POST', token: clientToken, body: payload, key });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('idempotent-replayed'), 'true');
  assert.equal((await response.json()).data.id, original.id);
  response = await api('/agendamentos', {
    method: 'POST',
    token: clientToken,
    body: { ...payload, horaInicio: '10:00' },
    key,
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'IDEMPOTENCY_KEY_CONFLICT');
  const [[stored]] = await pool.execute('SELECT * FROM agendamentos WHERE id=?', [original.id]);
  assert.equal(stored.duracao_minutos, 30);
  assert.equal(stored.buffer_minutos, 10);
  assert.equal(new Date(stored.fim_ocupacao_em) - new Date(stored.fim_em), 600000);
  const [[history]] = await pool.execute(
    'SELECT COUNT(*) total FROM historico_agendamentos WHERE agendamento_id=?',
    [original.id],
  );
  assert.equal(Number(history.total), 1);
});

test('mass assignment é rejeitado e listagens respeitam propriedade', async () => {
  const response = await api('/agendamentos', {
    method: 'POST',
    token: clientToken,
    key: randomUUID(),
    body: {
      barbeiroId: barberId,
      servicoId: serviceId,
      data: date,
      horaInicio: '10:00',
      preco: '0.01',
    },
  });
  assert.equal(response.status, 422);
  const mine = await api('/agendamentos/meus', { token: clientToken });
  assert.equal(mine.status, 200);
  const mineBody = await mine.json();
  assert.ok(mineBody.data.length >= 1);
  assert.equal(typeof mineBody.data[0].podeCancelar, 'boolean');
  const others = await api('/agendamentos/meus', { token: otherClientToken });
  assert.equal((await others.json()).data.length, 0);
});

test('admin cria confirmado e barbeiro acessa somente o próprio agendamento', async () => {
  const response = await api('/admin/agendamentos', {
    method: 'POST',
    token: adminToken,
    key: randomUUID(),
    body: {
      clienteId: clientId,
      barbeiroId: barberId,
      servicoId: serviceId,
      data: date,
      horaInicio: '11:00',
      observacoesInternas: 'Balcão',
    },
  });
  assert.equal(response.status, 201);
  const created = (await response.json()).data;
  adminAppointmentId = created.id;
  assert.equal(created.status, 'confirmado');
  assert.equal(
    (await api(`/barbeiro/agendamentos/${created.id}`, { token: barberToken })).status,
    200,
  );
  const barberList = await api(`/barbeiro/agendamentos?data=${date}`, { token: barberToken });
  assert.equal((await barberList.json()).data[0].cliente.nome.startsWith(marker), true);
  const adminList = await api('/admin/agendamentos?origem=admin', { token: adminToken });
  const adminItem = (await adminList.json()).data.find((item) => item.id === created.id);
  assert.equal(adminItem.origem, 'admin');
  assert.equal(adminItem.cliente.id, String(clientId));
  assert.equal((await api(`/agendamentos/${created.id}`, { token: otherClientToken })).status, 403);
});

test('mesma chave com payloads e barbeiros diferentes mantém somente o vencedor', async () => {
  const key = randomUUID();
  const common = { servicoId: serviceId, data: date, horaInicio: '16:00' };
  const responses = await Promise.all([
    api('/agendamentos', {
      method: 'POST',
      token: clientToken,
      key,
      body: { ...common, barbeiroId: barberId },
    }),
    api('/agendamentos', {
      method: 'POST',
      token: clientToken,
      key,
      body: { ...common, barbeiroId: secondBarberId },
    }),
  ]);
  assert.deepEqual(responses.map((item) => item.status).sort(), [201, 409]);
  const failed = responses.find((item) => item.status === 409);
  assert.equal((await failed.json()).error.code, 'IDEMPOTENCY_KEY_CONFLICT');
  const [[count]] = await pool.execute(
    `SELECT COUNT(*) total FROM agendamentos
    WHERE criado_por=? AND inicio_em=?`,
    [clientId, DateTime.fromISO(`${date}T16:00:00`, { zone }).toUTC().toJSDate()],
  );
  assert.equal(Number(count.total), 1);
});

test('status, cancelamento e histórico respeitam o fluxo autorizado', async () => {
  let response = await api(`/barbeiro/agendamentos/${clientAppointmentId}/status`, {
    method: 'PUT',
    token: barberToken,
    body: { status: 'confirmado' },
  });
  assert.equal(response.status, 200);
  response = await api(`/agendamentos/${clientAppointmentId}/cancelar`, {
    method: 'PUT',
    token: clientToken,
    body: { motivo: 'Mudança de planos' },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.status, 'cancelado');
  response = await api(`/admin/agendamentos/${adminAppointmentId}/cancelar`, {
    method: 'PUT',
    token: adminToken,
    body: { motivo: 'Ajuste operacional' },
  });
  assert.equal(response.status, 200);
  const [[history]] = await pool.execute(
    `SELECT COUNT(*) total FROM historico_agendamentos
    WHERE agendamento_id=?`,
    [clientAppointmentId],
  );
  assert.equal(Number(history.total), 3);
});

test('reagendamento usa snapshots antigos após serviço e configuração mudarem', async () => {
  let response = await api('/agendamentos', {
    method: 'POST',
    token: clientToken,
    key: randomUUID(),
    body: { barbeiroId: barberId, servicoId: serviceId, data: date, horaInicio: '12:00' },
  });
  assert.equal(response.status, 201);
  const appointmentId = (await response.json()).data.id;
  await pool.execute('UPDATE servicos SET preco=99.00,duracao_minutos=60 WHERE id=?', [serviceId]);
  await pool.execute('UPDATE configuracoes SET intervalo_entre_atendimentos_minutos=25 WHERE id=1');
  try {
    response = await api(`/agendamentos/${appointmentId}/reagendar`, {
      method: 'PUT',
      token: clientToken,
      body: { data: date, horaInicio: '13:00' },
    });
    assert.equal(response.status, 200);
    const [[stored]] = await pool.execute(
      `SELECT preco,duracao_minutos,buffer_minutos,
      TIMESTAMPDIFF(MINUTE,inicio_em,fim_em) service_minutes,
      TIMESTAMPDIFF(MINUTE,fim_em,fim_ocupacao_em) buffer_minutes
      FROM agendamentos WHERE id=?`,
      [appointmentId],
    );
    assert.equal(Number(stored.preco), 40);
    assert.equal(stored.duracao_minutos, 30);
    assert.equal(stored.buffer_minutos, 10);
    assert.equal(stored.service_minutes, 30);
    assert.equal(stored.buffer_minutes, 10);
  } finally {
    await pool.execute('UPDATE servicos SET preco=40.00,duracao_minutos=30 WHERE id=?', [
      serviceId,
    ]);
    await pool.execute(
      'UPDATE configuracoes SET intervalo_entre_atendimentos_minutos=10 WHERE id=1',
    );
  }
});

test('dupla reserva real produz exatamente um 201, um 409 e um histórico', async () => {
  const body = { barbeiroId: barberId, servicoId: serviceId, data: date, horaInicio: '15:00' };
  const responses = await Promise.all([
    api('/agendamentos', { method: 'POST', token: clientToken, body, key: randomUUID() }),
    api('/agendamentos', { method: 'POST', token: otherClientToken, body, key: randomUUID() }),
  ]);
  assert.deepEqual(responses.map((item) => item.status).sort(), [201, 409]);
  const loser = responses.find((item) => item.status === 409);
  assert.equal((await loser.json()).error.code, 'AVAILABILITY_CHANGED');
  const startUtc = DateTime.fromISO(`${date}T15:00:00`, { zone }).toUTC().toJSDate();
  const [[appointments]] = await pool.execute(
    'SELECT COUNT(*) total FROM agendamentos WHERE barbeiro_id=? AND inicio_em=?',
    [barberId, startUtc],
  );
  const [[histories]] = await pool.execute(
    `SELECT COUNT(*) total FROM historico_agendamentos h
    INNER JOIN agendamentos a ON a.id=h.agendamento_id WHERE a.barbeiro_id=? AND a.inicio_em=?`,
    [barberId, startUtc],
  );
  assert.equal(Number(appointments.total), 1);
  assert.equal(Number(histories.total), 1);
});

test('entidades inativas são rejeitadas sem criar dados parciais', async () => {
  await pool.execute('UPDATE servicos SET ativo=FALSE WHERE id=?', [serviceId]);
  try {
    const response = await api('/admin/agendamentos', {
      method: 'POST',
      token: adminToken,
      key: randomUUID(),
      body: {
        clienteId: clientId,
        barbeiroId: barberId,
        servicoId: serviceId,
        data: date,
        horaInicio: '17:00',
      },
    });
    assert.equal(response.status, 404);
  } finally {
    await pool.execute('UPDATE servicos SET ativo=TRUE WHERE id=?', [serviceId]);
  }
  const before = await pool.execute('SELECT COUNT(*) total FROM agendamentos WHERE barbeiro_id=?', [
    barberId,
  ]);
  await assert.rejects(() =>
    appointmentService.createAdmin({
      userId: '999999999999',
      payload: {
        clienteId: clientId,
        barbeiroId: barberId,
        servicoId: serviceId,
        data: date,
        horaInicio: '17:00',
      },
      key: randomUUID(),
    }),
  );
  const [[after]] = await pool.execute(
    'SELECT COUNT(*) total FROM agendamentos WHERE barbeiro_id=?',
    [barberId],
  );
  assert.equal(Number(after.total), Number(before[0][0].total));
});

test('conflito de reagendamento mantém o horário anterior e status futuro é rejeitado', async () => {
  let response = await api('/agendamentos', {
    method: 'POST',
    token: otherClientToken,
    key: randomUUID(),
    body: { barbeiroId: barberId, servicoId: serviceId, data: date, horaInicio: '14:00' },
  });
  assert.equal(response.status, 201);
  const appointmentId = (await response.json()).data.id;
  response = await api(`/agendamentos/${appointmentId}/reagendar`, {
    method: 'PUT',
    token: otherClientToken,
    body: { data: date, horaInicio: '15:00' },
  });
  assert.equal(response.status, 409);
  const [[stored]] = await pool.execute('SELECT inicio_em FROM agendamentos WHERE id=?', [
    appointmentId,
  ]);
  assert.equal(
    DateTime.fromJSDate(new Date(stored.inicio_em), { zone: 'utc' })
      .setZone(zone)
      .toFormat('HH:mm'),
    '14:00',
  );
  response = await api(`/barbeiro/agendamentos/${appointmentId}/status`, {
    method: 'PUT',
    token: barberToken,
    body: { status: 'em_atendimento' },
  });
  assert.equal(response.status, 422);
});
