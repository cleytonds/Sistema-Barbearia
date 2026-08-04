import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'phase4-extended-secret-with-at-least-32-characters';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_ISSUER = 'barbearia-api';
process.env.JWT_AUDIENCE = 'barbearia-web';

const { app } = await import('../src/app.js');
const { pool } = await import('../src/config/database.js');
const { issueAccessToken } = await import('../src/auth/jwtIssuer.js');
const { hashPassword } = await import('../src/auth/password.js');
const barberService = await import('../src/services/barbeiroService.js');

const key = randomUUID().replaceAll('-', '').slice(0, 12);
const prefix = `F4X-${key}`;
const primaryBarberPhone = phone(3);
const ids = { users: [], barbers: [], services: [], blocks: [], appointments: [] };
let server, base, admin, client, barber, adminToken, barberToken, originalConfig, originalHours;

async function request(path, { method = 'GET', body, token = adminToken } = {}) {
  return fetch(base + path, {
    method,
    headers: {
      ...(body && { 'content-type': 'application/json' }),
      ...(token && { authorization: `Bearer ${token}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
}
async function json(response) {
  const value = await response.json();
  return { response, value };
}
function phone(n) {
  return `819${String(Date.now() + n).slice(-8)}`;
}
function week(overrides = {}) {
  return Array.from({ length: 7 }, (_, diaSemana) => ({
    diaSemana,
    horaInicio: '09:00',
    horaFim: '18:00',
    intervaloInicio: '12:00',
    intervaloFim: '13:00',
    ativo: diaSemana !== 0,
    ...(overrides[diaSemana] || {}),
  }));
}
function barberWeek(overrides = {}) {
  return Array.from({ length: 7 }, (_, diaSemana) => ({
    diaSemana,
    horaInicio: '09:30',
    horaFim: '17:30',
    intervaloInicio: '12:00',
    intervaloFim: '13:00',
    ativo: diaSemana !== 0,
    ...(overrides[diaSemana] || {}),
  }));
}
async function createService(name, extra = {}) {
  const { response, value } = await json(
    await request('/admin/servicos', {
      method: 'POST',
      body: { nome: name, preco: '35.00', duracao_minutos: 30, ...extra },
    }),
  );
  if (response.status === 201) ids.services.push(Number(value.data.id));
  return { response, value };
}

test.before(async () => {
  originalConfig = (await pool.query('SELECT * FROM configuracoes WHERE id=1'))[0][0];
  originalHours = (await pool.query('SELECT * FROM horarios_funcionamento ORDER BY dia_semana'))[0];
  const hash = await hashPassword('SenhaForte123');
  for (const [name, email, profile, n] of [
    [`${prefix} Admin`, `${key}-admin@example.test`, 'admin', 1],
    [`${prefix} Cliente`, `${key}-cliente@example.test`, 'cliente', 2],
  ]) {
    const [result] = await pool.execute(
      'INSERT INTO usuarios(nome,email,telefone,senha_hash,perfil) VALUES(?,?,?,?,?)',
      [name, email, phone(n), hash, profile],
    );
    ids.users.push(result.insertId);
    if (profile === 'admin') admin = { id: result.insertId, auth_versao: 1 };
    else client = { id: result.insertId };
  }
  adminToken = issueAccessToken(admin);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  const created = await json(
    await request('/admin/barbeiros', {
      method: 'POST',
      body: {
        nome: `${prefix} Barbeiro`,
        email: `${key}-barber@example.test`,
        telefone: primaryBarberPhone,
        senha: 'SenhaForte123',
        confirmacaoSenha: 'SenhaForte123',
        foto_url: 'https://example.test/foto.jpg',
      },
    }),
  );
  assert.equal(created.response.status, 201);
  barber = created.value.data;
  ids.barbers.push(Number(barber.id));
  ids.users.push(Number(barber.usuario_id));
  const [[user]] = await pool.execute('SELECT id,auth_versao FROM usuarios WHERE id=?', [
    barber.usuario_id,
  ]);
  barberToken = issueAccessToken(user);
});

test.after(async () => {
  const placeholders = (values) => values.map(() => '?').join(',');
  if (ids.appointments.length)
    await pool.execute(
      `DELETE FROM agendamentos WHERE id IN (${placeholders(ids.appointments)})`,
      ids.appointments,
    );
  if (ids.users.length)
    await pool.execute(
      `DELETE FROM bloqueios_agenda WHERE criado_por IN (${placeholders(ids.users)})`,
      ids.users,
    );
  if (ids.barbers.length)
    await pool.execute(
      `DELETE FROM horarios_trabalho WHERE barbeiro_id IN (${placeholders(ids.barbers)})`,
      ids.barbers,
    );
  if (ids.barbers.length || ids.services.length)
    await pool.execute(
      `DELETE FROM barbeiro_servicos WHERE barbeiro_id IN (${placeholders(ids.barbers.length ? ids.barbers : [0])}) OR servico_id IN (${placeholders(ids.services.length ? ids.services : [0])})`,
      [...(ids.barbers.length ? ids.barbers : [0]), ...(ids.services.length ? ids.services : [0])],
    );
  if (ids.barbers.length)
    await pool.execute(
      `DELETE FROM barbeiros WHERE id IN (${placeholders(ids.barbers)})`,
      ids.barbers,
    );
  if (ids.services.length)
    await pool.execute(
      `DELETE FROM servicos WHERE id IN (${placeholders(ids.services)})`,
      ids.services,
    );
  if (ids.users.length)
    await pool.execute(`DELETE FROM usuarios WHERE id IN (${placeholders(ids.users)})`, ids.users);
  await pool.execute(
    'UPDATE configuracoes SET nome_barbearia=?,telefone=?,endereco=?,fuso_horario=?,tempo_minimo_cancelamento_horas=?,antecedencia_maxima_dias=?,intervalo_entre_atendimentos_minutos=? WHERE id=1',
    [
      originalConfig.nome_barbearia,
      originalConfig.telefone,
      originalConfig.endereco,
      originalConfig.fuso_horario,
      originalConfig.tempo_minimo_cancelamento_horas,
      originalConfig.antecedencia_maxima_dias,
      originalConfig.intervalo_entre_atendimentos_minutos,
    ],
  );
  for (const d of originalHours)
    await pool.execute(
      'UPDATE horarios_funcionamento SET hora_inicio=?,hora_fim=?,intervalo_inicio=?,intervalo_fim=?,ativo=? WHERE dia_semana=?',
      [d.hora_inicio, d.hora_fim, d.intervalo_inicio, d.intervalo_fim, d.ativo, d.dia_semana],
    );
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('servicos: unicidade real, edição, paginação e validação estrita', async () => {
  const name = `${prefix} Serviço Único`;
  const first = await createService(`  ${name}  `);
  assert.equal(first.response.status, 201);
  const serviceId = first.value.data.id;
  assert.equal((await createService(` ${name.toUpperCase()} `)).response.status, 409);
  const raceName = `${prefix} Concorrente`;
  const race = await Promise.all([
    createService(raceName),
    createService(` ${raceName.toLowerCase()} `),
  ]);
  assert.deepEqual(race.map((x) => x.response.status).sort(), [201, 409]);
  let r = await request(`/admin/servicos/${serviceId}`, {
    method: 'PUT',
    body: { nome: name, preco: '44.90', duracao_minutos: 50 },
  });
  assert.equal(r.status, 200);
  const updated = (await r.json()).data;
  assert.equal(Number(updated.preco), 44.9);
  assert.equal(updated.duracao_minutos, 50);
  assert.equal(
    (
      await request(`/admin/servicos/${serviceId}`, {
        method: 'PUT',
        body: { nome: name, preco: '44.90', duracao_minutos: 50, ativo: false },
      })
    ).status,
    422,
  );
  for (const bad of [{ preco: '1e2' }, { preco: '1.999' }, { inesperado: true }])
    assert.equal(
      (
        await request('/admin/servicos', {
          method: 'POST',
          body: {
            nome: `${prefix} Bad ${Math.random()}`,
            preco: '10.00',
            duracao_minutos: 20,
            ...bad,
          },
        })
      ).status,
      422,
    );
  r = await request('/admin/servicos?page=1&limit=1&sort=nome&order=asc');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).pagination.limit, 1);
  assert.equal((await request('/admin/servicos?page=1&limit=101')).status, 422);
  assert.equal((await request('/admin/servicos?sort=senha_hash')).status, 422);
});

test('barbeiro: rollback real, duplicidades, senha, URL e resposta segura', async () => {
  const rollbackEmail = `${key}-rollback@example.test`;
  await assert.rejects(() =>
    barberService.create({
      nome: `${prefix} Rollback`,
      email: rollbackEmail,
      telefone: phone(10),
      senha: 'SenhaForte123',
      descricao: 'x'.repeat(70000),
    }),
  );
  assert.equal(
    (await pool.execute('SELECT COUNT(*) total FROM usuarios WHERE email=?', [rollbackEmail]))[0][0]
      .total,
    0,
  );
  const baseBody = {
    nome: `${prefix} Outro`,
    email: `  ${String(`${key}-barber@example.test`).toUpperCase()}  `,
    telefone: phone(20),
    senha: 'SenhaForte123',
    confirmacaoSenha: 'SenhaForte123',
  };
  assert.equal((await request('/admin/barbeiros', { method: 'POST', body: baseBody })).status, 409);
  assert.equal(
    (
      await request('/admin/barbeiros', {
        method: 'POST',
        body: {
          ...baseBody,
          email: `${key}-other@example.test`,
          telefone: `(${primaryBarberPhone.slice(0, 2)}) ${primaryBarberPhone.slice(2)}`,
        },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request('/admin/barbeiros', {
        method: 'POST',
        body: {
          ...baseBody,
          email: `${key}-weak@example.test`,
          telefone: phone(21),
          senha: 'fraca',
          confirmacaoSenha: 'fraca',
        },
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await request('/admin/barbeiros', {
        method: 'POST',
        body: {
          ...baseBody,
          email: `${key}-http@example.test`,
          telefone: phone(22),
          foto_url: 'http://example.com/a.jpg',
        },
      })
    ).status,
    422,
  );
  const ok = await json(
    await request('/admin/barbeiros', {
      method: 'POST',
      body: {
        ...baseBody,
        email: `${key}-https@example.test`,
        telefone: phone(23),
        foto_url: 'https://example.com/a.jpg',
      },
    }),
  );
  assert.equal(ok.response.status, 201);
  ids.users.push(Number(ok.value.data.usuario_id));
  ids.barbers.push(Number(ok.value.data.id));
  assert.equal(ok.value.data.senha_hash, undefined);
  assert.equal(ok.value.data.auth_versao, undefined);
  const local = await json(
    await request('/admin/barbeiros', {
      method: 'POST',
      body: {
        ...baseBody,
        email: `${key}-local@example.test`,
        telefone: phone(24),
        foto_url: 'http://localhost/a.jpg',
      },
    }),
  );
  assert.equal(local.response.status, 201);
  ids.users.push(Number(local.value.data.usuario_id));
  ids.barbers.push(Number(local.value.data.id));
});

test('sincronização barbeiro-serviços é atômica e respeita status', async () => {
  const a = await createService(`${prefix} Vínculo A`),
    b = await createService(`${prefix} Vínculo B`);
  const aid = a.value.data.id,
    bid = b.value.data.id;
  let r = await request(`/admin/barbeiros/${barber.id}/servicos`, {
    method: 'PUT',
    body: { servicoIds: [aid, bid] },
  });
  assert.equal(r.status, 200);
  r = await request(`/admin/barbeiros/${barber.id}/servicos`, {
    method: 'PUT',
    body: { servicoIds: [aid, bid] },
  });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).data.length, 2);
  assert.equal(
    (
      await request(`/admin/barbeiros/${barber.id}/servicos`, {
        method: 'PUT',
        body: { servicoIds: [aid, aid] },
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await request(`/admin/barbeiros/${barber.id}/servicos`, {
        method: 'PUT',
        body: { servicoIds: [aid, 999999999] },
      })
    ).status,
    404,
  );
  let [links] = await pool.execute(
    'SELECT servico_id FROM barbeiro_servicos WHERE barbeiro_id=? ORDER BY servico_id',
    [barber.id],
  );
  assert.deepEqual(
    links.map((x) => String(x.servico_id)),
    [String(aid), String(bid)].sort(),
  );
  await request(`/admin/servicos/${bid}/status`, { method: 'PATCH', body: { ativo: false } });
  assert.equal(
    (
      await request(`/admin/barbeiros/${barber.id}/servicos`, {
        method: 'PUT',
        body: { servicoIds: [bid] },
      })
    ).status,
    422,
  );
  [links] = await pool.execute('SELECT servico_id FROM barbeiro_servicos WHERE barbeiro_id=?', [
    barber.id,
  ]);
  assert.equal(links.length, 2);
  await request(`/admin/barbeiros/${barber.id}/status`, {
    method: 'PATCH',
    body: { ativo: false },
  });
  assert.equal(
    (
      await request(`/admin/barbeiros/${barber.id}/servicos`, {
        method: 'PUT',
        body: { servicoIds: [] },
      })
    ).status,
    404,
  );
  await request(`/admin/barbeiros/${barber.id}/status`, { method: 'PATCH', body: { ativo: true } });
  await request(`/admin/servicos/${bid}/status`, { method: 'PATCH', body: { ativo: true } });
  r = await request(`/admin/barbeiros/${barber.id}/servicos`, {
    method: 'PUT',
    body: { servicoIds: [] },
  });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).data.length, 0);
});

test('horários globais validam semana e preservam estado após erros', async () => {
  const valid = week();
  assert.equal(
    (await request('/admin/horarios-funcionamento', { method: 'PUT', body: { dias: valid } }))
      .status,
    200,
  );
  assert.equal(
    (await request('/admin/horarios-funcionamento', { method: 'PUT', body: { dias: valid } }))
      .status,
    200,
  );
  const invalid = [
    valid.slice(0, 6),
    [...valid.slice(0, 6), { ...valid[5] }],
    week({ 1: { diaSemana: 7 } }),
    week({ 1: { horaFim: '09:00' } }),
    week({ 1: { intervaloFim: null } }),
    week({ 1: { intervaloInicio: '14:00', intervaloFim: '13:00' } }),
    week({ 1: { intervaloInicio: '08:00', intervaloFim: '09:00' } }),
  ];
  for (const dias of invalid)
    assert.equal(
      (await request('/admin/horarios-funcionamento', { method: 'PUT', body: { dias } })).status,
      422,
    );
  const after = (await (await request('/admin/horarios-funcionamento')).json()).data;
  assert.equal(after.find((x) => x.dia_semana === 1).hora_inicio, '09:00:00');
});

test('jornada respeita funcionamento, pausas e rollback', async () => {
  const valid = barberWeek();
  assert.equal(
    (
      await request(`/admin/barbeiros/${barber.id}/horarios`, {
        method: 'PUT',
        body: { dias: valid },
      })
    ).status,
    200,
  );
  const invalid = [
    barberWeek({ 1: { horaInicio: '08:30' } }),
    barberWeek({ 1: { horaFim: '18:30' } }),
    barberWeek({ 0: { ativo: true } }),
    barberWeek({ 1: { intervaloFim: null } }),
    barberWeek({ 1: { intervaloInicio: '08:00', intervaloFim: '09:00' } }),
    barberWeek({ 1: { intervaloInicio: null, intervaloFim: null } }),
    valid.slice(0, 6),
  ];
  for (const dias of invalid)
    assert.equal(
      (await request(`/admin/barbeiros/${barber.id}/horarios`, { method: 'PUT', body: { dias } }))
        .status,
      422,
    );
  assert.equal(
    (
      await request(`/admin/barbeiros/${barber.id}/horarios`, {
        method: 'PUT',
        body: { dias: barberWeek({ 1: { intervaloInicio: '11:30', intervaloFim: '13:30' } }) },
      })
    ).status,
    200,
  );
  await request(`/admin/barbeiros/${barber.id}/status`, {
    method: 'PATCH',
    body: { ativo: false },
  });
  assert.equal(
    (
      await request(`/admin/barbeiros/${barber.id}/horarios`, {
        method: 'PUT',
        body: { dias: valid },
      })
    ).status,
    404,
  );
  await request(`/admin/barbeiros/${barber.id}/status`, { method: 'PATCH', body: { ativo: true } });
  const [after] = await pool.execute('SELECT * FROM horarios_trabalho WHERE barbeiro_id=?', [
    barber.id,
  ]);
  assert.equal(after.length, 7);
});

test('configurações têm exposição, limites, singleton e atualização atômica', async () => {
  const pub = await json(await request('/configuracoes/publicas', { token: null }));
  assert.equal(pub.response.status, 200);
  assert.equal(pub.value.data.antecedencia_maxima_dias, undefined);
  const adminRead = await json(await request('/admin/configuracoes'));
  assert.equal(adminRead.response.status, 200);
  assert.ok(adminRead.value.data.antecedencia_maxima_dias);
  const good = {
    nome_barbearia: `${prefix} Barbearia`,
    telefone: null,
    endereco: null,
    fuso_horario: 'America/Recife',
    tempo_minimo_cancelamento_horas: 2,
    antecedencia_maxima_dias: 30,
    intervalo_entre_atendimentos_minutos: 0,
  };
  assert.equal((await request('/admin/configuracoes', { method: 'PUT', body: good })).status, 200);
  for (const patch of [
    { fuso_horario: 'Mars/Olympus' },
    { tempo_minimo_cancelamento_horas: -1 },
    { antecedencia_maxima_dias: 0 },
    { antecedencia_maxima_dias: 366 },
    { intervalo_entre_atendimentos_minutos: 241 },
    { inesperado: 1 },
    { id: 2 },
  ])
    assert.equal(
      (await request('/admin/configuracoes', { method: 'PUT', body: { ...good, ...patch } }))
        .status,
      422,
    );
  const [[current], [count]] = await Promise.all([
    pool.query('SELECT * FROM configuracoes WHERE id=1').then((x) => x[0]),
    pool.query('SELECT COUNT(*) total FROM configuracoes').then((x) => x[0]),
  ]);
  assert.equal(current.nome_barbearia, good.nome_barbearia);
  assert.equal(count.total, 1);
});

test('bloqueios aplicam propriedade, UTC, conflitos, exclusão e locks', async () => {
  const own = {
    inicioLocal: '2035-10-10T09:00:00',
    fimLocal: '2035-10-10T10:00:00',
    motivo: `${prefix} próprio`,
  };
  assert.equal(
    (
      await request('/barbeiro/me/bloqueios', {
        method: 'POST',
        token: barberToken,
        body: { ...own, barbeiroId: barber.id },
      })
    ).status,
    422,
  );
  let made = await json(
    await request('/barbeiro/me/bloqueios', { method: 'POST', token: barberToken, body: own }),
  );
  assert.equal(made.response.status, 201);
  const ownId = made.value.data.id;
  const [[stored]] = await pool.execute('SELECT inicio_em FROM bloqueios_agenda WHERE id=?', [
    ownId,
  ]);
  assert.match(String(stored.inicio_em.toISOString()), /12:00:00/);
  assert.equal(
    (
      await request('/barbeiro/me/bloqueios', {
        method: 'POST',
        token: barberToken,
        body: { ...own, inicioLocal: '2035-10-10T11:00:00', fimLocal: '2035-10-10T10:00:00' },
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await request('/admin/bloqueios', {
        method: 'POST',
        body: {
          ...own,
          inicioLocal: '2020-01-01T09:00:00',
          fimLocal: '2020-01-01T10:00:00',
          barbeiroId: null,
        },
      })
    ).status,
    422,
  );
  made = await json(
    await request('/admin/bloqueios', {
      method: 'POST',
      body: {
        ...own,
        inicioLocal: '2020-01-01T09:00:00',
        fimLocal: '2020-01-01T10:00:00',
        barbeiroId: null,
        justificativaPassado: 'Correção administrativa',
      },
    }),
  );
  assert.equal(made.response.status, 201);
  const globalId = made.value.data.id;
  const service = await createService(`${prefix} Agenda`);
  const [appt] = await pool.execute(
    "INSERT INTO agendamentos(cliente_id,barbeiro_id,servico_id,inicio_em,fim_em,fim_ocupacao_em,preco,duracao_minutos,buffer_minutos,status,origem,criado_por) VALUES(?,?,?,'2035-10-11 12:00:00','2035-10-11 13:00:00','2035-10-11 13:00:00',35,60,0,'confirmado','admin',?)",
    [client.id, barber.id, service.value.data.id, admin.id],
  );
  ids.appointments.push(appt.insertId);
  const before = (await pool.execute('SELECT COUNT(*) total FROM bloqueios_agenda'))[0][0].total;
  const conflict = await json(
    await request('/admin/bloqueios', {
      method: 'POST',
      body: {
        ...own,
        inicioLocal: '2035-10-11T09:30:00',
        fimLocal: '2035-10-11T10:30:00',
        barbeiroId: barber.id,
      },
    }),
  );
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.value.error.code, 'SCHEDULE_CONFLICT');
  assert.equal(
    (await pool.execute('SELECT COUNT(*) total FROM bloqueios_agenda'))[0][0].total,
    before,
  );
  assert.equal(
    (await pool.execute('SELECT status FROM agendamentos WHERE id=?', [appt.insertId]))[0][0]
      .status,
    'confirmado',
  );
  assert.equal(
    (await request(`/barbeiro/me/bloqueios/${globalId}`, { method: 'DELETE', token: barberToken }))
      .status,
    403,
  );
  assert.equal((await request(`/admin/bloqueios/${globalId}`, { method: 'DELETE' })).status, 204);
  assert.equal((await request(`/admin/bloqueios/${globalId}`, { method: 'DELETE' })).status, 404);
  assert.equal(
    (await request(`/barbeiro/me/bloqueios/${ownId}`, { method: 'DELETE', token: barberToken }))
      .status,
    204,
  );
  const source = await readFile(
    new URL('../src/services/bloqueioService.js', import.meta.url),
    'utf8',
  );
  assert.match(source, /ORDER BY id FOR UPDATE/);
  assert.match(source, /WHERE id=\? AND ativo=TRUE FOR UPDATE/);
});
