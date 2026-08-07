import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NO_COVERAGE_REASON,
  TERMINAL_SUBSCRIPTION_STATUSES,
  TERMINAL_USAGE_STATUSES,
} from '../src/domain/plans/constants.js';
import {
  assertLimits,
  assertPeriod,
  assertSubscriptionTransition,
  assertUsageTransition,
  civilDate,
  decideCoverage,
  isInPeriod,
  usageEffect,
  weekEnd,
  weekStart,
} from '../src/domain/plans/rules.js';

// ---------------------------------------------------------------------------
// Transições de assinatura
// ---------------------------------------------------------------------------
const SUBSCRIPTION_TRANSITIONS = [
  ['aguardando_pagamento', 'ativa'],
  ['aguardando_pagamento', 'cancelada'],
  ['ativa', 'suspensa'],
  ['ativa', 'vencida'],
  ['ativa', 'cancelada'],
  ['suspensa', 'ativa'],
  ['suspensa', 'vencida'],
  ['suspensa', 'cancelada'],
];

const SUBSCRIPTION_INVALID = [
  ['aguardando_pagamento', 'aguardando_pagamento'],
  ['aguardando_pagamento', 'suspensa'],
  ['aguardando_pagamento', 'vencida'],
  ['ativa', 'ativa'],
  ['ativa', 'aguardando_pagamento'],
  ['suspensa', 'suspensa'],
  ['vencida', 'ativa'],
  ['vencida', 'cancelada'],
  ['vencida', 'suspensa'],
  ['cancelada', 'ativa'],
  ['cancelada', 'suspensa'],
  ['cancelada', 'vencida'],
];

const USAGE_TRANSITIONS = [
  ['reservado', 'consumido'],
  ['reservado', 'liberado'],
];

const USAGE_INVALID = [
  ['reservado', 'reservado'],
  ['consumido', 'consumido'],
  ['consumido', 'liberado'],
  ['consumido', 'reservado'],
  ['liberado', 'consumido'],
  ['liberado', 'liberado'],
  ['liberado', 'reservado'],
];

test('todas as transições válidas de assinatura são aceitas', () => {
  for (const [from, to] of SUBSCRIPTION_TRANSITIONS) {
    assert.doesNotThrow(() => assertSubscriptionTransition(from, to), `${from}->${to}`);
  }
});

test('todas as transições inválidas de assinatura são rejeitadas', () => {
  for (const [from, to] of SUBSCRIPTION_INVALID) {
    assert.throws(
      () => assertSubscriptionTransition(from, to),
      (err) => err.code === 'INVALID_SUBSCRIPTION_TRANSITION',
      `${from}->${to}`,
    );
  }
});

test('todas as transições válidas de uso são aceitas', () => {
  for (const [from, to] of USAGE_TRANSITIONS) {
    assert.doesNotThrow(() => assertUsageTransition(from, to), `${from}->${to}`);
  }
});

test('todas as transições inválidas de uso são rejeitadas', () => {
  for (const [from, to] of USAGE_INVALID) {
    assert.throws(
      () => assertUsageTransition(from, to),
      (err) => err.code === 'INVALID_USAGE_TRANSITION',
      `${from}->${to}`,
    );
  }
});

test('estados terminais de assinatura são vencida e cancelada', () => {
  assert.deepEqual(TERMINAL_SUBSCRIPTION_STATUSES, ['vencida', 'cancelada']);
  for (const terminal of TERMINAL_SUBSCRIPTION_STATUSES) {
    assert.throws(
      () => assertSubscriptionTransition(terminal, 'ativa'),
      (err) => err.code === 'INVALID_SUBSCRIPTION_TRANSITION',
    );
  }
});

test('estados terminais de uso são consumido e liberado', () => {
  assert.deepEqual(TERMINAL_USAGE_STATUSES, ['consumido', 'liberado']);
  for (const terminal of TERMINAL_USAGE_STATUSES) {
    assert.throws(
      () => assertUsageTransition(terminal, 'reservado'),
      (err) => err.code === 'INVALID_USAGE_TRANSITION',
    );
  }
});

// ---------------------------------------------------------------------------
// Limites
// ---------------------------------------------------------------------------
test('limites habilitados aceitam inteiros positivos', () => {
  assert.doesNotThrow(() =>
    assertLimits({
      possuiLimiteSemanal: true,
      limiteSemanal: 2,
      possuiLimiteTotal: true,
      limiteTotal: 8,
    }),
  );
});

test('limites desabilitados exigem valor nulo', () => {
  assert.doesNotThrow(() =>
    assertLimits({
      possuiLimiteSemanal: false,
      limiteSemanal: null,
      possuiLimiteTotal: false,
      limiteTotal: null,
    }),
  );
  assert.throws(
    () =>
      assertLimits({
        possuiLimiteSemanal: false,
        limiteSemanal: 1,
        possuiLimiteTotal: false,
        limiteTotal: null,
      }),
    (err) => err.code === 'INVALID_PLAN_LIMIT',
  );
  assert.throws(
    () =>
      assertLimits({
        possuiLimiteSemanal: false,
        limiteSemanal: null,
        possuiLimiteTotal: false,
        limiteTotal: 5,
      }),
    (err) => err.code === 'INVALID_PLAN_LIMIT',
  );
});

