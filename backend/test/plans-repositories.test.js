import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';

process.env.NODE_ENV = 'test';

const keyHash = createHash('sha256').update('key-1').digest();
const payloadHash = createHash('sha256')
  .update(JSON.stringify({ op: 'solicitacao' }))
  .digest();

const { pool } = await import('../src/config/database.js');
const planoRepository = await import('../src/repositories/planoRepository.js');
const assinaturaRepository = await import('../src/repositories/assinaturaPlanoRepository.js');
const pagamentoRepository = await import('../src/repositories/pagamentoPlanoRepository.js');
const usoRepository = await import('../src/repositories/usoPlanoRepository.js');
const historicoRepository = await import('../src/repositories/historicoPlanoRepository.js');

const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
const marker = `P3-${suffix}`;

const ids = {
  admin: null,
  barberUser: null,
  client: null,
  barber: null,
  service: null,
  plan: null,
  subscription: null,
};

const pagination = { limit: 20, offset: 0, sortColumn: 'id', order: 'desc' };

async function insertUser(nome, perfil) {
  const [result] = await pool.execute(
    'INSERT INTO usuarios (nome, email, telefone, senha_hash, perfil) VALUES (?, ?, ?, ?, ?)',
    [
      `${marker} ${nome}`,
      `${marker}-${nome}@example.test`,
      `8${String(Date.now() + Math.random())
        .replace(/\D/g, '')
        .slice(-9)}`,
      'hash-nao-utilizado',
      perfil,
    ],
  );
  return result.insertId;
}

async function insertService() {
  const [result] = await pool.execute(
    'INSERT INTO servicos (nome, preco, duracao_minutos) VALUES (?, 40.00, 30)',
    [`${marker} Serviço`],
  );
  return result.insertId;
}

async function insertBarber() {
  const [result] = await pool.execute('INSERT INTO barbeiros (usuario_id) VALUES (?)', [
    ids.barberUser,
  ]);
  return result.insertId;
}

async function insertAppointment() {
  // Migration 014 impõe snapshots: fim_em = inicio_em + duracao_minutos
  // e fim_ocupacao_em = fim_em + buffer_minutos.
  const [result] = await pool.execute(
    `INSERT INTO agendamentos (
       cliente_id, barbeiro_id, servico_id, criado_por, origem,
       inicio_em, fim_em, fim_ocupacao_em, preco, duracao_minutos,
       buffer_minutos, status
     ) VALUES (?, ?, ?, ?, 'admin', ?, ?, ?, 40.00, 30, 10, 'confirmado')`,
    [
      ids.client,
      ids.barber,
      ids.service,
      ids.admin,
      new Date('2026-08-10T12:00:00.000Z'),
      new Date('2026-08-10T12:30:00.000Z'),
      new Date('2026-08-10T12:40:00.000Z'),
    ],
  );
  return result.insertId;
}

function planData(overrides = {}) {
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
    ativo: true,
    adesoesAbertas: true,
    actorId: ids.admin,
    ...overrides,
  };
}

test.before(async () => {
  ids.admin = await insertUser('Admin', 'admin');
  ids.client = await insertUser('Cliente', 'cliente');
  ids.barberUser = await insertUser('Barbeiro', 'barbeiro');
  ids.barber = await insertBarber();
  ids.service = await insertService();
});

test.after(async () => {
  // Ordem correta de remoção, restrita ao prefixo de teste (marker).
  await pool.execute(
    `DELETE h FROM historico_planos h
     WHERE h.plano_id = ? OR h.assinatura_id = ?`,
    [ids.plan, ids.subscription],
  );
  await pool.execute('DELETE FROM usos_planos WHERE assinatura_id = ?', [ids.subscription]);
  await pool.execute('DELETE FROM pagamentos_planos WHERE assinatura_id = ?', [ids.subscription]);
  await pool.execute('DELETE FROM assinatura_plano_servicos WHERE assinatura_id = ?', [
    ids.subscription,
  ]);
  await pool.execute('DELETE FROM assinatura_plano_barbeiros WHERE assinatura_id = ?', [
    ids.subscription,
  ]);
  await pool.execute('DELETE FROM assinaturas_planos WHERE id = ?', [ids.subscription]);
  await pool.execute('DELETE FROM plano_servicos WHERE plano_id = ?', [ids.plan]);
  await pool.execute('DELETE FROM plano_barbeiros WHERE plano_id = ?', [ids.plan]);
  await pool.execute('DELETE FROM planos WHERE id = ?', [ids.plan]);
  await pool.execute('DELETE FROM agendamentos WHERE cliente_id = ?', [ids.client]);
  await pool.execute('DELETE FROM servicos WHERE id = ?', [ids.service]);
  await pool.execute('DELETE FROM barbeiros WHERE id = ?', [ids.barber]);
  await pool.execute('DELETE FROM usuarios WHERE id IN (?, ?, ?)', [
    ids.admin,
    ids.client,
    ids.barberUser,
  ]);
  await pool.end();
});

