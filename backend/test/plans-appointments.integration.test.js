import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { DateTime } from 'luxon';
import { validationResult } from 'express-validator';

process.env.NODE_ENV = 'test';

const { pool } = await import('../src/config/database.js');
const { hashPassword } = await import('../src/auth/password.js');
const { grantRole } = await import('../src/repositories/roleRepository.js');
const appointmentService = await import('../src/services/agendamentoService.js');
const cancellationService = await import('../src/services/agendamentoCancelamentoService.js');
const rescheduleService = await import('../src/services/agendamentoReagendamentoService.js');
const statusService = await import('../src/services/agendamentoStatusService.js');
const planService = await import('../src/services/planoService.js');
const subscriptionService = await import('../src/services/assinaturaPlanoService.js');
const paymentService = await import('../src/services/pagamentoPlanoService.js');
const commissionService = await import('../src/services/comissaoService.js');
const { adminCancelValidator } = await import('../src/validators/adminAgendamentoValidators.js');
const { cancelAppointmentValidator } = await import('../src/validators/agendamentoValidators.js');

const marker = `PAI-${randomUUID().slice(0, 8)}`;
const zone = 'America/Recife';
const today = DateTime.now().setZone(zone).toFormat('yyyy-MM-dd');
const baseDate = DateTime.now().setZone(zone).plus({ days: 7 });
const dates = [0, 7, 14, 21, 28].map((days) => baseDate.plus({ days }).toFormat('yyyy-MM-dd'));
const day = baseDate.weekday % 7;
let originalSettings;
let originalHours;
let adminId;
let clientId;
let pendingClientId;
let barberUserId;
let secondBarberUserId;
let barberId;
let secondBarberId;
let serviceId;
let secondServiceId;
let planId;
let subscriptionId;

async function addUser(profile, suffix) {
  const [result] = await pool.execute(
    'INSERT INTO usuarios(nome,email,telefone,senha_hash,perfil) VALUES(?,?,?,?,?)',
    [
      `${marker} ${suffix}`,
      `${marker}-${suffix}@example.test`,
      `81${String(Date.now() + Math.floor(Math.random() * 9999)).slice(-9)}`,
      await hashPassword('SenhaTeste123'),
      profile,
    ],
  );
  await grantRole(result.insertId, profile);
  return result.insertId;
}

const booking = (client, barber, service, date, hour, key = randomUUID()) =>
  appointmentService.createClient({
    userId: client,
    payload: {
      barbeiroId: String(barber),
      servicoId: String(service),
      data: date,
      horaInicio: hour,
    },
    key,
    nowUtc: baseDate.minus({ days: 1 }).toUTC().toJSDate(),
  });

async function createSubscription(client, confirmed = true) {
  const id = await subscriptionService.criarAssinaturaAdministrativa({
    data: {
      clientId: client,
      planoId: planId,
      inicioEm: dates[0],
      fimEm: dates[3],
      fusoHorario: zone,
    },
    actorId: adminId,
  });
  if (confirmed) {
    const payment = await paymentService.criarOuObterPagamentoPendente({
      data: {
        assinaturaId: id,
        referenciaMes: `${dates[0].slice(0, 7)}-01`,
        periodoInicio: dates[0],
        periodoFim: dates[3],
        valor: '100.00',
        forma: 'presencial',
      },
      actorId: adminId,
    });
    await paymentService.confirmarPagamento({ id: payment.pagamento.id, actorId: adminId });
  }
  return id;
}

