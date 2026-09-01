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
const statusService = await import('../src/services/agendamentoStatusService.js');
const { grantRole } = await import('../src/repositories/roleRepository.js');

const marker = `F6-${randomUUID().slice(0, 8)}`;
const phonePrefix = String(BigInt(`0x${marker.slice(3)}`) % 10_000_000n).padStart(7, '0');
let userSequence = 0;
const zone = 'America/Recife';
const date = DateTime.now().setZone(zone).plus({ days: 1 }).toFormat('yyyy-MM-dd');
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
let barberPhone;
let serviceId;
let secondBarberUserId;
let secondBarberToken;
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
  const phone = `81${phonePrefix}${String(++userSequence).padStart(2, '0')}`;
  const [result] = await pool.execute(
    'INSERT INTO usuarios(nome,email,telefone,senha_hash,perfil) VALUES(?,?,?,?,?)',
    [`${marker} ${suffix}`, `${marker}-${suffix}@example.test`, phone, password, profile],
  );
  await grantRole(result.insertId, profile);
  const [[user]] = await pool.execute('SELECT id,auth_versao FROM usuarios WHERE id=?', [
    result.insertId,
  ]);
  return { id: result.insertId, token: issueAccessToken(user), phone };
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
  ({
    id: barberUserId,
    token: barberToken,
    phone: barberPhone,
  } = await addUser('barbeiro', 'barber'));
  ({ id: secondBarberUserId, token: secondBarberToken } = await addUser('barbeiro', 'barber2'));
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
  let cleanupError;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute(
      `DELETE aa FROM agendamentos_arquivados_barbeiro aa INNER JOIN agendamentos a
      ON a.id=aa.agendamento_id WHERE a.barbeiro_id IN (?,?)`,
      [barberId, secondBarberId],
    );
    await connection.execute(
      `DELETE c FROM comissoes c INNER JOIN agendamentos a
      ON a.id=c.agendamento_id WHERE a.barbeiro_id IN (?,?)`,
      [barberId, secondBarberId],
    );
    await connection.execute(
      `DELETE h FROM historico_agendamentos h INNER JOIN agendamentos a
      ON a.id=h.agendamento_id WHERE a.barbeiro_id IN (?,?)`,
      [barberId, secondBarberId],
    );
    await connection.execute('DELETE FROM agendamentos WHERE barbeiro_id IN (?,?)', [
      barberId,
      secondBarberId,
    ]);
    await connection.execute('DELETE FROM horarios_trabalho WHERE barbeiro_id IN (?,?)', [
      barberId,
      secondBarberId,
    ]);
    await connection.execute('DELETE FROM barbeiro_servicos WHERE barbeiro_id IN (?,?)', [
      barberId,
      secondBarberId,
    ]);
    await connection.execute('DELETE FROM barbeiros WHERE id IN (?,?)', [barberId, secondBarberId]);
    await connection.execute('DELETE FROM servicos WHERE id=?', [serviceId]);
    await connection.execute('DELETE FROM usuario_papeis WHERE usuario_id IN (?,?,?,?,?)', [
      adminId,
      clientId,
      otherClientId,
      barberUserId,
      secondBarberUserId,
    ]);
    await connection.execute('DELETE FROM usuarios WHERE id IN (?,?,?,?,?)', [
      adminId,
      clientId,
      otherClientId,
      barberUserId,
      secondBarberUserId,
    ]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    cleanupError = error;
  } finally {
    connection.release();
  }

  try {
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
  } catch (error) {
    cleanupError ??= error;
  } finally {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }

  if (cleanupError) throw cleanupError;
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
  const detailResponse = await api(`/agendamentos/${original.id}`, { token: clientToken });
  const detail = (await detailResponse.json()).data;
  assert.equal(detail.podeCancelar, true);
  assert.equal(detail.podeReagendar, true);
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

  const today = DateTime.now().setZone(zone).toFormat('yyyy-MM-dd');
  const afterTomorrow = DateTime.fromISO(date, { zone }).plus({ days: 1 }).toFormat('yyyy-MM-dd');
  const fiveDaysAhead = DateTime.fromISO(date, { zone }).plus({ days: 4 }).toFormat('yyyy-MM-dd');
  for (const [invalidDate, errorCode] of [
    [today, 'CLIENT_BOOKING_DATE_NOT_ALLOWED'],
    [afterTomorrow, 'BOOKING_DATE_OUT_OF_RANGE'],
    [fiveDaysAhead, 'BOOKING_DATE_OUT_OF_RANGE'],
  ]) {
    response = await api('/agendamentos', {
      method: 'POST',
      token: clientToken,
      key: randomUUID(),
      body: { ...payload, data: invalidDate, horaInicio: '10:00' },
    });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error.code, errorCode);
  }
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
  const listed = mineBody.data.find((item) => item.id === clientAppointmentId);
  assert.equal(listed.barbeiro.telefone, undefined);
  const detail = (
    await (await api(`/agendamentos/${clientAppointmentId}`, { token: clientToken })).json()
  ).data;
  assert.equal(detail.podeCancelar, listed.podeCancelar);
  assert.equal(detail.podeReagendar, listed.podeReagendar);
  assert.equal(detail.barbeiro.telefone, barberPhone);
  const others = await api('/agendamentos/meus', { token: otherClientToken });
  assert.equal((await others.json()).data.length, 0);
  assert.equal(
    (await api(`/agendamentos/${clientAppointmentId}`, { token: otherClientToken })).status,
    403,
  );
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
  const upcomingBarberList = await api('/barbeiro/agendamentos?periodo=inicio', {
    token: barberToken,
  });
  assert.equal(
    (await upcomingBarberList.json()).data.some((item) => item.id === created.id),
    true,
  );
  const otherBarberList = await api(`/barbeiro/agendamentos?data=${date}`, {
    token: secondBarberToken,
  });
  assert.equal(
    (await otherBarberList.json()).data.some((item) => item.id === created.id),
    false,
  );
  const otherUpcomingBarberList = await api('/barbeiro/agendamentos?periodo=inicio', {
    token: secondBarberToken,
  });
  assert.equal(
    (await otherUpcomingBarberList.json()).data.some((item) => item.id === created.id),
    false,
  );
  assert.equal(
    (await api(`/barbeiro/agendamentos/${created.id}`, { token: secondBarberToken })).status,
    403,
  );
  const adminList = await api('/admin/agendamentos?origem=admin', { token: adminToken });
  const adminItem = (await adminList.json()).data.find((item) => item.id === created.id);
  assert.equal(adminItem.origem, 'admin');
  assert.equal(adminItem.cliente.id, String(clientId));
  assert.equal((await api(`/agendamentos/${created.id}`, { token: otherClientToken })).status, 403);
});

