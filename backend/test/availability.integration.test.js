import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { DateTime } from 'luxon';

process.env.NODE_ENV = 'test';

const { app } = await import('../src/app.js');
const { pool } = await import('../src/config/database.js');
const { beginTransactionContext, closeTransactionContext } =
  await import('../src/database/transactionContext.js');
const { AVAILABILITY_MODE } = await import('../src/domain/availability/validationMode.js');
const availabilityRepository = await import('../src/repositories/disponibilidadeRepository.js');
const { validateAvailability } = await import('../src/services/disponibilidadeService.js');
const { hashPassword } = await import('../src/auth/password.js');

const key = randomUUID().replaceAll('-', '').slice(0, 12);
const marker = `F5-${key}`;
const timeZone = 'America/Recife';
const localDate = DateTime.now().setZone(timeZone).plus({ days: 5 }).toFormat('yyyy-MM-dd');
const dayOfWeek = DateTime.fromISO(localDate, { zone: timeZone }).weekday % 7;
let server;
let baseUrl;
let originalSettings;
let originalBusinessHours;
let barberUserId;
let clientId;
let barberId;
let serviceId;

function localToUtc(time) {
  return DateTime.fromISO(`${localDate}T${time}:00`, { zone: timeZone }).toUTC().toJSDate();
}

async function request(query = {}) {
  const url = new URL(`${baseUrl}/api/disponibilidade`);
  for (const [field, value] of Object.entries(query)) url.searchParams.set(field, value);
  return fetch(url);
}

async function validRequest(overrides = {}) {
  return request({ barbeiroId: barberId, servicoId: serviceId, data: localDate, ...overrides });
}

async function insertAppointment(status, start = '11:00', end = '11:30') {
  const completedAt = status === 'concluido' ? localToUtc(end) : null;
  const canceledAt = status === 'cancelado' ? localToUtc(end) : null;
  const canceledBy = status === 'cancelado' ? clientId : null;
  const [result] = await pool.execute(
    `
      INSERT INTO agendamentos (
        cliente_id, barbeiro_id, servico_id, criado_por, origem,
        inicio_em, fim_em, preco, duracao_minutos, status,
        concluido_em, cancelado_em, cancelado_por
      ) VALUES (?, ?, ?, ?, 'admin', ?, ?, 40.00, 30, ?, ?, ?, ?)
    `,
    [
      clientId,
      barberId,
      serviceId,
      clientId,
      localToUtc(start),
      localToUtc(end),
      status,
      completedAt,
      canceledAt,
      canceledBy,
    ],
  );
  return result.insertId;
}

async function deleteAppointment(appointmentId) {
  await pool.execute('DELETE FROM agendamentos WHERE id = ?', [appointmentId]);
}

