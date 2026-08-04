import { AppError } from '../../utils/AppError.js';
import { APPOINTMENT_STATUS, TERMINAL_STATUSES } from './constants.js';

const transitions = Object.freeze({
  [APPOINTMENT_STATUS.PENDING]: [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.ABSENT],
  [APPOINTMENT_STATUS.CONFIRMED]: [APPOINTMENT_STATUS.IN_SERVICE, APPOINTMENT_STATUS.ABSENT],
  [APPOINTMENT_STATUS.IN_SERVICE]: [APPOINTMENT_STATUS.COMPLETED],
});

/** Valida uma transição operacional, sem permitir cancelamento pela rota genérica. */
export function assertStatusTransition({ currentStatus, nextStatus, startAt, nowUtc }) {
  if (nextStatus === APPOINTMENT_STATUS.CANCELLED) {
    throw new AppError('Use a rota de cancelamento.', 422, 'INVALID_STATUS_TRANSITION');
  }
  if (currentStatus === nextStatus || TERMINAL_STATUSES.includes(currentStatus)) {
    throw new AppError('Transição de status inválida.', 422, 'INVALID_STATUS_TRANSITION');
  }
  if (!transitions[currentStatus]?.includes(nextStatus)) {
    throw new AppError('Transição de status inválida.', 422, 'INVALID_STATUS_TRANSITION');
  }
  const startsInFuture = new Date(startAt).getTime() > new Date(nowUtc).getTime();
  if (
    startsInFuture &&
    [
      APPOINTMENT_STATUS.ABSENT,
      APPOINTMENT_STATUS.IN_SERVICE,
      APPOINTMENT_STATUS.COMPLETED,
    ].includes(nextStatus)
  ) {
    throw new AppError(
      'O horário do agendamento ainda não iniciou.',
      422,
      'BUSINESS_RULE_VIOLATION',
    );
  }
  return true;
}

export function historyEventForStatus(status) {
  if (status === APPOINTMENT_STATUS.CONFIRMED) return 'confirmado';
  if (status === APPOINTMENT_STATUS.COMPLETED) return 'concluido';
  if (status === APPOINTMENT_STATUS.ABSENT) return 'ausente';
  return 'status_alterado';
}
