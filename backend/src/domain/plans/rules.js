import { AppError } from '../../utils/AppError.js';
import {
  BILLING_TYPE,
  NO_COVERAGE_REASON,
  PLAN_USAGE_STATUS,
  SUBSCRIPTION_STATUS,
} from './constants.js';

const subscriptionTransitions = {
  aguardando_pagamento: new Set(['ativa', 'cancelada']),
  ativa: new Set(['suspensa', 'vencida', 'cancelada']),
  suspensa: new Set(['ativa', 'vencida', 'cancelada']),
  vencida: new Set(),
  cancelada: new Set(),
};
const usageTransitions = {
  reservado: new Set(['consumido', 'liberado']),
  consumido: new Set(),
  liberado: new Set(),
};

export function assertTransition(map, current, next, code = 'INVALID_STATE_TRANSITION') {
  if (!map[current]?.has(next)) throw new AppError('Transição de estado inválida.', 409, code);
}
export const assertSubscriptionTransition = (current, next) =>
  assertTransition(subscriptionTransitions, current, next, 'INVALID_SUBSCRIPTION_TRANSITION');
export const assertUsageTransition = (current, next) =>
  assertTransition(usageTransitions, current, next, 'INVALID_USAGE_TRANSITION');

export function assertLimits(limits) {
  const pairs = [
    ['possuiLimiteSemanal', 'limiteSemanal'],
    ['possuiLimiteTotal', 'limiteTotal'],
  ];
  for (const [enabled, value] of pairs) {
    if (limits[enabled] && (!Number.isInteger(limits[value]) || limits[value] <= 0))
      throw new AppError('Limite inválido.', 422, 'INVALID_PLAN_LIMIT');
    if (!limits[enabled] && limits[value] != null)
      throw new AppError('Limite deve ser nulo quando desativado.', 422, 'INVALID_PLAN_LIMIT');
  }
  if (
    limits.possuiLimiteSemanal &&
    limits.possuiLimiteTotal &&
    limits.limiteSemanal > limits.limiteTotal
  )
    throw new AppError('Limite semanal não pode superar o total.', 422, 'INVALID_PLAN_LIMIT');
}

export function civilDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

export function weekStart(civil) {
  if (!civilDate(civil)) throw new AppError('Data civil inválida.', 422, 'INVALID_CIVIL_DATE');
  const date = new Date(`${civil}T00:00:00.000Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

/** Retorna o domingo da semana civil (segunda a domingo). */
export function weekEnd(civil) {
  if (!civilDate(civil)) throw new AppError('Data civil inválida.', 422, 'INVALID_CIVIL_DATE');
  const date = new Date(`${weekStart(civil)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 6);
  return date.toISOString().slice(0, 10);
}

/** Valida que início e fim são datas civis e que fim não precede início. */
export function assertPeriod({ inicio, fim }) {
  if (!civilDate(inicio)) throw new AppError('Data de início inválida.', 422, 'INVALID_CIVIL_DATE');
  if (!civilDate(fim)) throw new AppError('Data de fim inválida.', 422, 'INVALID_CIVIL_DATE');
  if (fim < inicio)
    throw new AppError('O fim do período não pode ser anterior ao início.', 422, 'INVALID_PERIOD');
  return { inicio, fim };
}

/** Verifica se uma data civil pertence ao período (extremidades inclusivas). */
export function isInPeriod({ date, inicio, fim }) {
  if (!civilDate(date)) throw new AppError('Data inválida.', 422, 'INVALID_CIVIL_DATE');
  assertPeriod({ inicio, fim });
  return date >= inicio && date <= fim;
}

export function decideCoverage(context) {
  const fail = (reason) => ({ tipoCobranca: BILLING_TYPE.SINGLE, motivo: reason });
  if (!context.subscription || context.subscription.status !== SUBSCRIPTION_STATUS.ACTIVE)
    return fail(NO_COVERAGE_REASON.NO_ACTIVE_SUBSCRIPTION);
  if (!context.paymentConfirmed) return fail(NO_COVERAGE_REASON.PAYMENT_PENDING);
  if (context.date < context.subscription.inicioEm || context.date > context.subscription.fimEm)
    return fail(NO_COVERAGE_REASON.OUTSIDE_PERIOD);
  if (!context.planUseAllowed) return fail(NO_COVERAGE_REASON.PLAN_SUSPENDED);
  if (!context.serviceIncluded) return fail(NO_COVERAGE_REASON.SERVICE_NOT_INCLUDED);
  if (!context.barberIncluded) return fail(NO_COVERAGE_REASON.BARBER_NOT_INCLUDED);
  if (
    context.subscription.possuiLimiteSemanal &&
    context.weeklyUsage >= context.subscription.limiteSemanal
  )
    return fail(NO_COVERAGE_REASON.WEEKLY_LIMIT_REACHED);
  if (
    context.subscription.possuiLimiteTotal &&
    context.totalUsage >= context.subscription.limiteTotal
  )
    return fail(NO_COVERAGE_REASON.TOTAL_LIMIT_REACHED);
  return { tipoCobranca: BILLING_TYPE.PLAN, motivo: null };
}

export function usageEffect({
  appointmentStatus,
  lateCancellation = false,
  administrativeRelease = false,
}) {
  if (administrativeRelease || (appointmentStatus === 'cancelado' && !lateCancellation))
    return PLAN_USAGE_STATUS.RELEASED;
  if (['concluido', 'ausente'].includes(appointmentStatus) || lateCancellation)
    return PLAN_USAGE_STATUS.CONSUMED;
  return PLAN_USAGE_STATUS.RESERVED;
}
