export const PLAN_CANCELLATION_NOTICE =
  'Cancelamentos com pelo menos 2 horas de antecedência liberam novamente a utilização do plano. Cancelamentos com menos de 2 horas ou ausência serão contabilizados como utilização.';

const idIncluded = (items, id) =>
  Array.isArray(items) && items.some((item) => String(item?.id) === String(id));

export function isCoveredByCurrentPlan(subscription, selection) {
  if (!subscription || subscription.status !== 'ativa' || subscription.usoStatus === 'suspenso')
    return false;
  const date = selection?.data;
  return (
    typeof date === 'string' &&
    date >= String(subscription.inicioEm).slice(0, 10) &&
    date <= String(subscription.fimEm).slice(0, 10) &&
    idIncluded(subscription.servicos, selection.servicoId) &&
    idIncluded(subscription.barbeiros, selection.barbeiroId)
  );
}

export function planCancellationMessage(appointment, now = new Date()) {
  if (appointment?.tipoCobranca !== 'plano' || !appointment.cancelamentoPlano?.prazoEm) return null;
  const deadline = new Date(appointment.cancelamentoPlano.prazoEm);
  if (Number.isNaN(deadline.getTime())) return null;
  return now.getTime() <= deadline.getTime()
    ? 'Sua utilização será devolvida'
    : 'Este cancelamento será contabilizado como utilização';
}