test('barbeiro arquiva somente atendimentos encerrados sem alterar dados relacionados', async () => {
  const statuses = [
    'pendente',
    'confirmado',
    'em_atendimento',
    'concluido',
    'cancelado',
    'ausente',
  ];
  const ids = {};
  for (const [index, status] of statuses.entries()) {
    const start = DateTime.fromISO(`${date}T${String(index + 1).padStart(2, '0')}:00:00`, {
      zone,
    })
      .toUTC()
      .toJSDate();
    const end = new Date(start.getTime() + 30 * 60_000);
    const [result] = await pool.execute(
      `INSERT INTO agendamentos
       (cliente_id,barbeiro_id,servico_id,criado_por,origem,inicio_em,fim_em,
        fim_ocupacao_em,preco,duracao_minutos,buffer_minutos,status,concluido_em,
        cancelado_em,cancelado_por)
       VALUES(?,?,?,?,?,?,?,?,40.00,30,0,?,?,?,?)`,
      [
        clientId,
        barberId,
        serviceId,
        adminId,
        'admin',
        start,
        end,
        end,
        status,
        status === 'concluido' ? end : null,
        status === 'cancelado' ? end : null,
        status === 'cancelado' ? adminId : null,
      ],
    );
    ids[status] = String(result.insertId);
  }

  const thirdStart = DateTime.fromISO(`${date}T07:00:00`, { zone }).toUTC().toJSDate();
  const thirdEnd = new Date(thirdStart.getTime() + 30 * 60_000);
  const [third] = await pool.execute(
    `INSERT INTO agendamentos
     (cliente_id,barbeiro_id,servico_id,criado_por,origem,inicio_em,fim_em,
      fim_ocupacao_em,preco,duracao_minutos,buffer_minutos,status,concluido_em)
     VALUES(?,?,?,?,?,?,?,?,40.00,30,0,'concluido',?)`,
    [
      clientId,
      secondBarberId,
      serviceId,
      adminId,
      'admin',
      thirdStart,
      thirdEnd,
      thirdEnd,
      thirdEnd,
    ],
  );
  await pool.execute(
    `INSERT INTO historico_agendamentos
      (agendamento_id,tipo_evento,status_anterior,status_novo,alterado_por)
     VALUES(?,'concluido','em_atendimento','concluido',?)`,
    [ids.concluido, barberUserId],
  );
  await pool.execute(
    `INSERT INTO comissoes
      (agendamento_id,barbeiro_id,tipo_cobranca,valor_base_snapshot,
       percentual_snapshot,valor_comissao)
     VALUES(?,?,'avulso',40.00,50.00,20.00)`,
    [ids.concluido, barberId],
  );

  for (const status of ['pendente', 'confirmado', 'em_atendimento']) {
    const response = await api(`/barbeiro/agendamentos/${ids[status]}/arquivar`, {
      method: 'PUT',
      token: barberToken,
    });
    assert.equal(response.status, 422, status);
    assert.equal((await response.json()).error.code, 'APPOINTMENT_NOT_ARCHIVABLE');
  }
  for (const status of ['concluido', 'cancelado', 'ausente']) {
    assert.equal(
      (
        await api(`/barbeiro/agendamentos/${ids[status]}/arquivar`, {
          method: 'PUT',
          token: barberToken,
        })
      ).status,
      204,
      status,
    );
  }
  assert.equal(
    (
      await api(`/barbeiro/agendamentos/${third.insertId}/arquivar`, {
        method: 'PUT',
        token: barberToken,
      })
    ).status,
    404,
  );

  const main = await (
    await api(`/barbeiro/agendamentos?data=${date}`, { token: barberToken })
  ).json();
  assert.equal(
    main.data.some((item) => item.id === ids.concluido),
    false,
  );
  const archivedResponse = await api(`/barbeiro/agendamentos?data=${date}&arquivados=true`, {
    token: barberToken,
  });
  const archived = await archivedResponse.json();
  assert.deepEqual(archived.data.map((item) => item.status).sort(), [
    'ausente',
    'cancelado',
    'concluido',
  ]);
  const refreshed = await (
    await api(`/barbeiro/agendamentos?data=${date}&arquivados=true`, { token: barberToken })
  ).json();
  assert.deepEqual(
    refreshed.data.map((item) => item.id).sort(),
    archived.data.map((item) => item.id).sort(),
  );
  const detail = await (
    await api(`/barbeiro/agendamentos/${ids.concluido}`, { token: barberToken })
  ).json();
  assert.equal(detail.data.arquivado, true);

  const [[preserved]] = await pool.execute(
    `SELECT a.status,
      (SELECT COUNT(*) FROM historico_agendamentos h WHERE h.agendamento_id=a.id) historico,
      (SELECT COUNT(*) FROM comissoes c WHERE c.agendamento_id=a.id) comissao
     FROM agendamentos a WHERE a.id=?`,
    [ids.concluido],
  );
  assert.deepEqual(
    {
      status: preserved.status,
      historico: Number(preserved.historico),
      comissao: Number(preserved.comissao),
    },
    { status: 'concluido', historico: 1, comissao: 1 },
  );
  const admin = await (await api(`/admin/agendamentos?data=${date}`, { token: adminToken })).json();
  assert.equal(
    admin.data.some((item) => item.id === ids.concluido),
    true,
  );
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
  const cancelledDetail = (
    await (await api(`/agendamentos/${clientAppointmentId}`, { token: clientToken })).json()
  ).data;
  assert.equal(cancelledDetail.podeCancelar, false);
  assert.equal(cancelledDetail.podeReagendar, false);
  response = await api(`/admin/agendamentos/${adminAppointmentId}/cancelar`, {
    method: 'PUT',
    token: adminToken,
    body: { motivo: 'Ajuste operacional', responsabilidade: 'barbearia' },
  });
  assert.equal(response.status, 200);
  const [[history]] = await pool.execute(
    `SELECT COUNT(*) total FROM historico_agendamentos
    WHERE agendamento_id=?`,
    [clientAppointmentId],
  );
  assert.equal(Number(history.total), 3);
});