test.before(async () => {
  [[originalSettings]] = await pool.execute('SELECT * FROM configuracoes WHERE id=1');
  [[originalHours]] = await pool.execute(
    'SELECT * FROM horarios_funcionamento WHERE dia_semana=?',
    [day],
  );
  adminId = await addUser('admin', 'admin');
  clientId = await addUser('cliente', 'cliente');
  pendingClientId = await addUser('cliente', 'pendente');
  barberUserId = await addUser('barbeiro', 'barbeiro');
  secondBarberUserId = await addUser('barbeiro', 'barbeiro2');
  [
    ({ insertId: barberId } = await pool
      .execute('INSERT INTO barbeiros(usuario_id) VALUES(?)', [barberUserId])
      .then(([result]) => result)),
  ];
  [
    ({ insertId: secondBarberId } = await pool
      .execute('INSERT INTO barbeiros(usuario_id) VALUES(?)', [secondBarberUserId])
      .then(([result]) => result)),
  ];
  const [service] = await pool.execute(
    'INSERT INTO servicos(nome,preco,duracao_minutos) VALUES(?,40.00,30)',
    [`${marker} Serviço`],
  );
  serviceId = service.insertId;
  const [secondService] = await pool.execute(
    'INSERT INTO servicos(nome,preco,duracao_minutos) VALUES(?,50.00,30)',
    [`${marker} Serviço extra`],
  );
  secondServiceId = secondService.insertId;
  for (const barber of [barberId, secondBarberId]) {
    for (const serviceItem of [serviceId, secondServiceId])
      await pool.execute('INSERT INTO barbeiro_servicos(barbeiro_id,servico_id) VALUES(?,?)', [
        barber,
        serviceItem,
      ]);
    await pool.execute(
      `INSERT INTO horarios_trabalho
       (barbeiro_id,dia_semana,hora_inicio,hora_fim,ativo)
       VALUES(?,?,'08:00','18:00',TRUE)`,
      [barber, day],
    );
  }
  await pool.execute(
    `UPDATE horarios_funcionamento SET hora_inicio='08:00',hora_fim='18:00',
     intervalo_inicio=NULL,intervalo_fim=NULL,ativo=TRUE WHERE dia_semana=?`,
    [day],
  );
  await pool.execute(
    `UPDATE configuracoes SET fuso_horario=?,antecedencia_maxima_dias=30,
     intervalo_entre_atendimentos_minutos=0,tempo_minimo_cancelamento_horas=2 WHERE id=1`,
    [zone],
  );
  planId = await planService.criarPlano({
    data: {
      nome: `${marker} Plano`,
      descricao: 'Integração com agenda',
      preco: '100.00',
      adesaoInicio: today,
      adesaoFim: dates[4],
      utilizacaoInicio: dates[0],
      utilizacaoFim: dates[4],
      possuiLimiteSemanal: true,
      limiteSemanal: 10,
      possuiLimiteTotal: true,
      limiteTotal: 50,
      servicos: [serviceId],
      barbeiros: [barberId],
    },
    actorId: adminId,
  });
  await commissionService.configurarComissao({
    barbeiroId: barberId,
    percentualAvulso: '50.00',
    percentualPlano: '40.00',
  });
  await pool.execute(
    'UPDATE plano_servicos SET valor_base_comissao=30.00 WHERE plano_id=? AND servico_id=?',
    [planId, serviceId],
  );
  subscriptionId = await createSubscription(clientId);
  await createSubscription(pendingClientId, false);
});