test('plano oferece CRUD com projeção, links e checagem de nome duplicado', async () => {
  ids.plan = await planoRepository.criarPlano(planData(), pool);
  assert.ok(ids.plan > 0);

  const criado = await planoRepository.buscarPlanoPorId(ids.plan);
  assert.equal(criado.nome, `${marker} Plano`);
  assert.equal(criado.preco, '99.90');

  const duplicado = await planoRepository.verificarNomeDuplicado(`${marker} Plano`);
  assert.equal(duplicado, ids.plan);

  const semDuplicado = await planoRepository.verificarNomeDuplicado(`${marker} Outro`);
  assert.equal(semDuplicado, null);
});

test('plano público lista apenas ativos com adesões abertas dentro do período', async () => {
  const { rows } = await planoRepository.listarPlanosPublicos(
    { search: marker, date: '2026-09-15', pagination },
    pool,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, ids.plan);

  const fechado = planData({ nome: `${marker} Fechado`, adesoesAbertas: false });
  const fechadoId = await planoRepository.criarPlano(fechado, pool);
  const { rows: rowsBarrados } = await planoRepository.listarPlanosPublicos(
    { search: marker, date: '2026-09-15', pagination },
    pool,
  );
  assert.equal(rowsBarrados.length, 1);
  await pool.execute('DELETE FROM plano_servicos WHERE plano_id = ?', [fechadoId]);
  await pool.execute('DELETE FROM plano_barbeiros WHERE plano_id = ?', [fechadoId]);
  await pool.execute('DELETE FROM planos WHERE id = ?', [fechadoId]);
});

test('plano sincroniza vínculos de serviço e barbeiro', async () => {
  await planoRepository.substituirServicos(ids.plan, [ids.service], pool);
  await planoRepository.substituirBarbeiros(ids.plan, [ids.barber], pool);

  const servicos = await planoRepository.listarServicosDoPlano(ids.plan, pool);
  assert.equal(servicos.length, 1);
  assert.equal(servicos[0].id, ids.service);

  const barbeiros = await planoRepository.listarBarbeirosDoPlano(ids.plan, pool);
  assert.equal(barbeiros.length, 1);
  assert.equal(barbeiros[0].id, ids.barber);
});

test('plano atualiza status, adesões e uso', async () => {
  await planoRepository.atualizarStatus(ids.plan, 'ativo', false, ids.admin, pool);
  let plano = await planoRepository.buscarPlanoPorId(ids.plan);
  assert.equal(Boolean(plano.ativo), false);
  await planoRepository.atualizarStatus(ids.plan, 'ativo', true, ids.admin, pool);

  await planoRepository.atualizarAdesoes(ids.plan, false, ids.admin, pool);
  plano = await planoRepository.buscarPlanoPorId(ids.plan);
  assert.equal(Boolean(plano.adesoes_abertas), false);
  await planoRepository.atualizarAdesoes(ids.plan, true, ids.admin, pool);

  await planoRepository.atualizarUso(
    ids.plan,
    { status: 'suspenso', motivo: 'Manutenção', actorId: ids.admin, now: new Date() },
    pool,
  );
  plano = await planoRepository.buscarPlanoPorId(ids.plan);
  assert.equal(plano.uso_status, 'suspenso');
  assert.equal(plano.uso_suspensao_motivo, 'Manutenção');
  await planoRepository.atualizarUso(
    ids.plan,
    { status: 'permitido', motivo: null, actorId: ids.admin, now: new Date() },
    pool,
  );
});

test('plano lista por período e conta assinantes', async () => {
  const porPeriodo = await planoRepository.buscarPlanosPorPeriodo({
    inicio: '2026-09-01',
    fim: '2026-09-30',
    pool,
  });
  assert.equal(porPeriodo.find((plano) => plano.id === ids.plan)?.id, ids.plan);

  const fora = await planoRepository.buscarPlanosPorPeriodo({
    inicio: '2027-01-01',
    fim: '2027-01-31',
    pool,
  });
  assert.equal(
    fora.find((p) => p.id === ids.plan),
    undefined,
  );

  const assinantes = await planoRepository.contarAssinantes(ids.plan, pool);
  assert.equal(assinantes, 0);
});

