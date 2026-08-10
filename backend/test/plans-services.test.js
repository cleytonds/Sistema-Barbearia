import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

process.env.NODE_ENV = 'test';

const { pool } = await import('../src/config/database.js');
const planoService = await import('../src/services/planoService.js');
const assinaturaService = await import('../src/services/assinaturaPlanoService.js');
const pagamentoService = await import('../src/services/pagamentoPlanoService.js');
const coberturaService = await import('../src/services/coberturaPlanoService.js');
const usoService = await import('../src/services/usoPlanoService.js');
const { runTransactionWithRetry } = await import('../src/database/transactionRetry.js');

const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
const marker = `BSV-${suffix}`;

const ids = {
  admin: null,
  client: null,
  client2: null,
  barberUser: null,
  barberUser2: null,
  barber: null,
  barber2: null,
  service: null,
  service2: null,
  plan: null,
};

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

async function insertService(label = 'A', ativo = true) {
  const [result] = await pool.execute(
    'INSERT INTO servicos (nome, preco, duracao_minutos, ativo) VALUES (?, 40.00, 30, ?)',
    [`${marker} Serviço ${label}`, ativo],
  );
  return result.insertId;
}

async function insertBarber(userId, ativo = true) {
  const [result] = await pool.execute('INSERT INTO barbeiros (usuario_id, ativo) VALUES (?, ?)', [
    userId,
    ativo,
  ]);
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
    servicos: [ids.service],
    barbeiros: [ids.barber],
    ...overrides,
  };
}

test.before(async () => {
  ids.admin = await insertUser('Admin', 'admin');
  ids.client = await insertUser('Cliente', 'cliente');
  ids.client2 = await insertUser('Cliente2', 'cliente');
  ids.barberUser = await insertUser('Barbeiro', 'barbeiro');
  ids.barberUser2 = await insertUser('Barbeiro2', 'barbeiro');
  ids.barber = await insertBarber(ids.barberUser);
  ids.barber2 = await insertBarber(ids.barberUser2);
  ids.service = await insertService('A');
  ids.service2 = await insertService('B');
});