test('zero e valores não inteiros são rejeitados', () => {
  for (const value of [0, -1, 2.5, '3', NaN]) {
    assert.throws(
      () =>
        assertLimits({
          possuiLimiteSemanal: true,
          limiteSemanal: value,
          possuiLimiteTotal: false,
          limiteTotal: null,
        }),
      (err) => err.code === 'INVALID_PLAN_LIMIT',
    );
  }
});

test('limite semanal maior que o total é rejeitado', () => {
  assert.throws(
    () =>
      assertLimits({
        possuiLimiteSemanal: true,
        limiteSemanal: 10,
        possuiLimiteTotal: true,
        limiteTotal: 5,
      }),
    (err) => err.code === 'INVALID_PLAN_LIMIT',
  );
  assert.doesNotThrow(() =>
    assertLimits({
      possuiLimiteSemanal: true,
      limiteSemanal: 5,
      possuiLimiteTotal: true,
      limiteTotal: 5,
    }),
  );
});

// ---------------------------------------------------------------------------
// Datas e períodos
// ---------------------------------------------------------------------------
test('data civil válida é aceita', () => {
  assert.equal(civilDate('2026-08-10'), '2026-08-10');
  assert.equal(civilDate('2026-12-31'), '2026-12-31');
  assert.equal(civilDate('2028-02-29'), '2028-02-29');
});

test('datas civis inválidas são rejeitadas', () => {
  for (const value of [
    null,
    undefined,
    '',
    '2026-13-01',
    '2026-00-10',
    '2026-02-30',
    '10/08/2026',
    '2026-8-10',
    '2026-08',
  ]) {
    assert.equal(civilDate(value), null, String(value));
  }
});

test('período válido é aceito fechado', () => {
  const p = assertPeriod({ inicio: '2026-08-01', fim: '2026-08-31' });
  assert.deepEqual(p, { inicio: '2026-08-01', fim: '2026-08-31' });
  assert.deepEqual(assertPeriod({ inicio: '2026-08-10', fim: '2026-08-10' }), {
    inicio: '2026-08-10',
    fim: '2026-08-10',
  });
});

test('período com fim anterior ao início é rejeitado', () => {
  assert.throws(
    () => assertPeriod({ inicio: '2026-08-31', fim: '2026-08-01' }),
    (err) => err.code === 'INVALID_PERIOD',
  );
});

test('período com datas inválidas é rejeitado', () => {
  assert.throws(() => assertPeriod({ inicio: '2026-13-01', fim: '2026-08-31' }));
  assert.throws(() => assertPeriod({ inicio: '2026-08-01', fim: 'n/a' }));
});

test('isInPeriod verifica pertencimento com extremidades inclusivas', () => {
  assert.equal(isInPeriod({ date: '2026-08-01', inicio: '2026-08-01', fim: '2026-08-31' }), true);
  assert.equal(isInPeriod({ date: '2026-08-15', inicio: '2026-08-01', fim: '2026-08-31' }), true);
  assert.equal(isInPeriod({ date: '2026-08-31', inicio: '2026-08-01', fim: '2026-08-31' }), true);
  assert.equal(isInPeriod({ date: '2026-07-31', inicio: '2026-08-01', fim: '2026-08-31' }), false);
  assert.equal(isInPeriod({ date: '2026-09-01', inicio: '2026-08-01', fim: '2026-08-31' }), false);
});

// ---------------------------------------------------------------------------
// Semana de segunda a domingo
// ---------------------------------------------------------------------------
test('semana começa na segunda-feira', () => {
  assert.equal(weekStart('2026-08-09'), '2026-08-03'); // domingo -> segunda
  assert.equal(weekStart('2026-08-10'), '2026-08-10'); // segunda -> segunda
  assert.equal(weekStart('2026-08-15'), '2026-08-10'); // sábado -> segunda
});

test('semana termina no domingo', () => {
  assert.equal(weekEnd('2026-08-10'), '2026-08-16'); // segunda -> domingo
  assert.equal(weekEnd('2026-08-16'), '2026-08-16'); // domingo -> domingo
});

test('período da semana de segunda a domingo cobre exatamente 7 dias', () => {
  const inicio = weekStart('2026-08-12');
  const fim = weekEnd('2026-08-12');
  assert.equal(inicio, '2026-08-10');
  assert.equal(fim, '2026-08-16');
  assert.equal(isInPeriod({ date: '2026-08-10', inicio, fim }), true);
  assert.equal(isInPeriod({ date: '2026-08-16', inicio, fim }), true);
  assert.equal(isInPeriod({ date: '2026-08-09', inicio, fim }), false);
  assert.equal(isInPeriod({ date: '2026-08-17', inicio, fim }), false);
});