test('assinatura cria com snapshots e previne sobreposição', async () => {
  const subId = await assinaturaRepository.criarAssinatura(
    {
      planId: ids.plan,
      clientId: ids.client,
      start: '2026-08-01',
      end: '2026-08-31',
      planName: `${marker} Plano`,
      price: '99.90',
      hasWeekly: true,
      weekly: 2,
      hasTotal: true,
      total: 8,
      timezone: 'America/Recife',
      actorId: ids.admin,
      keyHash,
      payloadHash,
    },
    pool,
  );
  ids.subscription = subId;
  assert.ok(subId > 0);

  const servicos = [{ id: ids.service, nome: `${marker} Serviço` }];
  const barbeiros = [{ id: ids.barber, nome: `${marker} Barbeiro` }];
  await assinaturaRepository.inserirServicosSnapshot(subId, servicos, pool);
  await assinaturaRepository.inserirBarbeirosSnapshot(subId, barbeiros, pool);

  const snapServicos = await assinaturaRepository.listarServicosSnapshot(subId, pool);
  assert.equal(snapServicos.length, 1);
  assert.equal(snapServicos[0].nome, `${marker} Serviço`);

  const snapBarbeiros = await assinaturaRepository.listarBarbeirosSnapshot(subId, pool);
  assert.equal(snapBarbeiros.length, 1);
  assert.equal(snapBarbeiros[0].nome, `${marker} Barbeiro`);

  assert.equal(await assinaturaRepository.hasService(subId, ids.service), true);
  assert.equal(await assinaturaRepository.hasBarber(subId, ids.barber), true);

  const sobreposicao = await assinaturaRepository.buscarSobreposicao(
    ids.client,
    '2026-08-15',
    '2026-08-20',
    pool,
  );
  assert.equal(sobreposicao.length, 1);
});

test('assinatura busca por idempotência, ativa, snapshots e atualiza status', async () => {
  const porChave = await assinaturaRepository.buscarPorIdempotencyKey(ids.client, keyHash, pool);
  assert.equal(porChave.id, ids.subscription);

  const meuPlano = await assinaturaRepository.buscarMeuPlano(ids.client, pool);
  assert.equal(meuPlano.id, ids.subscription);

  await assinaturaRepository.atualizarStatus(
    ids.subscription,
    'ativa',
    {
      actorId: ids.admin,
      motivo: null,
      now: new Date(),
    },
    pool,
  );
  const ativa = await assinaturaRepository.buscarAssinaturaPorId(ids.subscription, pool);
  assert.equal(ativa.status, 'ativa');
  assert.ok(ativa.ativada_em);

  const ativaDoCliente = await assinaturaRepository.buscarAssinaturaAtivaDoCliente(
    ids.client,
    '2026-08-15',
    pool,
  );
  assert.equal(ativaDoCliente.id, ids.subscription);

  await assinaturaRepository.salvarHashesIdempotencia(
    ids.subscription,
    { keyHash, payloadHash },
    pool,
  );
});

test('pagamento cria pendente, confirma, cancela e verifica por data', async () => {
  const pagamentoId = await pagamentoRepository.criarPagamentoPendente(
    {
      subscriptionId: ids.subscription,
      reference: '2026-08-01',
      start: '2026-08-01',
      end: '2026-08-31',
      value: '99.90',
    },
    pool,
  );
  assert.ok(pagamentoId > 0);

  const pendente = await pagamentoRepository.buscarPagamentoPorId(pagamentoId, pool);
  assert.equal(pendente.status, 'pendente');

  const porRef = await pagamentoRepository.buscarPorAssinaturaEReferencia(
    ids.subscription,
    '2026-08-01',
    pool,
  );
  assert.equal(porRef.id, pagamentoId);

  const confirmado = await pagamentoRepository.confirmarPagamento(
    pagamentoId,
    {
      actorId: ids.admin,
      now: new Date(),
    },
    pool,
  );
  assert.equal(confirmado, true);
  const repetido = await pagamentoRepository.confirmarPagamento(
    pagamentoId,
    {
      actorId: ids.admin,
      now: new Date(),
    },
    pool,
  );
  assert.equal(repetido, false);

  const porData = await pagamentoRepository.verificarPagamentoConfirmadoParaData(
    ids.subscription,
    '2026-08-15',
    pool,
  );
  assert.equal(porData.id, pagamentoId);

  const listagem = await pagamentoRepository.listarPagamentosDaAssinatura(ids.subscription, pool);
  assert.equal(listagem.length, 1);

  const cancelado = await pagamentoRepository.cancelarPagamento(
    pagamentoId,
    {
      actorId: ids.admin,
      now: new Date(),
      motivo: 'Ajuste',
    },
    pool,
  );
  assert.equal(cancelado, false);
});

