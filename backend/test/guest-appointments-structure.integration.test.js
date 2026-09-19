import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { DateTime } from 'luxon';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'guest-appointments-test-secret-with-at-least-32-characters';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_ISSUER = 'barbearia-api';
process.env.JWT_AUDIENCE = 'barbearia-web';

const { app } = await import('../src/app.js');
const { issueAccessToken } = await import('../src/auth/jwtIssuer.js');
const { hashPassword } = await import('../src/auth/password.js');
const { pool } = await import('../src/config/database.js');
const { grantRole } = await import('../src/repositories/roleRepository.js');

const marker = `guest-structure-${randomUUID().slice(0, 8)}`;
const zone = 'America/Recife';
const date = DateTime.now().setZone(zone).plus({ days: 3 }).toFormat('yyyy-MM-dd');
let sequence = 0;
let server;
let base;
let admin;
let client;
let barber;
let barberId;
let serviceId;
let guestAppointmentId;
let registeredAppointmentId;

function appointmentTime(time) {
  return DateTime.fromISO(`${date}T${time}:00`, { zone }).toUTC().toJSDate();
}

async function createUser(profile) {
  const password = await hashPassword('SenhaTeste123');
  const suffix = `${profile}-${++sequence}`;
  const [result] = await pool.execute(
    'INSERT INTO usuarios(nome,email,telefone,senha_hash,perfil) VALUES(?,?,?,?,?)',
    [
      `${marker} ${suffix}`,
      `${marker}-${suffix}@example.test`,
      `819${String(sequence).padStart(8, '0')}`,
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

async function insertAppointment({
  clientId = null,
  name = null,
  phone = null,
  start = '10:00',
} = {}) {
  const startAt = appointmentTime(start);
  const endAt = new Date(startAt.getTime() + 30 * 60_000);
  const [result] = await pool.execute(
    `INSERT INTO agendamentos (
      cliente_id,cliente_nome_snapshot,cliente_telefone_snapshot,barbeiro_id,servico_id,criado_por,origem,
      inicio_em,fim_em,fim_ocupacao_em,preco,duracao_minutos,buffer_minutos,status
    ) VALUES (?,?,?,?,?,?, 'admin', ?,?,?,40.00,30,0,'confirmado')`,
    [clientId, name, phone, barberId, serviceId, admin.id, startAt, endAt, endAt],
  );
  return result.insertId;
}

async function api(path, token) {
  return fetch(`${base}${path}`, { headers: { cookie: `barbearia_session=${token}` } });
}

test.before(async () => {
  admin = await createUser('admin');
  client = await createUser('cliente');
  barber = await createUser('barbeiro');
  const [barberResult] = await pool.execute('INSERT INTO barbeiros(usuario_id) VALUES(?)', [
    barber.id,
  ]);
  barberId = barberResult.insertId;
  const [serviceResult] = await pool.execute(
    'INSERT INTO servicos(nome,preco,duracao_minutos) VALUES(?,40.00,30)',
    [`${marker} service`],
  );
  serviceId = serviceResult.insertId;

  guestAppointmentId = await insertAppointment({ name: `${marker} guest` });
  registeredAppointmentId = await insertAppointment({ clientId: client.id, start: '11:00' });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(async () => {
  let failure;
  try {
    await pool.execute('DELETE FROM agendamentos WHERE id IN (?,?)', [
      guestAppointmentId,
      registeredAppointmentId,
    ]);
    await pool.execute('DELETE FROM barbeiros WHERE id=?', [barberId]);
    await pool.execute('DELETE FROM servicos WHERE id=?', [serviceId]);
    await pool.execute('DELETE FROM usuario_papeis WHERE usuario_id IN (?,?,?)', [
      admin.id,
      client.id,
      barber.id,
    ]);
    await pool.execute('DELETE FROM usuarios WHERE id IN (?,?,?)', [
      admin.id,
      client.id,
      barber.id,
    ]);
  } catch (error) {
    failure = error;
  } finally {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
  if (failure) throw failure;
});

test('cliente opcional exige nome de snapshot e aceita telefone opcional', async () => {
  const [[clientColumn]] = await pool.execute(
    `SELECT is_nullable AS isNullable
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'agendamentos' AND column_name = 'cliente_id'`,
  );
  const [foreignKeys] = await pool.execute(
    `SELECT constraint_name
     FROM information_schema.key_column_usage
     WHERE table_schema = DATABASE() AND table_name = 'agendamentos'
       AND column_name = 'cliente_id' AND referenced_table_name = 'usuarios'`,
  );
  assert.equal(clientColumn.isNullable, 'YES');
  assert.equal(foreignKeys.length, 1);
  await assert.rejects(
    () => insertAppointment(),
    /CONSTRAINT|chk_agendamentos_cliente_ou_snapshot/i,
  );
  const appointmentId = await insertAppointment({
    name: `${marker} phone optional`,
    start: '12:00',
  });
  await pool.execute('DELETE FROM agendamentos WHERE id=?', [appointmentId]);
});

test('leituras admin e barbeiro exibem cliente cadastrado e visitante sem quebrar o detalhe', async () => {
  const adminList = await api(
    `/admin/agendamentos?dataInicial=${date}&dataFinal=${date}`,
    admin.token,
  );
  assert.equal(adminList.status, 200);
  const adminItems = (await adminList.json()).data;
  const guest = adminItems.find((item) => item.id === String(guestAppointmentId));
  const registered = adminItems.find((item) => item.id === String(registeredAppointmentId));
  assert.deepEqual(guest.cliente, { id: null, nome: `${marker} guest` });
  assert.deepEqual(registered.cliente, { id: String(client.id), nome: `${marker} cliente-2` });

  const adminDetail = await api(`/admin/agendamentos/${guestAppointmentId}`, admin.token);
  assert.equal(adminDetail.status, 200);
  assert.deepEqual((await adminDetail.json()).data.cliente, guest.cliente);

  const barberList = await api(`/barbeiro/agendamentos?data=${date}`, barber.token);
  assert.equal(barberList.status, 200);
  const barberGuest = (await barberList.json()).data.find(
    (item) => item.id === String(guestAppointmentId),
  );
  assert.deepEqual(barberGuest.cliente, guest.cliente);

  const barberDetail = await api(`/barbeiro/agendamentos/${guestAppointmentId}`, barber.token);
  assert.equal(barberDetail.status, 200);
  assert.deepEqual((await barberDetail.json()).data.cliente, guest.cliente);
});

test('cliente cadastrado não acessa agendamento visitante', async () => {
  const response = await api(`/agendamentos/${guestAppointmentId}`, client.token);
  assert.equal(response.status, 403);
});