// ---------------------------------------------------------------------------
// Cobertura e motivos de atendimento avulso
// ---------------------------------------------------------------------------
const coverageBase = {
  subscription: {
    status: 'ativa',
    inicioEm: '2026-08-01',
    fimEm: '2026-08-31',
    possuiLimiteSemanal: true,
    limiteSemanal: 2,
    possuiLimiteTotal: true,
    limiteTotal: 8,
  },
  paymentConfirmed: true,
  date: '2026-08-15',
  planUseAllowed: true,
  serviceIncluded: true,
  barberIncluded: true,
  weeklyUsage: 0,
  totalUsage: 0,
};

test('cobertura plena retorna tipo plano sem motivo', () => {
  assert.deepEqual(decideCoverage(coverageBase), { tipoCobranca: 'plano', motivo: null });
});

test('todos os motivos de atendimento avulso são derivados', () => {
  const cases = [
    [{ ...coverageBase, subscription: null }, NO_COVERAGE_REASON.NO_ACTIVE_SUBSCRIPTION],
    [
      { ...coverageBase, subscription: { ...coverageBase.subscription, status: 'suspensa' } },
      NO_COVERAGE_REASON.NO_ACTIVE_SUBSCRIPTION,
    ],
    [{ ...coverageBase, paymentConfirmed: false }, NO_COVERAGE_REASON.PAYMENT_PENDING],
    [{ ...coverageBase, date: '2026-09-01' }, NO_COVERAGE_REASON.OUTSIDE_PERIOD],
    [{ ...coverageBase, date: '2026-07-31' }, NO_COVERAGE_REASON.OUTSIDE_PERIOD],
    [{ ...coverageBase, planUseAllowed: false }, NO_COVERAGE_REASON.PLAN_SUSPENDED],
    [{ ...coverageBase, serviceIncluded: false }, NO_COVERAGE_REASON.SERVICE_NOT_INCLUDED],
    [{ ...coverageBase, barberIncluded: false }, NO_COVERAGE_REASON.BARBER_NOT_INCLUDED],
    [{ ...coverageBase, weeklyUsage: 2 }, NO_COVERAGE_REASON.WEEKLY_LIMIT_REACHED],
    [{ ...coverageBase, totalUsage: 8 }, NO_COVERAGE_REASON.TOTAL_LIMIT_REACHED],
  ];
  for (const [context, expected] of cases) {
    const result = decideCoverage(context);
    assert.equal(result.tipoCobranca, 'avulso', `motivo ${expected}`);
    assert.equal(result.motivo, expected);
  }
});

// ---------------------------------------------------------------------------
// Efeito de uso (reserva, consumo, liberação)
// ---------------------------------------------------------------------------
test('agendamento coberto reserva utilização', () => {
  assert.equal(usageEffect({ appointmentStatus: 'confirmado' }), 'reservado');
});

test('conclusão e ausência consomem a utilização', () => {
  assert.equal(usageEffect({ appointmentStatus: 'concluido' }), 'consumido');
  assert.equal(usageEffect({ appointmentStatus: 'ausente' }), 'consumido');
});

test('cancelamento regular libera a utilização', () => {
  assert.equal(usageEffect({ appointmentStatus: 'cancelado' }), 'liberado');
});

test('cancelamento tardio consome a utilização', () => {
  assert.equal(
    usageEffect({ appointmentStatus: 'cancelado', lateCancellation: true }),
    'consumido',
  );
});

test('cancelamento administrativo por responsabilidade da barbearia libera', () => {
  assert.equal(
    usageEffect({
      appointmentStatus: 'cancelado',
      lateCancellation: true,
      administrativeRelease: true,
    }),
    'liberado',
  );
  assert.equal(
    usageEffect({ appointmentStatus: 'cancelado', administrativeRelease: true }),
    'liberado',
  );
});

// ---------------------------------------------------------------------------
// Reagendamento dentro e fora da cobertura
// ---------------------------------------------------------------------------
test('reagendamento coberto mantém a utilização reservada', () => {
  const original = usageEffect({ appointmentStatus: 'confirmado' });
  assert.equal(original, 'reservado');
  const reinscrito = {
    ...coverageBase,
    date: '2026-08-20',
    subscription: {
      ...coverageBase.subscription,
      inicioEm: '2026-08-01',
      fimEm: '2026-08-31',
    },
  };
  assert.equal(decideCoverage(reinscrito).tipoCobranca, 'plano');
});

test('reagendamento sem cobertura converte para avulso e libera a utilização', () => {
  const fora = decideCoverage({ ...coverageBase, date: '2026-09-05' });
  assert.equal(fora.tipoCobranca, 'avulso');
  assert.equal(fora.motivo, NO_COVERAGE_REASON.OUTSIDE_PERIOD);
  assert.equal(usageEffect({ appointmentStatus: 'cancelado' }), 'liberado');
});
