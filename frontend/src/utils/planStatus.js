/** Rótulos e tons amigáveis para estados do módulo de planos. */

const SUBSCRIPTION_STATUS = {
  aguardando_pagamento: { label: 'Aguardando pagamento', tone: 'info' },
  ativa: { label: 'Ativa', tone: 'success' },
  vencida: { label: 'Vencida', tone: 'warning' },
  suspensa: { label: 'Suspensa', tone: 'warning' },
  cancelada: { label: 'Cancelada', tone: 'error' },
};

const USAGE_STATUS = {
  reservado: { label: 'Reservado', tone: 'info' },
  consumido: { label: 'Consumido', tone: 'success' },
  liberado: { label: 'Liberado', tone: 'warning' },
};

const USO_STATUS = {
  permitido: { label: 'Permitido', tone: 'success' },
  suspenso: { label: 'Suspenso', tone: 'warning' },
};

export function subscriptionStatus(status) {
  return SUBSCRIPTION_STATUS[status] ?? { label: status, tone: 'info' };
}
export function usageStatus(status) {
  return USAGE_STATUS[status] ?? { label: status, tone: 'info' };
}
export function usoStatus(status) {
  return USO_STATUS[status] ?? { label: status, tone: 'info' };
}

/** Quantidade de utilizações que contam para o consumo do plano. */
export function usageCount(usos) {
  return (usos ?? []).filter((item) => item.status === 'reservado' || item.status === 'consumido')
    .length;
}

/** Saldo restante de um plano, quando há limite total. */
export function remainingUsage({ limiteTotal, possuiLimiteTotal, usos }) {
  if (!possuiLimiteTotal) return null;
  return Math.max(0, Number(limiteTotal) - usageCount(usos));
}

/** Limite semanal restante, quando houver. */
export function remainingWeekly({ limiteSemanal, possuiLimiteSemanal, usos, semanaInicio }) {
  if (!possuiLimiteSemanal) return null;
  const usedWeek = (usos ?? []).filter(
    (item) =>
      item.semana_inicio === semanaInicio &&
      (item.status === 'reservado' || item.status === 'consumido'),
  ).length;
  return Math.max(0, Number(limiteSemanal) - usedWeek);
}