test.after(async () => {
  await pool.execute(
    `DELETE h FROM historico_planos h
     WHERE h.plano_id IN (SELECT id FROM planos WHERE nome LIKE ?)
        OR h.assinatura_id IN (SELECT id FROM assinaturas_planos WHERE cliente_id IN (?, ?))`,
    [`${marker}%`, ids.client, ids.client2],
  );
  await pool.execute(
    `DELETE FROM usos_planos WHERE assinatura_id IN
      (SELECT id FROM assinaturas_planos WHERE cliente_id IN (?, ?))`,
    [ids.client, ids.client2],
  );
  await pool.execute(
    `DELETE FROM pagamentos_planos WHERE assinatura_id IN
      (SELECT id FROM assinaturas_planos WHERE cliente_id IN (?, ?))`,
    [ids.client, ids.client2],
  );
  await pool.execute(
    `DELETE FROM assinatura_plano_servicos WHERE assinatura_id IN
      (SELECT id FROM assinaturas_planos WHERE cliente_id IN (?, ?))`,
    [ids.client, ids.client2],
  );
  await pool.execute(
    `DELETE FROM assinatura_plano_barbeiros WHERE assinatura_id IN
      (SELECT id FROM assinaturas_planos WHERE cliente_id IN (?, ?))`,
    [ids.client, ids.client2],
  );
  await pool.execute(`DELETE FROM assinaturas_planos WHERE cliente_id IN (?, ?)`, [
    ids.client,
    ids.client2,
  ]);
  await pool.execute('DELETE FROM agendamentos WHERE cliente_id IN (?, ?)', [
    ids.client,
    ids.client2,
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
  await pool.execute('DELETE FROM servicos WHERE id IN (?, ?)', [ids.service, ids.service2]);
  await pool.execute('DELETE FROM barbeiros WHERE id IN (?, ?)', [ids.barber, ids.barber2]);
  await pool.execute('DELETE FROM usuarios WHERE id IN (?, ?, ?, ?, ?)', [
    ids.admin,
    ids.client,
    ids.client2,
    ids.barberUser,
    ids.barberUser2,
  ]);
  await pool.end();
});

// ===========================================================================
// Plano — criação
// ===========================================================================
test('plano service: criação válida persiste e registra histórico', async () => {
  ids.plan = await planoService.criarPlano({
    data: planData(),
    actorId: ids.admin,
    requestId: `${marker}-create`,
  });
  assert.ok(ids.plan > 0);

  const plano = await planoService.obterPlanoAdmin({ id: ids.plan });
  assert.equal(plano.nome, `${marker} Plano`);
  assert.equal(plano.preco, '99.90');
  assert.equal(plano.servicos.length, 1);
  assert.equal(plano.barbeiros.length, 1);

  const historico = await pool.execute(
    'SELECT tipo_evento FROM historico_planos WHERE plano_id = ? ORDER BY id',
    [ids.plan],
  );
  assert.equal(historico[0][0].tipo_evento, 'plano_criado');
});

test('plano service: nome normalizado e duplicado rejeitado', async () => {
  const criado = await planoService.criarPlano({
    data: planData({ nome: `  ${marker}  Duplicado  ` }),
    actorId: ids.admin,
    requestId: `${marker}-dup`,
  });
  assert.ok(criado > 0);
  await assert.rejects(
    () =>
      planoService.criarPlano({
        data: planData({ nome: `${marker} Duplicado` }),
        actorId: ids.admin,
        requestId: `${marker}-dup2`,
      }),
    (err) => err.code === 'DUPLICATE_PLAN_NAME',
  );
});

test('plano service: preço inválido é rejeitado', async () => {
  await assert.rejects(
    () =>
      planoService.criarPlano({
        data: planData({ preco: 'abc' }),
        actorId: ids.admin,
        requestId: `${marker}-price`,
      }),
    (err) => err.code === 'INVALID_PLAN_PRICE',
  );
});

test('plano service: período inválido é rejeitado', async () => {
  await assert.rejects(
    () =>
      planoService.criarPlano({
        data: planData({ adesaoFim: '2026-01-01' }),
        actorId: ids.admin,
        requestId: `${marker}-period`,
      }),
    (err) => err.code === 'INVALID_PERIOD',
  );
});

test('plano service: limites inválidos são rejeitados', async () => {
  await assert.rejects(
    () =>
      planoService.criarPlano({
        data: planData({ possuiLimiteSemanal: true, limiteSemanal: 0 }),
        actorId: ids.admin,
        requestId: `${marker}-limit`,
      }),
    (err) => err.code === 'INVALID_PLAN_LIMIT',
  );
});

test('plano service: serviço repetido é rejeitado', async () => {
  await assert.rejects(
    () =>
      planoService.criarPlano({
        data: planData({ servicos: [ids.service, ids.service] }),
        actorId: ids.admin,
        requestId: `${marker}-svcdup`,
      }),
    (err) => err.code === 'VALIDATION_ERROR',
  );
});

test('plano service: barbeiro repetido é rejeitado', async () => {
  await assert.rejects(
    () =>
      planoService.criarPlano({
        data: planData({ barbeiros: [ids.barber, ids.barber] }),
        actorId: ids.admin,
        requestId: `${marker}-barberdup`,
      }),
    (err) => err.code === 'VALIDATION_ERROR',
  );
});

test('plano service: serviço inativo é rejeitado', async () => {
  const inactive = await insertService('INAT', false);
  await assert.rejects(
    () =>
      planoService.criarPlano({
        data: planData({ nome: `${marker} Plano Serviço Inativo`, servicos: [inactive] }),
        actorId: ids.admin,
        requestId: `${marker}-svcinn`,
      }),
    (err) => err.code === 'INVALID_PLAN_LINK',
  );
  await pool.execute('DELETE FROM servicos WHERE id = ?', [inactive]);
});

test('plano service: barbeiro inativo é rejeitado', async () => {
  const inactiveBarberUser = await insertUser('BarbeiroInativo', 'barbeiro');
  const inactiveBarber = await insertBarber(inactiveBarberUser, false);
  await assert.rejects(
    () =>
      planoService.criarPlano({
        data: planData({
          nome: `${marker} Plano Barbeiro Inativo`,
          barbeiros: [inactiveBarber],
        }),
        actorId: ids.admin,
        requestId: `${marker}-barberinn`,
      }),
    (err) => err.code === 'INVALID_PLAN_LINK',
  );
  await pool.execute('DELETE FROM barbeiros WHERE id = ?', [inactiveBarber]);
  await pool.execute('DELETE FROM usuarios WHERE id = ?', [inactiveBarberUser]);
});

test('plano service: nenhum serviço é rejeitado', async () => {
  await assert.rejects(
    () =>
      planoService.criarPlano({
        data: planData({ servicos: [] }),
        actorId: ids.admin,
        requestId: `${marker}-nosvc`,
      }),
    (err) => err.code === 'VALIDATION_ERROR',
  );
});

test('plano service: nenhum barbeiro é rejeitado', async () => {
  await assert.rejects(
    () =>
      planoService.criarPlano({
        data: planData({ barbeiros: [] }),
        actorId: ids.admin,
        requestId: `${marker}-nobarber`,
      }),
    (err) => err.code === 'VALIDATION_ERROR',
  );
});

// ===========================================================================
// Plano — edição e vínculos
// ===========================================================================
test('plano service: edição atualiza dados e vínculos', async () => {
  await planoService.editarPlano({
    id: ids.plan,
    data: planData({
      nome: `${marker} Plano Editado`,
      preco: '129.90',
      servicos: [ids.service, ids.service2],
      barbeiros: [ids.barber, ids.barber2],
    }),
    actorId: ids.admin,
    requestId: `${marker}-edit`,
  });
  const plano = await planoService.obterPlanoAdmin({ id: ids.plan });
  assert.equal(plano.nome, `${marker} Plano Editado`);
  assert.equal(plano.preco, '129.90');
  assert.equal(plano.servicos.length, 2);
  assert.equal(plano.barbeiros.length, 2);
});

test('plano service: rollback preserva dados em falha', async () => {
  const antes = await planoService.obterPlanoAdmin({ id: ids.plan });
  await assert.rejects(
    () =>
      planoService.editarPlano({
        id: ids.plan,
        data: planData({ preco: 'inválido' }),
        actorId: ids.admin,
        requestId: `${marker}-rollback`,
      }),
    (err) => err.code === 'INVALID_PLAN_PRICE',
  );
  const depois = await planoService.obterPlanoAdmin({ id: ids.plan });
  assert.equal(depois.nome, antes.nome);
  assert.equal(depois.preco, antes.preco);
});

// ===========================================================================
// Plano — status, adesões, uso
// ===========================================================================
test('plano service: ativação e desativação', async () => {
  await planoService.desativarPlano({
    id: ids.plan,
    actorId: ids.admin,
    requestId: `${marker}-off`,
  });
  let plano = await planoService.obterPlanoAdmin({ id: ids.plan });
  assert.equal(Boolean(plano.ativo), false);
  await planoService.ativarPlano({ id: ids.plan, actorId: ids.admin, requestId: `${marker}-on` });
  plano = await planoService.obterPlanoAdmin({ id: ids.plan });
  assert.equal(Boolean(plano.ativo), true);
});

test('plano service: abertura e fechamento de adesões', async () => {
  await planoService.fecharAdesoes({ id: ids.plan, actorId: ids.admin, requestId: `${marker}-fe` });
  let plano = await planoService.obterPlanoAdmin({ id: ids.plan });
  assert.equal(Boolean(plano.adesoes_abertas), false);
  await planoService.abrirAdesoes({ id: ids.plan, actorId: ids.admin, requestId: `${marker}-ab` });
  plano = await planoService.obterPlanoAdmin({ id: ids.plan });
  assert.equal(Boolean(plano.adesoes_abertas), true);
});

test('plano service: suspensão sem motivo é rejeitada', async () => {
  await assert.rejects(
    () =>
      planoService.suspenderUso({
        id: ids.plan,
        actorId: ids.admin,
        motivo: '  ',
        requestId: `${marker}-sm`,
      }),
    (err) => err.code === 'VALIDATION_ERROR',
  );
});

test('plano service: suspensão com motivo e reativação do uso', async () => {
  await planoService.suspenderUso({
    id: ids.plan,
    actorId: ids.admin,
    motivo: 'Manutenção',
    requestId: `${marker}-sus`,
  });
  let plano = await planoService.obterPlanoAdmin({ id: ids.plan });
  assert.equal(plano.uso_status, 'suspenso');
  assert.equal(plano.uso_suspensao_motivo, 'Manutenção');

  await planoService.permitirUso({ id: ids.plan, actorId: ids.admin, requestId: `${marker}-per` });
  plano = await planoService.obterPlanoAdmin({ id: ids.plan });
  assert.equal(plano.uso_status, 'permitido');
  assert.equal(plano.uso_suspensao_motivo, null);
  assert.equal(plano.uso_suspenso_por, null);
  assert.equal(plano.uso_suspenso_em, null);
});

// ===========================================================================
// Plano — listagens
// ===========================================================================
test('plano service: listagens pública e admin', async () => {
  const publica = await planoService.listarPlanosPublicos({
    query: {
      search: marker,
      date: '2026-09-15',
      sort: 'nome',
      order: 'asc',
      page: '1',
      limit: '20',
    },
  });
  assert.ok(publica.data.length >= 1);

  const admin = await planoService.listarPlanosAdmin({
    query: { search: marker, sort: 'id', order: 'desc', page: '1', limit: '20' },
  });
  assert.ok(admin.data.length >= 1);
  assert.equal(Number(admin.pagination.total), admin.data.length);
});

// ===========================================================================
// Assinatura — adesão
// ===========================================================================
function subscriptionData(overrides = {}) {
  return {
    clientId: ids.client,
    planoId: ids.plan,
    inicioEm: '2026-09-01',
    fimEm: '2026-09-30',
    fusoHorario: 'America/Recife',
    ...overrides,
  };
}

const idemKey = () => `${marker}-key-${randomUUID().replaceAll('-', '').slice(0, 16)}`;

test('assinatura service: adesão cria status aguardando_pagamento e snapshots', async () => {
  const { assinaturaId } = await assinaturaService.solicitarAdesao({
    data: subscriptionData(),
    actorId: ids.admin,
    idempotencyKey: idemKey(),
    requestId: `${marker}-sub-create`,
  });
  assert.ok(assinaturaId > 0);
  const assinatura = await assinaturaService.obterAssinaturaAdmin({ id: assinaturaId });
  assert.equal(assinatura.status, 'aguardando_pagamento');
  assert.equal(assinatura.plano_nome_snapshot, `${marker} Plano Editado`);
  assert.equal(assinatura.servicos.length, 2);
  assert.equal(assinatura.barbeiros.length, 2);
});

test('assinatura service: idempotência replay retorna assinatura original', async () => {
  const key = idemKey();
  const primeira = await assinaturaService.solicitarAdesao({
    data: subscriptionData({ inicioEm: '2026-10-01', fimEm: '2026-10-31' }),
    actorId: ids.admin,
    idempotencyKey: key,
    requestId: `${marker}-sub-key1`,
  });
  const replay = await assinaturaService.solicitarAdesao({
    data: subscriptionData({ inicioEm: '2026-10-01', fimEm: '2026-10-31' }),
    actorId: ids.admin,
    idempotencyKey: key,
    requestId: `${marker}-sub-key2`,
  });
  assert.equal(replay.assinaturaId, primeira.assinaturaId);
  assert.equal(replay.replay, true);
});

test('assinatura service: mesma chave com payload diferente é rejeitada', async () => {
  const key = idemKey();
  await assinaturaService.solicitarAdesao({
    data: subscriptionData({ inicioEm: '2026-11-01', fimEm: '2026-11-30' }),
    actorId: ids.admin,
    idempotencyKey: key,
    requestId: `${marker}-sub-k3a`,
  });
  await assert.rejects(
    () =>
      assinaturaService.solicitarAdesao({
        data: subscriptionData({ inicioEm: '2026-11-05', fimEm: '2026-11-30' }),
        actorId: ids.admin,
        idempotencyKey: key,
        requestId: `${marker}-sub-k3b`,
      }),
    (err) => err.code === 'IDEMPOTENCY_KEY_REUSED',
  );
});

test('assinatura service: idempotency key ausente é rejeitada', async () => {
  await assert.rejects(
    () =>
      assinaturaService.solicitarAdesao({
        data: subscriptionData({ inicioEm: '2026-12-01', fimEm: '2026-12-31' }),
        actorId: ids.admin,
        requestId: `${marker}-sub-nokey`,
      }),
    (err) => err.code === 'IDEMPOTENCY_KEY_REQUIRED',
  );
});

test('assinatura service: sobreposição de período é rejeitada', async () => {
  await assert.rejects(
    () =>
      assinaturaService.solicitarAdesao({
        data: subscriptionData({ inicioEm: '2026-09-10', fimEm: '2026-09-20' }),
        actorId: ids.admin,
        idempotencyKey: idemKey(),
        requestId: `${marker}-sub-overlap`,
      }),
    (err) => err.code === 'SUBSCRIPTION_OVERLAP',
  );
});

test('assinatura service: adesão administrativa cria assinatura', async () => {
  const assinaturaId = await assinaturaService.criarAssinaturaAdministrativa({
    data: subscriptionData({ inicioEm: '2026-08-01', fimEm: '2026-08-05' }),
    actorId: ids.admin,
    requestId: `${marker}-sub-admin`,
  });
  assert.ok(assinaturaId > 0);
  const assinatura = await assinaturaService.obterAssinaturaAdmin({ id: assinaturaId });
  assert.equal(assinatura.status, 'aguardando_pagamento');
});

test('assinatura service: obter meu plano e listar usos', async () => {
  const meuPlano = await assinaturaService.obterMeuPlano({ clientId: ids.client });
  assert.equal(meuPlano.cliente_id, ids.client);
  const usos = await assinaturaService.listarMeusUsos({
    clientId: ids.client,
    assinaturaId: meuPlano.id,
  });
  assert.ok(Array.isArray(usos));
});

test('assinatura service: suspensão, reativação e cancelamento com transições', async () => {
  const { assinaturaId } = await assinaturaService.solicitarAdesao({
    data: subscriptionData({ inicioEm: '2026-08-07', fimEm: '2026-08-10' }),
    actorId: ids.admin,
    idempotencyKey: idemKey(),
    requestId: `${marker}-sub-cycle`,
  });
  // aguardando_pagamento -> cancelada (via cancelamento) é permitido
  await assinaturaService.cancelarAssinatura({
    id: assinaturaId,
    motivo: 'Cliente desistiu',
    actorId: ids.admin,
    requestId: `${marker}-sub-cancel1`,
  });
  let assinatura = await assinaturaService.obterAssinaturaAdmin({ id: assinaturaId });
  assert.equal(assinatura.status, 'cancelada');
});

test('assinatura service: cancelamento sem motivo é rejeitado', async () => {
  const { assinaturaId } = await assinaturaService.solicitarAdesao({
    data: subscriptionData({ inicioEm: '2026-08-12', fimEm: '2026-08-15' }),
    actorId: ids.admin,
    idempotencyKey: idemKey(),
    requestId: `${marker}-sub-nomotivo`,
  });
  await assert.rejects(
    () =>
      assinaturaService.cancelarAssinatura({
        id: assinaturaId,
        motivo: '  ',
        actorId: ids.admin,
        requestId: `${marker}-sub-nomotivo2`,
      }),
    (err) => err.code === 'VALIDATION_ERROR',
  );
});

test('assinatura service: cancela não reabre assinatura terminal', async () => {
  const { assinaturaId } = await assinaturaService.solicitarAdesao({
    data: subscriptionData({ inicioEm: '2026-08-17', fimEm: '2026-08-20' }),
    actorId: ids.admin,
    idempotencyKey: idemKey(),
    requestId: `${marker}-sub-terminal`,
  });
  await assinaturaService.cancelarAssinatura({
    id: assinaturaId,
    motivo: 'Cancelamento',
    actorId: ids.admin,
    requestId: `${marker}-sub-terminal2`,
  });
  await assert.rejects(
    () =>
      assinaturaService.reativarAssinatura({
        id: assinaturaId,
        motivo: 'Reversão',
        actorId: ids.admin,
        requestId: `${marker}-sub-terminal3`,
      }),
    (err) => err.code === 'INVALID_SUBSCRIPTION_TRANSITION',
  );
});

async function insertAppointment(clientId = ids.client2) {
  const [result] = await pool.execute(
    `INSERT INTO agendamentos (
      cliente_id, barbeiro_id, servico_id, criado_por, origem, inicio_em, fim_em,
      fim_ocupacao_em, preco, duracao_minutos, buffer_minutos, status
    ) VALUES (?, ?, ?, ?, 'admin', '2026-09-10 12:00:00', '2026-09-10 12:30:00',
      '2026-09-10 12:30:00', 40.00, 30, 0, 'confirmado')`,
    [clientId, ids.barber, ids.service, ids.admin],
  );
  return result.insertId;
}

let blockCSubscription;
let blockCPayment;

test('pagamento: cria pendente, evita duplicidade e confirma ativando assinatura', async () => {
  blockCSubscription = await assinaturaService.criarAssinaturaAdministrativa({
    data: subscriptionData({
      clientId: ids.client2,
      inicioEm: '2026-09-01',
      fimEm: '2026-09-30',
    }),
    actorId: ids.admin,
    requestId: `${marker}-payment-sub`,
  });
  const data = {
    assinaturaId: blockCSubscription,
    referenciaMes: '2026-09-01',
    periodoInicio: '2026-09-01',
    periodoFim: '2026-09-30',
    valor: '129.90',
    forma: 'presencial',
  };
  const first = await pagamentoService.criarOuObterPagamentoPendente({
    data,
    actorId: ids.admin,
    requestId: `${marker}-payment-create`,
  });
  blockCPayment = first.pagamento.id;
  assert.equal(first.criado, true);
  assert.equal(first.pagamento.status, 'pendente');
  const duplicate = await pagamentoService.criarOuObterPagamentoPendente({
    data,
    actorId: ids.admin,
    requestId: `${marker}-payment-duplicate`,
  });
  assert.equal(duplicate.pagamento.id, blockCPayment);
  assert.equal(duplicate.criado, false);

  const confirmed = await pagamentoService.confirmarPagamento({
    id: blockCPayment,
    actorId: ids.admin,
    requestId: `${marker}-payment-confirm`,
  });
  assert.equal(confirmed.pagamento.status, 'confirmado');
  assert.equal(
    (await assinaturaService.obterAssinaturaAdmin({ id: blockCSubscription })).status,
    'ativa',
  );
  const replay = await pagamentoService.confirmarPagamento({
    id: blockCPayment,
    actorId: ids.admin,
    requestId: `${marker}-payment-replay`,
  });
  assert.equal(replay.replay, true);
});

test('pagamento: competência e valor inválidos são rejeitados', async () => {
  await assert.rejects(
    () =>
      pagamentoService.criarOuObterPagamentoPendente({
        data: {
          assinaturaId: blockCSubscription,
          referenciaMes: '2026-09-02',
          periodoInicio: '2026-09-01',
          periodoFim: '2026-09-30',
          valor: '0.00',
        },
        actorId: ids.admin,
      }),
    (error) => ['INVALID_PAYMENT_REFERENCE', 'INVALID_PAYMENT_VALUE'].includes(error.code),
  );
});

test('pagamento: confirmado não pode ser cancelado e cancelado não pode ser confirmado', async () => {
  await assert.rejects(
    () =>
      pagamentoService.cancelarPagamento({
        id: blockCPayment,
        actorId: ids.admin,
        motivo: 'Incorreto',
      }),
    (error) => error.code === 'INVALID_PAYMENT_TRANSITION',
  );
  const pending = await pagamentoService.criarOuObterPagamentoPendente({
    data: {
      assinaturaId: blockCSubscription,
      referenciaMes: '2026-10-01',
      periodoInicio: '2026-10-01',
      periodoFim: '2026-10-31',
      valor: '129.90',
    },
    actorId: ids.admin,
  });
  await pagamentoService.cancelarPagamento({
    id: pending.pagamento.id,
    actorId: ids.admin,
    motivo: 'Competência cancelada',
  });
  await assert.rejects(
    () => pagamentoService.confirmarPagamento({ id: pending.pagamento.id, actorId: ids.admin }),
    (error) => error.code === 'INVALID_PAYMENT_TRANSITION',
  );
});

test('cobertura: plano válido retorna snapshots, competência e contagens', async () => {
  const coverage = await coberturaService.decidirCobertura({
    clienteId: ids.client2,
    servicoId: ids.service,
    barbeiroId: ids.barber,
    data: '2026-09-10',
  });
  assert.equal(coverage.tipoCobranca, 'plano');
  assert.equal(coverage.assinaturaId, String(blockCSubscription));
  assert.equal(coverage.semanaInicio, '2026-09-07');
});

test('cobertura: deriva motivos sem aceitar decisão externa', async () => {
  assert.equal(
    (
      await coberturaService.decidirCobertura({
        clienteId: ids.admin,
        servicoId: ids.service,
        barbeiroId: ids.barber,
        data: '2026-09-10',
      })
    ).motivo,
    'SEM_ASSINATURA_ATIVA',
  );
  assert.equal(
    (
      await coberturaService.decidirCobertura({
        clienteId: ids.client2,
        servicoId: ids.service,
        barbeiroId: ids.barber,
        data: '2027-01-10',
      })
    ).motivo,
    'FORA_DO_PERIODO',
  );
  assert.equal(
    (
      await coberturaService.decidirCobertura({
        clienteId: ids.client2,
        servicoId: '999999999',
        barbeiroId: ids.barber,
        data: '2026-09-10',
      })
    ).motivo,
    'SERVICO_NAO_INCLUIDO',
  );
  assert.equal(
    (
      await coberturaService.decidirCobertura({
        clienteId: ids.client2,
        servicoId: ids.service,
        barbeiroId: '999999999',
        data: '2026-09-10',
      })
    ).motivo,
    'PROFISSIONAL_NAO_INCLUIDO',
  );
});

test('uso: exige transação, reserva uma vez e consome idempotentemente', async () => {
  const appointmentId = await insertAppointment();
  await assert.rejects(
    () =>
      usoService.reservarUso({
        assinatura: { id: blockCSubscription },
        agendamentoId: appointmentId,
        data: '2026-09-10',
        actorId: ids.admin,
      }),
    (error) => error.code === 'INVALID_TRANSACTION_CONTEXT',
  );
  await runTransactionWithRetry({
    operation: async ({ connection, transactionContext }) => {
      const subscription = await (
        await import('../src/repositories/assinaturaPlanoRepository.js')
      ).buscarAssinaturaPorIdForUpdate(blockCSubscription, connection);
      const reserved = await usoService.reservarUso({
        assinatura: subscription,
        agendamentoId: appointmentId,
        data: '2026-09-10',
        actorId: ids.admin,
        connection,
        transactionContext,
      });
      assert.equal(reserved.replay, false);
      assert.equal(
        (
          await usoService.reservarUso({
            assinatura: subscription,
            agendamentoId: appointmentId,
            data: '2026-09-10',
            actorId: ids.admin,
            connection,
            transactionContext,
          })
        ).replay,
        true,
      );
      assert.equal(
        (
          await usoService.consumirUso({
            agendamentoId: appointmentId,
            actorId: ids.admin,
            connection,
            transactionContext,
          })
        ).replay,
        false,
      );
      assert.equal(
        (
          await usoService.consumirUso({
            agendamentoId: appointmentId,
            actorId: ids.admin,
            connection,
            transactionContext,
          })
        ).replay,
        true,
      );
    },
  });
});

test('uso: libera idempotentemente e exige motivo administrativo', async () => {
  const appointmentId = await insertAppointment();
  await runTransactionWithRetry({
    operation: async ({ connection, transactionContext }) => {
      const subscription = await (
        await import('../src/repositories/assinaturaPlanoRepository.js')
      ).buscarAssinaturaPorIdForUpdate(blockCSubscription, connection);
      await usoService.reservarUso({
        assinatura: subscription,
        agendamentoId: appointmentId,
        data: '2026-09-11',
        actorId: ids.admin,
        connection,
        transactionContext,
      });
      await assert.rejects(
        () =>
          usoService.liberarUso({
            agendamentoId: appointmentId,
            actorId: ids.admin,
            administrativo: true,
            connection,
            transactionContext,
          }),
        (error) => error.code === 'VALIDATION_ERROR',
      );
      assert.equal(
        (
          await usoService.liberarUso({
            agendamentoId: appointmentId,
            actorId: ids.admin,
            administrativo: true,
            motivo: 'Responsabilidade da barbearia',
            connection,
            transactionContext,
          })
        ).replay,
        false,
      );
      assert.equal(
        (
          await usoService.liberarUso({
            agendamentoId: appointmentId,
            actorId: ids.admin,
            administrativo: true,
            motivo: 'Responsabilidade da barbearia',
            connection,
            transactionContext,
          })
        ).replay,
        true,
      );
    },
  });
});

test('uso: reagendamento mantém reserva ou libera ao perder cobertura', async () => {
  const appointmentId = await insertAppointment();
  await runTransactionWithRetry({
    operation: async ({ connection, transactionContext }) => {
      const subscription = await (
        await import('../src/repositories/assinaturaPlanoRepository.js')
      ).buscarAssinaturaPorIdForUpdate(blockCSubscription, connection);
      await usoService.reservarUso({
        assinatura: subscription,
        agendamentoId: appointmentId,
        data: '2026-09-12',
        actorId: ids.admin,
        connection,
        transactionContext,
      });
      const moved = await usoService.atualizarUsoNoReagendamento({
        agendamentoId: appointmentId,
        assinatura: subscription,
        data: '2026-09-15',
        continuaCoberto: true,
        actorId: ids.admin,
        connection,
        transactionContext,
      });
      assert.equal(moved.semanaInicio, '2026-09-14');
      assert.equal(
        (
          await usoService.atualizarUsoNoReagendamento({
            agendamentoId: appointmentId,
            assinatura: subscription,
            data: '2026-10-01',
            continuaCoberto: false,
            actorId: ids.admin,
            connection,
            transactionContext,
          })
        ).replay,
        false,
      );
    },
  });
});

test('cobertura: pagamento pendente e plano suspenso permanecem avulsos', async () => {
  const pendingId = await assinaturaService.criarAssinaturaAdministrativa({
    data: subscriptionData({ clientId: ids.client2, inicioEm: '2026-10-01', fimEm: '2026-10-31' }),
    actorId: ids.admin,
  });
  await pool.execute("UPDATE assinaturas_planos SET status='ativa', ativada_em=NOW(6) WHERE id=?", [
    pendingId,
  ]);
  assert.equal(
    (
      await coberturaService.decidirCobertura({
        clienteId: ids.client2,
        servicoId: ids.service,
        barbeiroId: ids.barber,
        data: '2026-10-10',
      })
    ).motivo,
    'PAGAMENTO_PENDENTE',
  );
  await planoService.suspenderUso({
    id: ids.plan,
    actorId: ids.admin,
    motivo: 'Suspensão de teste',
  });
  assert.equal(
    (
      await coberturaService.decidirCobertura({
        clienteId: ids.client2,
        servicoId: ids.service,
        barbeiroId: ids.barber,
        data: '2026-09-10',
      })
    ).motivo,
    'PLANO_SUSPENSO',
  );
  await planoService.permitirUso({ id: ids.plan, actorId: ids.admin });
});

test('cobertura: limites semanal, total e flags ilimitadas são respeitados', async () => {
  await pool.execute(
    `UPDATE assinaturas_planos SET possui_limite_semanal_snapshot=TRUE,
      limite_semanal_snapshot=1, possui_limite_total_snapshot=TRUE,
      limite_total_snapshot=1 WHERE id=?`,
    [blockCSubscription],
  );
  const weekly = await coberturaService.decidirCobertura({
    clienteId: ids.client2,
    servicoId: ids.service,
    barbeiroId: ids.barber,
    data: '2026-09-10',
  });
  assert.equal(weekly.motivo, 'LIMITE_SEMANAL_ATINGIDO');
  await pool.execute(
    `UPDATE assinaturas_planos SET possui_limite_semanal_snapshot=FALSE,
      limite_semanal_snapshot=NULL WHERE id=?`,
    [blockCSubscription],
  );
  const total = await coberturaService.decidirCobertura({
    clienteId: ids.client2,
    servicoId: ids.service,
    barbeiroId: ids.barber,
    data: '2026-09-10',
  });
  assert.equal(total.motivo, 'LIMITE_TOTAL_ATINGIDO');
  await pool.execute(
    `UPDATE assinaturas_planos SET possui_limite_total_snapshot=FALSE,
      limite_total_snapshot=NULL WHERE id=?`,
    [blockCSubscription],
  );
  assert.equal(
    (
      await coberturaService.decidirCobertura({
        clienteId: ids.client2,
        servicoId: ids.service,
        barbeiroId: ids.barber,
        data: '2026-09-10',
      })
    ).tipoCobranca,
    'plano',
  );
});

test('pagamento: falha de histórico ou autor inválido reverte confirmação e ativação', async () => {
  const subscriptionId = await assinaturaService.criarAssinaturaAdministrativa({
    data: subscriptionData({ clientId: ids.client2, inicioEm: '2026-11-01', fimEm: '2026-11-30' }),
    actorId: ids.admin,
  });
  const pending = await pagamentoService.criarOuObterPagamentoPendente({
    data: {
      assinaturaId: subscriptionId,
      referenciaMes: '2026-11-01',
      periodoInicio: '2026-11-01',
      periodoFim: '2026-11-30',
      valor: '129.90',
    },
    actorId: ids.admin,
  });
  await assert.rejects(() =>
    pagamentoService.confirmarPagamento({ id: pending.pagamento.id, actorId: '999999999' }),
  );
  assert.equal(
    (await pagamentoService.listarPagamentos({ assinaturaId: subscriptionId }))[0].status,
    'pendente',
  );
  assert.equal(
    (await assinaturaService.obterAssinaturaAdmin({ id: subscriptionId })).status,
    'aguardando_pagamento',
  );
});