test.before(async () => {
  [[originalSettings]] = await pool.query('SELECT * FROM configuracoes WHERE id = 1');
  [[originalBusinessHours]] = await pool.execute(
    'SELECT * FROM horarios_funcionamento WHERE dia_semana = ?',
    [dayOfWeek],
  );

  const passwordHash = await hashPassword('SenhaForte123');
  const [barberUser] = await pool.execute(
    `
      INSERT INTO usuarios (nome, email, telefone, senha_hash, perfil)
      VALUES (?, ?, ?, ?, 'barbeiro')
    `,
    [
      `${marker} Barbeiro`,
      `${key}-barber@example.test`,
      `819${Date.now().toString().slice(-8)}`,
      passwordHash,
    ],
  );
  barberUserId = barberUser.insertId;
  const [client] = await pool.execute(
    `
      INSERT INTO usuarios (nome, email, telefone, senha_hash, perfil)
      VALUES (?, ?, ?, ?, 'cliente')
    `,
    [
      `${marker} Cliente`,
      `${key}-client@example.test`,
      `818${Date.now().toString().slice(-8)}`,
      passwordHash,
    ],
  );
  clientId = client.insertId;
  const [barber] = await pool.execute('INSERT INTO barbeiros (usuario_id) VALUES (?)', [
    barberUserId,
  ]);
  barberId = barber.insertId;
  const [service] = await pool.execute(
    `
      INSERT INTO servicos (nome, preco, duracao_minutos)
      VALUES (?, 40.00, 30)
    `,
    [`${marker} Serviço`],
  );
  serviceId = service.insertId;
  await pool.execute('INSERT INTO barbeiro_servicos (barbeiro_id, servico_id) VALUES (?, ?)', [
    barberId,
    serviceId,
  ]);
  await pool.execute(
    `
      INSERT INTO horarios_trabalho (
        barbeiro_id, dia_semana, hora_inicio, hora_fim,
        intervalo_inicio, intervalo_fim, ativo
      ) VALUES (?, ?, '09:00', '18:00', '14:00', '14:30', TRUE)
    `,
    [barberId, dayOfWeek],
  );
  await pool.execute(
    `
      UPDATE horarios_funcionamento
      SET hora_inicio = '09:00', hora_fim = '18:00',
          intervalo_inicio = '12:00', intervalo_fim = '13:00', ativo = TRUE
      WHERE dia_semana = ?
    `,
    [dayOfWeek],
  );
  await pool.execute(
    `
      UPDATE configuracoes
      SET fuso_horario = 'America/Recife', antecedencia_maxima_dias = 30,
          intervalo_entre_atendimentos_minutos = 10
      WHERE id = 1
    `,
  );

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await pool.execute('DELETE FROM agendamentos WHERE barbeiro_id = ?', [barberId]);
  await pool.execute("DELETE FROM bloqueios_agenda WHERE motivo LIKE 'F5-%'");
  await pool.execute('DELETE FROM horarios_trabalho WHERE barbeiro_id = ?', [barberId]);
  await pool.execute('DELETE FROM barbeiro_servicos WHERE barbeiro_id = ?', [barberId]);
  await pool.execute('DELETE FROM barbeiros WHERE id = ?', [barberId]);
  await pool.execute('DELETE FROM servicos WHERE id = ?', [serviceId]);
  await pool.execute('DELETE FROM usuarios WHERE id IN (?, ?)', [barberUserId, clientId]);
  await pool.execute(
    `
      UPDATE configuracoes
      SET nome_barbearia = ?, telefone = ?, endereco = ?, fuso_horario = ?,
          tempo_minimo_cancelamento_horas = ?, antecedencia_maxima_dias = ?,
          intervalo_entre_atendimentos_minutos = ?
      WHERE id = 1
    `,
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
    `
      UPDATE horarios_funcionamento
      SET hora_inicio = ?, hora_fim = ?, intervalo_inicio = ?, intervalo_fim = ?, ativo = ?
      WHERE dia_semana = ?
    `,
    [
      originalBusinessHours.hora_inicio,
      originalBusinessHours.hora_fim,
      originalBusinessHours.intervalo_inicio,
      originalBusinessHours.intervalo_fim,
      originalBusinessHours.ativo,
      dayOfWeek,
    ],
  );
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('rota pública preserva contrato local, preço, IDs e no-store', async () => {
  const response = await validRequest();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(body.data, localDate);
  assert.equal(body.barbeiro.id, String(barberId));
  assert.equal(body.servico.id, String(serviceId));
  assert.equal(body.servico.preco, '40.00');
  assert.ok(body.horarios.length > 0);
  assert.equal(JSON.stringify(body).includes('Utc'), false);
  assert.equal(JSON.stringify(body).includes('cliente'), false);
  assert.deepEqual(
    body.horarios,
    [...body.horarios].sort((a, b) => a.inicioLocal.localeCompare(b.inicioLocal)),
  );
});

test('query rejeita ausência, extras, IDs e datas inválidas', async () => {
  assert.equal((await request()).status, 422);
  assert.equal((await validRequest({ extra: 'x' })).status, 422);
  assert.equal((await validRequest({ barbeiroId: 0 })).status, 422);
  assert.equal((await validRequest({ servicoId: 'abc' })).status, 422);
  assert.equal((await validRequest({ data: '2026-02-30' })).status, 422);
  assert.equal(
    (
      await validRequest({
        data: DateTime.now().setZone(timeZone).minus({ days: 1 }).toFormat('yyyy-MM-dd'),
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await validRequest({
        data: DateTime.now().setZone(timeZone).toFormat('yyyy-MM-dd'),
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await validRequest({
        data: DateTime.now().setZone(timeZone).plus({ days: 30 }).toFormat('yyyy-MM-dd'),
      })
    ).status,
    200,
  );
  const beyond = await validRequest({
    data: DateTime.now().setZone(timeZone).plus({ days: 31 }).toFormat('yyyy-MM-dd'),
  });
  assert.equal(beyond.status, 422);
  assert.equal((await beyond.json()).error.code, 'BOOKING_DATE_OUT_OF_RANGE');
});

test('entidades e vínculo são validados sem expor inativos', async () => {
  assert.equal((await validRequest({ barbeiroId: 9_999_999 })).status, 404);
  assert.equal((await validRequest({ servicoId: 9_999_999 })).status, 404);
  await pool.execute('UPDATE servicos SET ativo = FALSE WHERE id = ?', [serviceId]);
  assert.equal((await validRequest()).status, 404);
  await pool.execute('UPDATE servicos SET ativo = TRUE WHERE id = ?', [serviceId]);
  await pool.execute('UPDATE usuarios SET ativo = FALSE WHERE id = ?', [barberUserId]);
  assert.equal((await validRequest()).status, 404);
  await pool.execute('UPDATE usuarios SET ativo = TRUE WHERE id = ?', [barberUserId]);
  await pool.execute('UPDATE barbeiros SET ativo = FALSE WHERE id = ?', [barberId]);
  assert.equal((await validRequest()).status, 404);
  await pool.execute('UPDATE barbeiros SET ativo = TRUE WHERE id = ?', [barberId]);
  await pool.execute('DELETE FROM barbeiro_servicos WHERE barbeiro_id = ?', [barberId]);
  const missingLink = await validRequest();
  assert.equal(missingLink.status, 422);
  assert.equal((await missingLink.json()).error.code, 'BARBER_SERVICE_NOT_AVAILABLE');
  await pool.execute('INSERT INTO barbeiro_servicos (barbeiro_id, servico_id) VALUES (?, ?)', [
    barberId,
    serviceId,
  ]);
});

test('dia fechado e barbeiro sem jornada retornam lista vazia', async () => {
  await pool.execute('UPDATE horarios_funcionamento SET ativo = FALSE WHERE dia_semana = ?', [
    dayOfWeek,
  ]);
  let body = await (await validRequest()).json();
  assert.deepEqual(body.horarios, []);
  await pool.execute('UPDATE horarios_funcionamento SET ativo = TRUE WHERE dia_semana = ?', [
    dayOfWeek,
  ]);
  await pool.execute('UPDATE horarios_trabalho SET ativo = FALSE WHERE barbeiro_id = ?', [
    barberId,
  ]);
  body = await (await validRequest()).json();
  assert.deepEqual(body.horarios, []);
  await pool.execute('UPDATE horarios_trabalho SET ativo = TRUE WHERE barbeiro_id = ?', [barberId]);
});

test('pausas, bloqueios globais e específicos removem sobreposições', async () => {
  let body = await (await validRequest()).json();
  assert.equal(
    body.horarios.some((slot) => slot.inicioLocal === '12:00'),
    false,
  );
  assert.equal(
    body.horarios.some((slot) => slot.inicioLocal === '14:00'),
    false,
  );

  for (const specific of [barberId, null]) {
    const [result] = await pool.execute(
      `
        INSERT INTO bloqueios_agenda
          (barbeiro_id, inicio_em, fim_em, motivo, criado_por)
        VALUES (?, ?, ?, ?, ?)
      `,
      [specific, localToUtc('10:10'), localToUtc('10:20'), `${marker} bloqueio`, clientId],
    );
    body = await (await validRequest()).json();
    assert.equal(
      body.horarios.some((slot) => slot.inicioLocal === '10:00'),
      false,
    );
    await pool.execute('DELETE FROM bloqueios_agenda WHERE id = ?', [result.insertId]);
  }
});

test('buffer e status ativos bloqueiam; status finais não bloqueiam', async () => {
  for (const status of ['pendente', 'confirmado', 'em_atendimento']) {
    const appointmentId = await insertAppointment(status, '10:00', '10:30');
    const body = await (await validRequest()).json();
    assert.equal(
      body.horarios.some((slot) => slot.inicioLocal === '10:30'),
      false,
    );
    assert.equal(
      body.horarios.some((slot) => slot.inicioLocal === '10:45'),
      true,
    );
    await deleteAppointment(appointmentId);
  }
  for (const status of ['cancelado', 'concluido', 'ausente']) {
    const appointmentId = await insertAppointment(status, '10:00', '10:30');
    const body = await (await validRequest()).json();
    assert.equal(
      body.horarios.some((slot) => slot.inicioLocal === '10:00'),
      true,
    );
    await deleteAppointment(appointmentId);
  }
});

test('modos rejeitam configuração inválida e validação transacional usa o mesmo contexto', async () => {
  const startUtc = localToUtc('09:00');
  await assert.rejects(
    () =>
      validateAvailability({
        barbeiroId: barberId,
        servicoId: serviceId,
        inicioUtc: startUtc,
        mode: 'unknown',
        nowUtc: new Date(),
      }),
    (error) => error.code === 'INVALID_AVAILABILITY_MODE',
  );
  await assert.rejects(
    () =>
      validateAvailability({
        barbeiroId: barberId,
        servicoId: serviceId,
        inicioUtc: startUtc,
        mode: AVAILABILITY_MODE.TRANSACTIONAL,
        nowUtc: new Date(),
      }),
    (error) => error.code === 'TRANSACTION_CONNECTION_REQUIRED',
  );

  const contextConnection = await pool.getConnection();
  const otherConnection = await pool.getConnection();
  const validContext = await beginTransactionContext(contextConnection);
  let otherConnectionExecutions = 0;
  const differentConnection = {
    execute: (...args) => {
      otherConnectionExecutions += 1;
      return otherConnection.execute(...args);
    },
  };
  try {
    await assert.rejects(
      () =>
        validateAvailability({
          barbeiroId: barberId,
          servicoId: serviceId,
          inicioUtc: startUtc,
          connection: { ...validContext, connection: differentConnection },
          mode: AVAILABILITY_MODE.TRANSACTIONAL,
          nowUtc: new Date(),
        }),
      (error) => error.code === 'TRANSACTION_CONNECTION_REQUIRED',
    );
    assert.equal(otherConnectionExecutions, 0);
  } finally {
    await contextConnection.rollback();
    closeTransactionContext(validContext);
    contextConnection.release();
    otherConnection.release();
  }
  await assert.rejects(
    () =>
      validateAvailability({
        barbeiroId: barberId,
        servicoId: serviceId,
        inicioUtc: startUtc,
        connection: { connection: pool, transactionActive: true },
        mode: AVAILABILITY_MODE.TRANSACTIONAL,
        nowUtc: new Date(),
      }),
    (error) => error.code === 'TRANSACTION_CONNECTION_REQUIRED',
  );

  const connection = await pool.getConnection();
  const calls = [];
  const trackedConnection = {
    query: (...args) => connection.query(...args),
    beginTransaction: (...args) => connection.beginTransaction(...args),
    execute: (...args) => {
      calls.push(args[0]);
      return connection.execute(...args);
    },
  };
  const context = await beginTransactionContext(trackedConnection);
  try {
    const result = await validateAvailability({
      barbeiroId: barberId,
      servicoId: serviceId,
      inicioUtc: startUtc,
      connection: context,
      mode: AVAILABILITY_MODE.TRANSACTIONAL,
      nowUtc: new Date(),
    });
    assert.equal(result.available, true);
    assert.match(calls[0], /FOR UPDATE/);
    assert.equal(calls.filter((sql) => /FOR UPDATE/.test(sql)).length, 1);
    const blockQueryIndex = calls.findIndex((sql) => /FROM bloqueios_agenda/.test(sql));
    const appointmentQueryIndex = calls.findIndex((sql) => /FROM agendamentos/.test(sql));
    assert.ok(blockQueryIndex > 0);
    assert.ok(appointmentQueryIndex > blockQueryIndex);
  } finally {
    await connection.rollback();
    closeTransactionContext(context);
    connection.release();
  }

  const serviceSource = await readFile(
    new URL('../src/services/disponibilidadeService.js', import.meta.url),
    'utf8',
  );
  assert.equal(/\.beginTransaction\(|\.commit\(|\.rollback\(/.test(serviceSource), false);
  assert.match(serviceSource, /mode === AVAILABILITY_MODE\.TRANSACTIONAL/);
});

test('READ_ONLY funciona sem contexto e não adquire lock', async () => {
  const result = await validateAvailability({
    barbeiroId: barberId,
    servicoId: serviceId,
    inicioUtc: localToUtc('09:00'),
    mode: AVAILABILITY_MODE.READ_ONLY,
    nowUtc: new Date(),
  });
  assert.equal(result.available, true);
});

test('duas conexões serializam o lock e são liberadas por commit e rollback', async () => {
  for (const release of ['commit', 'rollback']) {
    const connectionA = await pool.getConnection();
    const connectionB = await pool.getConnection();
    let contextA;
    let contextB;
    try {
      await connectionA.query('SET SESSION innodb_lock_wait_timeout = 5');
      await connectionB.query('SET SESSION innodb_lock_wait_timeout = 5');
      contextA = await beginTransactionContext(connectionA);
      contextB = await beginTransactionContext(connectionB);
      await availabilityRepository.lockBarber(barberId, connectionA);

      let secondFinished = false;
      const secondLock = availabilityRepository.lockBarber(barberId, connectionB).then(() => {
        secondFinished = true;
      });
      await Promise.race([secondLock, new Promise((resolve) => setTimeout(resolve, 100))]);
      assert.equal(secondFinished, false);

      await connectionA[release]();
      closeTransactionContext(contextA);
      contextA = null;
      await secondLock;
      assert.equal(secondFinished, true);
      await connectionB.rollback();
      closeTransactionContext(contextB);
      contextB = null;
    } finally {
      if (contextA) {
        await connectionA.rollback();
        closeTransactionContext(contextA);
      }
      if (contextB) {
        await connectionB.rollback();
        closeTransactionContext(contextB);
      }
      connectionA.release();
      connectionB.release();
    }
  }
});

test('rate limit próprio bloqueia excesso de consultas', async () => {
  let limited = false;
  for (let attempt = 0; attempt < 70; attempt += 1) {
    if ((await validRequest()).status === 429) {
      limited = true;
      break;
    }
  }
  assert.equal(limited, true);
});