test('uso reserva, conta ocupação, consumo e reagenda de período', async () => {
  const appointmentId = await insertAppointment();
  const week = '2026-08-10';
  const usoId = await usoRepository.criarUsoReservado(
    { subscriptionId: ids.subscription, appointmentId, date: '2026-08-10', week },
    pool,
  );
  assert.ok(usoId > 0);

  const duplicado = await usoRepository.verificarUsoDuplicado(
    ids.subscription,
    appointmentId,
    pool,
  );
  assert.equal(duplicado, usoId);

  const porAgendamento = await usoRepository.buscarUsoPorAgendamento(appointmentId, pool);
  assert.equal(porAgendamento.id, usoId);

  assert.equal(await usoRepository.contarUsosTotal(ids.subscription, pool), 1);
  assert.equal(await usoRepository.contarUsosSemana(ids.subscription, week, pool), 1);

  await usoRepository.atualizarPeriodoDoUso(
    usoId,
    { date: '2026-08-11', week: '2026-08-10' },
    pool,
  );
  const atualizado = await usoRepository.buscarUsoPorAgendamento(appointmentId, pool);
  assert.equal(new Date(atualizado.data_utilizacao).toISOString().slice(0, 10), '2026-08-11');

  const consumido = await usoRepository.consumirUso(usoId, new Date(), pool);
  assert.equal(consumido, true);
  assert.equal(await usoRepository.contarUsosTotal(ids.subscription, pool), 1);

  assert.equal((await usoRepository.listarUsosAtivos(ids.subscription, pool)).length, 1);
  assert.equal((await usoRepository.listarUsosDaAssinatura(ids.subscription, pool)).length, 1);

  await pool.execute('DELETE FROM usos_planos WHERE id = ?', [usoId]);
  await pool.execute('DELETE FROM agendamentos WHERE id = ?', [appointmentId]);
});

test('uso libera e deixa de contar na ocupação', async () => {
  const appointmentId = await insertAppointment();
  const week = '2026-08-10';
  const usoId = await usoRepository.criarUsoReservado(
    { subscriptionId: ids.subscription, appointmentId, date: '2026-08-10', week },
    pool,
  );
  assert.ok(usoId > 0);
  assert.equal(await usoRepository.contarUsosTotal(ids.subscription, pool), 1);

  const liberado = await usoRepository.liberarUso(
    usoId,
    {
      now: new Date(),
      motivo: 'Reagendado para fora da cobertura',
    },
    pool,
  );
  assert.equal(liberado, true);
  assert.equal(await usoRepository.contarUsosTotal(ids.subscription, pool), 0);

  await pool.execute('DELETE FROM usos_planos WHERE id = ?', [usoId]);
  await pool.execute('DELETE FROM agendamentos WHERE id = ?', [appointmentId]);
});

test('histórico registra evento e lista por entidade sem dados sensíveis', async () => {
  const evento = await historicoRepository.registrarEvento(
    {
      planId: ids.plan,
      subscriptionId: ids.subscription,
      type: 'plano_criado',
      actorId: ids.admin,
      note: 'Plano criado',
      after: { nome: `${marker} Plano`, preco: '99.90' },
    },
    pool,
  );
  assert.ok(evento > 0);

  const doPlano = await historicoRepository.listarHistoricoDoPlano(ids.plan, pool);
  assert.equal(doPlano.length, 1);
  assert.equal(doPlano[0].tipo_evento, 'plano_criado');

  const daAssinatura = await historicoRepository.listarHistoricoDaAssinatura(
    ids.subscription,
    pool,
  );
  assert.equal(daAssinatura.length, 1);

  const serializado = JSON.stringify(doPlano[0]);
  assert.equal(serializado.includes('senha'), false);
  assert.equal(serializado.includes('jwt'), false);

  await pool.execute('DELETE FROM historico_planos WHERE id = ?', [evento]);
});