test('cancelamento e reagendamento de cliente ocultam agendamentos de terceiros', async () => {
  const ownCreation = await api('/agendamentos', {
    method: 'POST',
    token: clientToken,
    key: randomUUID(),
    body: {
      barbeiroId: secondBarberId,
      servicoId: serviceId,
      data: date,
      horaInicio: '09:00',
    },
  });
  assert.equal(ownCreation.status, 201);
  const ownAppointmentId = (await ownCreation.json()).data.id;
  let response = await api(`/agendamentos/${ownAppointmentId}/cancelar`, {
    method: 'PUT',
    token: clientToken,
    body: {},
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.status, 'cancelado');

  const creation = await api('/agendamentos', {
    method: 'POST',
    token: otherClientToken,
    key: randomUUID(),
    body: {
      barbeiroId: secondBarberId,
      servicoId: serviceId,
      data: date,
      horaInicio: '08:00',
    },
  });
  assert.equal(creation.status, 201);
  const thirdPartyAppointmentId = (await creation.json()).data.id;
  const [[before]] = await pool.execute(
    `SELECT status, inicio_em,
      (SELECT COUNT(*) FROM historico_agendamentos WHERE agendamento_id=?) history_count
     FROM agendamentos WHERE id=?`,
    [thirdPartyAppointmentId, thirdPartyAppointmentId],
  );

  response = await api(`/agendamentos/${thirdPartyAppointmentId}/cancelar`, {
    method: 'PUT',
    token: clientToken,
    body: { motivo: 'Tentativa indevida' },
  });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'APPOINTMENT_NOT_FOUND');

  response = await api(`/agendamentos/${thirdPartyAppointmentId}/reagendar`, {
    method: 'PUT',
    token: clientToken,
    body: { data: date, horaInicio: '09:00' },
  });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'APPOINTMENT_NOT_FOUND');

  const nonexistentId = '18446744073709551615';
  response = await api(`/agendamentos/${nonexistentId}/cancelar`, {
    method: 'PUT',
    token: clientToken,
    body: { motivo: 'Agendamento inexistente' },
  });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'APPOINTMENT_NOT_FOUND');

  response = await api(`/agendamentos/${nonexistentId}/reagendar`, {
    method: 'PUT',
    token: clientToken,
    body: { data: date, horaInicio: '09:00' },
  });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'APPOINTMENT_NOT_FOUND');

  const [[after]] = await pool.execute(
    `SELECT status, inicio_em,
      (SELECT COUNT(*) FROM historico_agendamentos WHERE agendamento_id=?) history_count
     FROM agendamentos WHERE id=?`,
    [thirdPartyAppointmentId, thirdPartyAppointmentId],
  );
  assert.equal(after.status, before.status);
  assert.equal(new Date(after.inicio_em).getTime(), new Date(before.inicio_em).getTime());
  assert.equal(Number(after.history_count), Number(before.history_count));

  response = await api(`/agendamentos/${thirdPartyAppointmentId}/cancelar`, {
    method: 'PUT',
    token: otherClientToken,
    body: { motivo: 'Cancelamento pelo proprietário' },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.status, 'cancelado');
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

test('barbeiro inicia antecipadamente somente o próximo atendimento elegível', async () => {
  async function createAt(horaInicio) {
    const response = await api('/agendamentos', {
      method: 'POST',
      token: otherClientToken,
      key: randomUUID(),
      body: { barbeiroId: secondBarberId, servicoId: serviceId, data: date, horaInicio },
    });
    assert.equal(response.status, 201);
    const appointment = (await response.json()).data;
    await pool.execute("UPDATE agendamentos SET status='confirmado' WHERE id=?", [appointment.id]);
    return appointment;
  }

  const previous = await createAt('10:00');
  const next = await createAt('11:00');
  const [[beforeStart]] = await pool.execute('SELECT inicio_em FROM agendamentos WHERE id=?', [
    next.id,
  ]);
  const earlyNow = DateTime.fromISO(`${date}T10:05:00`, { zone }).toUTC().toJSDate();

  await assert.rejects(
    () =>
      statusService.updateStatus({
        id: next.id,
        userId: secondBarberUserId,
        role: 'barbeiro',
        nextStatus: 'em_atendimento',
        nowUtc: earlyNow,
      }),
    { code: 'EARLY_START_BLOCKED' },
  );

  await pool.execute("UPDATE agendamentos SET status='ausente' WHERE id=?", [previous.id]);
  await statusService.updateStatus({
    id: next.id,
    userId: secondBarberUserId,
    role: 'barbeiro',
    nextStatus: 'em_atendimento',
    nowUtc: earlyNow,
  });
  const [[started]] = await pool.execute('SELECT status,inicio_em FROM agendamentos WHERE id=?', [
    next.id,
  ]);
  assert.equal(started.status, 'em_atendimento');
  assert.equal(new Date(started.inicio_em).getTime(), new Date(beforeStart.inicio_em).getTime());

  for (const terminalStatus of ['concluido', 'cancelado']) {
    await pool.execute(
      `UPDATE agendamentos SET status=?,
       concluido_em=IF(?='concluido',?,NULL),
       cancelado_em=IF(?='cancelado',?,NULL),
       cancelado_por=IF(?='cancelado',?,NULL)
       WHERE id=?`,
      [
        terminalStatus,
        terminalStatus,
        earlyNow,
        terminalStatus,
        earlyNow,
        terminalStatus,
        otherClientId,
        previous.id,
      ],
    );
    await pool.execute("UPDATE agendamentos SET status='confirmado' WHERE id=?", [next.id]);
    await statusService.updateStatus({
      id: next.id,
      userId: secondBarberUserId,
      role: 'barbeiro',
      nextStatus: 'em_atendimento',
      nowUtc: earlyNow,
    });
  }

  const later = await createAt('12:00');
  await assert.rejects(
    () =>
      statusService.updateStatus({
        id: later.id,
        userId: secondBarberUserId,
        role: 'barbeiro',
        nextStatus: 'em_atendimento',
        nowUtc: earlyNow,
      }),
    { code: 'EARLY_START_BLOCKED' },
  );
  await assert.rejects(
    () =>
      statusService.updateStatus({
        id: later.id,
        userId: barberUserId,
        role: 'barbeiro',
        nextStatus: 'em_atendimento',
        nowUtc: earlyNow,
      }),
    { code: 'APPOINTMENT_FORBIDDEN' },
  );

  const [[commissionBefore]] = await pool.execute(
    'SELECT COUNT(*) total FROM comissoes WHERE agendamento_id=?',
    [next.id],
  );
  assert.equal(Number(commissionBefore.total), 0);
});
