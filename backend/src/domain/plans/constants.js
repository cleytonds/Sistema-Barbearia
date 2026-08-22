export const PLAN_USE_STATUS = Object.freeze({ ALLOWED: 'permitido', SUSPENDED: 'suspenso' });
export const SUBSCRIPTION_STATUS = Object.freeze({
  AWAITING_PAYMENT: 'aguardando_pagamento',
  ACTIVE: 'ativa',
  EXPIRED: 'vencida',
  SUSPENDED: 'suspensa',
  CANCELLED: 'cancelada',
});
export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pendente',
  CONFIRMED: 'confirmado',
  CANCELLED: 'cancelado',
});
export const PLAN_USAGE_STATUS = Object.freeze({
  RESERVED: 'reservado',
  CONSUMED: 'consumido',
  RELEASED: 'liberado',
});
export const TERMINAL_SUBSCRIPTION_STATUSES = Object.freeze([
  SUBSCRIPTION_STATUS.EXPIRED,
  SUBSCRIPTION_STATUS.CANCELLED,
]);
export const TERMINAL_USAGE_STATUSES = Object.freeze([
  PLAN_USAGE_STATUS.CONSUMED,
  PLAN_USAGE_STATUS.RELEASED,
]);
export const BILLING_TYPE = Object.freeze({ SINGLE: 'avulso', PLAN: 'plano' });
export const PLAN_CANCELLATION_RELEASE_HOURS = 2;
export const NO_COVERAGE_REASON = Object.freeze({
  NO_ACTIVE_SUBSCRIPTION: 'SEM_ASSINATURA_ATIVA',
  PAYMENT_PENDING: 'PAGAMENTO_PENDENTE',
  OUTSIDE_PERIOD: 'FORA_DO_PERIODO',
  PLAN_SUSPENDED: 'PLANO_SUSPENSO',
  SERVICE_NOT_INCLUDED: 'SERVICO_NAO_INCLUIDO',
  BARBER_NOT_INCLUDED: 'PROFISSIONAL_NAO_INCLUIDO',
  WEEKLY_LIMIT_REACHED: 'LIMITE_SEMANAL_ATINGIDO',
  TOTAL_LIMIT_REACHED: 'LIMITE_TOTAL_ATINGIDO',
});