test.after(async () => {
  await pool.execute(
    `DELETE FROM historico_planos WHERE plano_id=? OR assinatura_id IN
     (SELECT id FROM assinaturas_planos WHERE plano_id=?)`,
    [planId, planId],
  );
  await pool.execute(
    `DELETE c FROM comissoes c JOIN agendamentos a ON a.id=c.agendamento_id
     WHERE a.cliente_id IN (?,?)`,
    [clientId, pendingClientId],
  );
  await pool.execute(
    `DELETE FROM usos_planos WHERE assinatura_id IN
     (SELECT id FROM assinaturas_planos WHERE plano_id=?)`,
    [planId],
  );
  await pool.execute(
    `DELETE FROM pagamentos_planos WHERE assinatura_id IN
     (SELECT id FROM assinaturas_planos WHERE plano_id=?)`,
    [planId],
  );
  await pool.execute(
    `DELETE FROM assinatura_plano_servicos WHERE assinatura_id IN
     (SELECT id FROM assinaturas_planos WHERE plano_id=?)`,
    [planId],
  );
  await pool.execute(
    `DELETE FROM assinatura_plano_barbeiros WHERE assinatura_id IN
     (SELECT id FROM assinaturas_planos WHERE plano_id=?)`,
    [planId],
  );
  await pool.execute(
    'DELETE h FROM historico_agendamentos h JOIN agendamentos a ON a.id=h.agendamento_id WHERE a.cliente_id IN (?,?)',
    [clientId, pendingClientId],
  );
  await pool.execute('DELETE FROM agendamentos WHERE cliente_id IN (?,?)', [
    clientId,
    pendingClientId,
  ]);
  await pool.execute('DELETE FROM assinaturas_planos WHERE plano_id=?', [planId]);
  await pool.execute('DELETE FROM plano_servicos WHERE plano_id=?', [planId]);
  await pool.execute('DELETE FROM plano_barbeiros WHERE plano_id=?', [planId]);
  await pool.execute('DELETE FROM planos WHERE id=?', [planId]);
  await pool.execute('DELETE FROM horarios_trabalho WHERE barbeiro_id IN (?,?)', [
    barberId,
    secondBarberId,
  ]);
  await pool.execute('DELETE FROM barbeiro_servicos WHERE barbeiro_id IN (?,?)', [
    barberId,
    secondBarberId,
  ]);
  await pool.execute('DELETE FROM configuracoes_comissao_barbeiros WHERE barbeiro_id IN (?,?)', [
    barberId,
    secondBarberId,
  ]);
  await pool.execute('DELETE FROM barbeiros WHERE id IN (?,?)', [barberId, secondBarberId]);
  await pool.execute('DELETE FROM servicos WHERE id IN (?,?)', [serviceId, secondServiceId]);
  await pool.execute('DELETE FROM usuarios WHERE nome LIKE ?', [`${marker}%`]);
  await pool.execute(
    `UPDATE configuracoes SET fuso_horario=?,tempo_minimo_cancelamento_horas=?,
     antecedencia_maxima_dias=?,intervalo_entre_atendimentos_minutos=? WHERE id=1`,
    [
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
  await pool.end();
});

test('criação decide plano/avulso, reserva uma vez e preserva replay', async () => {
  const key = randomUUID();
  const covered = await booking(clientId, barberId, serviceId, dates[0], '09:00', key);
  assert.equal(covered.appointment.tipoCobranca, 'plano');
  const replay = await booking(clientId, barberId, serviceId, dates[0], '09:00', key);
  assert.equal(replay.replayed, true);
  const [[usage]] = await pool.execute(
    'SELECT COUNT(*) total,MAX(status) status FROM usos_planos WHERE agendamento_id=?',
    [covered.appointment.id],
  );
  assert.equal(Number(usage.total), 1);
  assert.equal(usage.status, 'reservado');

  const pending = await booking(pendingClientId, barberId, serviceId, dates[0], '10:00');
  const wrongService = await booking(clientId, barberId, secondServiceId, dates[0], '11:00');
  const wrongBarber = await booking(clientId, secondBarberId, serviceId, dates[0], '12:00');
  assert.deepEqual(
    [pending, wrongService, wrongBarber].map((item) => item.appointment.tipoCobranca),
    ['avulso', 'avulso', 'avulso'],
  );
});

test('conclusão e ausência consomem uso de forma idempotente', async () => {
  const completed = await booking(clientId, barberId, serviceId, dates[1], '09:00');
  const start = DateTime.fromISO(`${dates[1]}T09:00:00`, { zone }).toUTC();
  for (const status of ['confirmado', 'em_atendimento', 'concluido'])
    await statusService.updateStatus({
      id: completed.appointment.id,
      userId: adminId,
      role: 'admin',
      nextStatus: status,
      nowUtc: start.plus({ minutes: 40 }).toJSDate(),
    });
  await statusService.updateStatus({
    id: completed.appointment.id,
    userId: adminId,
    role: 'admin',
    nextStatus: 'concluido',
    nowUtc: start.plus({ minutes: 45 }).toJSDate(),
  });
  const absent = await booking(clientId, barberId, serviceId, dates[1], '10:00');
  await statusService.updateStatus({
    id: absent.appointment.id,
    userId: adminId,
    role: 'admin',
    nextStatus: 'confirmado',
    nowUtc: start.toJSDate(),
  });
  await statusService.updateStatus({
    id: absent.appointment.id,
    userId: adminId,
    role: 'admin',
    nextStatus: 'ausente',
    nowUtc: start.plus({ hours: 2 }).toJSDate(),
  });
  const [rows] = await pool.execute(
    'SELECT status FROM usos_planos WHERE agendamento_id IN (?,?) ORDER BY agendamento_id',
    [completed.appointment.id, absent.appointment.id],
  );
  assert.deepEqual(
    rows.map((row) => row.status),
    ['consumido', 'consumido'],
  );
  const [commissions] = await pool.execute(
    `SELECT agendamento_id,tipo_cobranca,CAST(valor_base_snapshot AS CHAR) valor_base,
            CAST(percentual_snapshot AS CHAR) percentual,
            CAST(valor_comissao AS CHAR) valor_comissao
     FROM comissoes WHERE agendamento_id IN (?,?)`,
    [completed.appointment.id, absent.appointment.id],
  );
  assert.equal(commissions.length, 1);
  assert.equal(String(commissions[0].agendamento_id), String(completed.appointment.id));
  assert.deepEqual(
    [
      commissions[0].tipo_cobranca,
      commissions[0].valor_base,
      commissions[0].percentual,
      commissions[0].valor_comissao,
    ],
    ['plano', '30.00', '40.00', '12.00'],
  );
});

test('comissão avulsa usa preço snapshot e alteração posterior não muda histórico', async () => {
  const appointment = await booking(clientId, barberId, secondServiceId, dates[1], '11:00');
  assert.equal(appointment.appointment.tipoCobranca, 'avulso');
  const start = DateTime.fromISO(`${dates[1]}T11:00:00`, { zone }).toUTC();
  for (const status of ['confirmado', 'em_atendimento', 'concluido'])
    await statusService.updateStatus({
      id: appointment.appointment.id,
      userId: adminId,
      role: 'admin',
      nextStatus: status,
      nowUtc: start.plus({ minutes: 40 }).toJSDate(),
    });
  await commissionService.configurarComissao({
    barbeiroId: barberId,
    percentualAvulso: '60.00',
    percentualPlano: '45.00',
  });
  await pool.execute('UPDATE servicos SET preco=70.00 WHERE id=?', [secondServiceId]);
  const [[commission]] = await pool.execute(
    `SELECT tipo_cobranca,CAST(valor_base_snapshot AS CHAR) valor_base,
            CAST(percentual_snapshot AS CHAR) percentual,
            CAST(valor_comissao AS CHAR) valor_comissao
     FROM comissoes WHERE agendamento_id=?`,
    [appointment.appointment.id],
  );
  assert.deepEqual(
    [
      commission.tipo_cobranca,
      commission.valor_base,
      commission.percentual,
      commission.valor_comissao,
    ],
    ['avulso', '50.00', '50.00', '25.00'],
  );
  await pool.execute('UPDATE servicos SET preco=50.00 WHERE id=?', [secondServiceId]);
  await commissionService.configurarComissao({
    barbeiroId: barberId,
    percentualAvulso: '50.00',
    percentualPlano: '40.00',
  });
});

test('valor-base ausente no plano reverte conclusão e não inventa comissão', async () => {
  const appointment = await booking(clientId, barberId, serviceId, dates[1], '12:00');
  const start = DateTime.fromISO(`${dates[1]}T12:00:00`, { zone }).toUTC();
  for (const status of ['confirmado', 'em_atendimento'])
    await statusService.updateStatus({
      id: appointment.appointment.id,
      userId: adminId,
      role: 'admin',
      nextStatus: status,
      nowUtc: start.plus({ minutes: 40 }).toJSDate(),
    });
  await pool.execute(
    'UPDATE plano_servicos SET valor_base_comissao=NULL WHERE plano_id=? AND servico_id=?',
    [planId, serviceId],
  );
  await assert.rejects(
    () =>
      statusService.updateStatus({
        id: appointment.appointment.id,
        userId: adminId,
        role: 'admin',
        nextStatus: 'concluido',
        nowUtc: start.plus({ minutes: 45 }).toJSDate(),
      }),
    { code: 'PLAN_COMMISSION_BASE_MISSING' },
  );
  const [[stored]] = await pool.execute('SELECT status FROM agendamentos WHERE id=?', [
    appointment.appointment.id,
  ]);
  const [[commission]] = await pool.execute(
    'SELECT COUNT(*) total FROM comissoes WHERE agendamento_id=?',
    [appointment.appointment.id],
  );
  assert.equal(stored.status, 'em_atendimento');
  assert.equal(Number(commission.total), 0);
  await pool.execute(
    'UPDATE plano_servicos SET valor_base_comissao=30.00 WHERE plano_id=? AND servico_id=?',
    [planId, serviceId],
  );
});

test('cancelamento regular libera e reagendamento mantém, atualiza ou perde cobertura', async () => {
  const cancelled = await booking(clientId, barberId, serviceId, dates[2], '09:00');
  await cancellationService.cancel({
    id: cancelled.appointment.id,
    userId: clientId,
    role: 'cliente',
    reason: 'Mudança de agenda',
    nowUtc: baseDate.toUTC().toJSDate(),
  });
  const [[released]] = await pool.execute('SELECT status FROM usos_planos WHERE agendamento_id=?', [
    cancelled.appointment.id,
  ]);
  assert.equal(released.status, 'liberado');

  const rescheduled = await booking(clientId, barberId, serviceId, dates[0], '13:00');
  await rescheduleService.reschedule({
    id: rescheduled.appointment.id,
    userId: clientId,
    role: 'cliente',
    payload: { data: dates[0], horaInicio: '14:00' },
    nowUtc: baseDate.minus({ days: 1 }).toUTC().toJSDate(),
  });
  let [[sameWeekUsage]] = await pool.execute(
    'SELECT id,status FROM usos_planos WHERE agendamento_id=?',
    [rescheduled.appointment.id],
  );
  assert.equal(sameWeekUsage.status, 'reservado');
  await rescheduleService.reschedule({
    id: rescheduled.appointment.id,
    userId: clientId,
    role: 'cliente',
    payload: { data: dates[1], horaInicio: '13:00' },
    nowUtc: baseDate.minus({ days: 1 }).toUTC().toJSDate(),
  });
  let [[usage]] = await pool.execute(
    'SELECT id,status,data_utilizacao,semana_inicio FROM usos_planos WHERE agendamento_id=?',
    [rescheduled.appointment.id],
  );
  assert.equal(usage.status, 'reservado');
  assert.equal(String(usage.id), String(sameWeekUsage.id));
  assert.equal(
    DateTime.fromJSDate(new Date(usage.data_utilizacao), { zone: 'utc' }).toFormat('yyyy-MM-dd'),
    dates[1],
  );

  await rescheduleService.reschedule({
    id: rescheduled.appointment.id,
    userId: clientId,
    role: 'cliente',
    payload: { data: dates[4], horaInicio: '13:00' },
    nowUtc: baseDate.minus({ days: 1 }).toUTC().toJSDate(),
  });
  [[usage]] = await pool.execute('SELECT status FROM usos_planos WHERE agendamento_id=?', [
    rescheduled.appointment.id,
  ]);
  const [[appointment]] = await pool.execute(
    'SELECT tipo_cobranca,assinatura_plano_id FROM agendamentos WHERE id=?',
    [rescheduled.appointment.id],
  );
  assert.equal(usage.status, 'liberado');
  assert.equal(appointment.tipo_cobranca, 'avulso');
  assert.equal(appointment.assinatura_plano_id, null);
});

async function validateWith(validators, body) {
  const request = { body, params: { id: '1' } };
  for (const validator of validators) await validator.run(request);
  return validationResult(request);
}

test('cancelamento distingue cliente e barbearia com idempotência e rollback', async () => {
  await pool.execute(
    `UPDATE assinaturas_planos SET possui_limite_semanal_snapshot=FALSE,
     limite_semanal_snapshot=NULL,possui_limite_total_snapshot=FALSE,
     limite_total_snapshot=NULL WHERE id=?`,
    [subscriptionId],
  );
  const nowRegular = baseDate.minus({ days: 1 }).toUTC().toJSDate();
  const lateAt = (date, hour) =>
    DateTime.fromISO(`${date}T${hour}:00`, { zone }).minus({ hours: 1 }).toUTC().toJSDate();
  const usageStatus = async (appointmentId) => {
    const [[row]] = await pool.execute('SELECT status FROM usos_planos WHERE agendamento_id=?', [
      appointmentId,
    ]);
    return row?.status ?? null;
  };

  const regular = await booking(clientId, barberId, serviceId, dates[2], '10:00');
  await cancellationService.cancel({
    id: regular.appointment.id,
    userId: clientId,
    role: 'cliente',
    reason: 'Cancelamento antecipado',
    responsibility: 'cliente',
    nowUtc: nowRegular,
  });
  assert.equal(await usageStatus(regular.appointment.id), 'liberado');

  const lateClient = await booking(clientId, barberId, serviceId, dates[2], '11:00');
  await cancellationService.cancel({
    id: lateClient.appointment.id,
    userId: clientId,
    role: 'cliente',
    reason: 'Cancelamento tardio',
    responsibility: 'cliente',
    nowUtc: lateAt(dates[2], '11:00'),
  });
  assert.equal(await usageStatus(lateClient.appointment.id), 'consumido');

  const lateAdminClient = await booking(clientId, barberId, serviceId, dates[2], '12:00');
  await cancellationService.cancel({
    id: lateAdminClient.appointment.id,
    userId: adminId,
    role: 'admin',
    reason: 'Responsabilidade do cliente',
    responsibility: 'cliente',
    nowUtc: lateAt(dates[2], '12:00'),
  });
  assert.equal(await usageStatus(lateAdminClient.appointment.id), 'consumido');

  const shop = await booking(clientId, barberId, serviceId, dates[2], '14:00');
  const shopCancellation = {
    id: shop.appointment.id,
    userId: adminId,
    role: 'admin',
    reason: 'Barbeiro indisponível',
    responsibility: 'barbearia',
    nowUtc: lateAt(dates[2], '14:00'),
  };
  await cancellationService.cancel(shopCancellation);
  await cancellationService.cancel(shopCancellation);
  assert.equal(await usageStatus(shop.appointment.id), 'liberado');
  const [[shopHistory]] = await pool.execute(
    `SELECT COUNT(*) total,MAX(dados_novos) dados FROM historico_agendamentos
     WHERE agendamento_id=? AND tipo_evento='cancelado'`,
    [shop.appointment.id],
  );
  assert.equal(Number(shopHistory.total), 1);
  const historyData =
    typeof shopHistory.dados === 'string' ? JSON.parse(shopHistory.dados) : shopHistory.dados;
  assert.equal(historyData.responsabilidade, 'barbearia');

  const missingReason = await booking(clientId, barberId, serviceId, dates[2], '15:00');
  await assert.rejects(
    cancellationService.cancel({
      id: missingReason.appointment.id,
      userId: adminId,
      role: 'admin',
      responsibility: 'barbearia',
      nowUtc: lateAt(dates[2], '15:00'),
    }),
    { code: 'VALIDATION_ERROR' },
  );
  await assert.rejects(
    cancellationService.cancel({
      id: missingReason.appointment.id,
      userId: adminId,
      role: 'admin',
      reason: 'Motivo válido',
      responsibility: 'terceiro',
      nowUtc: lateAt(dates[2], '15:00'),
    }),
    { code: 'VALIDATION_ERROR' },
  );
  assert.equal(await usageStatus(missingReason.appointment.id), 'reservado');

  assert.equal(
    (
      await validateWith(adminCancelValidator, {
        motivo: 'Motivo válido',
        responsabilidade: 'terceiro',
      })
    ).isEmpty(),
    false,
  );
  assert.equal(
    (
      await validateWith(cancelAppointmentValidator, {
        motivo: 'Motivo válido',
        responsabilidade: 'barbearia',
      })
    ).isEmpty(),
    false,
  );
  const single = await booking(pendingClientId, barberId, serviceId, dates[2], '16:00');
  await cancellationService.cancel({
    id: single.appointment.id,
    userId: pendingClientId,
    role: 'cliente',
    reason: 'Cancelamento avulso',
    nowUtc: nowRegular,
  });
  assert.equal(await usageStatus(single.appointment.id), null);

  const rollback = await booking(clientId, barberId, serviceId, dates[2], '17:00');
  await assert.rejects(() =>
    cancellationService.cancel({
      id: rollback.appointment.id,
      userId: '999999999999',
      role: 'admin',
      reason: 'Falha transacional',
      responsibility: 'barbearia',
      nowUtc: lateAt(dates[2], '17:00'),
    }),
  );
  const [[rollbackAppointment]] = await pool.execute('SELECT status FROM agendamentos WHERE id=?', [
    rollback.appointment.id,
  ]);
  assert.equal(rollbackAppointment.status, 'pendente');
  assert.equal(await usageStatus(rollback.appointment.id), 'reservado');
});

test('limites, rollback, última cota concorrente e conflito de horário permanecem seguros', async () => {
  const weekStart = DateTime.fromISO(dates[2])
    .minus({ days: DateTime.fromISO(dates[2]).weekday - 1 })
    .toFormat('yyyy-MM-dd');
  const [[weeklyCount]] = await pool.execute(
    `SELECT COUNT(*) total FROM usos_planos
     WHERE assinatura_id=? AND semana_inicio=? AND status IN ('reservado','consumido')`,
    [subscriptionId, weekStart],
  );
  await pool.execute(
    `UPDATE assinaturas_planos SET possui_limite_semanal_snapshot=TRUE,
     limite_semanal_snapshot=?,possui_limite_total_snapshot=TRUE,
     limite_total_snapshot=50 WHERE id=?`,
    [Number(weeklyCount.total) + 1, subscriptionId],
  );
  const weeklyCovered = await booking(clientId, barberId, serviceId, dates[2], '13:00');
  const weeklySingle = await booking(clientId, secondBarberId, serviceId, dates[2], '13:00');
  assert.equal(weeklyCovered.appointment.tipoCobranca, 'plano');
  assert.equal(weeklySingle.appointment.tipoCobranca, 'avulso');

  const [[counts]] = await pool.execute(
    `SELECT COUNT(*) total FROM usos_planos
     WHERE assinatura_id=? AND status IN ('reservado','consumido')`,
    [subscriptionId],
  );
  await pool.execute(
    `UPDATE assinaturas_planos SET possui_limite_semanal_snapshot=FALSE,
     limite_semanal_snapshot=NULL,possui_limite_total_snapshot=TRUE,
     limite_total_snapshot=? WHERE id=?`,
    [Number(counts.total) + 1, subscriptionId],
  );
  const before = Number(counts.total);
  const attempts = await Promise.all([
    booking(clientId, barberId, serviceId, dates[2], '14:00'),
    booking(clientId, secondBarberId, serviceId, dates[2], '15:00'),
  ]);
  assert.equal(attempts.filter((item) => item.appointment.tipoCobranca === 'plano').length, 1);
  assert.equal(attempts.filter((item) => item.appointment.tipoCobranca === 'avulso').length, 1);

  const beforeRollback = await pool.execute('SELECT COUNT(*) total FROM usos_planos');
  await assert.rejects(() =>
    appointmentService.createAdmin({
      userId: '999999999999',
      payload: {
        clienteId: clientId,
        barbeiroId: barberId,
        servicoId: serviceId,
        data: dates[3],
        horaInicio: '16:00',
      },
      key: randomUUID(),
    }),
  );
  const [[afterRollback]] = await pool.execute('SELECT COUNT(*) total FROM usos_planos');
  assert.equal(Number(afterRollback.total), Number(beforeRollback[0][0].total));

  const sameSlot = await Promise.allSettled([
    booking(clientId, barberId, serviceId, dates[3], '14:00'),
    booking(pendingClientId, barberId, serviceId, dates[3], '14:00'),
  ]);
  assert.equal(sameSlot.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(sameSlot.filter((item) => item.status === 'rejected').length, 1);
  assert.ok(before >= 1);
});
