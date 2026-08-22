import { cancellationDeadline } from './cancellationRules.js';
import { PLAN_CANCELLATION_RELEASE_HOURS } from '../plans/constants.js';

const CLIENT_MUTABLE_STATUSES = new Set(['pendente', 'confirmado']);

/** Calcula permissões do cliente usando o status e o prazo operacional persistidos. */
export function clientAppointmentPermissions(row, settings, now = new Date()) {
  const rescheduleDeadline = cancellationDeadline({
    startAt: row.inicio_em,
    minimumHours: settings.tempo_minimo_cancelamento_horas,
  });
  const mutable = CLIENT_MUTABLE_STATUSES.has(row.status);
  return {
    podeCancelar: mutable,
    podeReagendar: mutable && now.getTime() <= rescheduleDeadline.getTime(),
    ...(row.tipo_cobranca === 'plano' && {
      cancelamentoPlano: {
        prazoEm: cancellationDeadline({
          startAt: row.inicio_em,
          minimumHours: PLAN_CANCELLATION_RELEASE_HOURS,
        }).toISOString(),
        antecedenciaHoras: PLAN_CANCELLATION_RELEASE_HOURS,
      },
    }),
  };
}
