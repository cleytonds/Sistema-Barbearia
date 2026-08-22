import { AppError } from '../../utils/AppError.js';
import { APPOINTMENT_STATUS, CANCELLABLE_STATUSES } from './constants.js';

export function cancellationDeadline({ startAt, minimumHours }) {
  return new Date(new Date(startAt).getTime() - minimumHours * 3_600_000);
}

export function isLateCancellation({ startAt, minimumHours, nowUtc }) {
  return new Date(nowUtc).getTime() > cancellationDeadline({ startAt, minimumHours }).getTime();
}

/** Aplica estado, futuro e prazo; exatamente no limite ainda é permitido. */
export function assertClientCancellation({ appointment, minimumHours, nowUtc }) {
  if (appointment.status === APPOINTMENT_STATUS.CANCELLED) {
    throw new AppError('Agendamento já cancelado.', 409, 'APPOINTMENT_ALREADY_CANCELLED');
  }
  if (appointment.status === APPOINTMENT_STATUS.COMPLETED) {
    throw new AppError('Agendamento já concluído.', 409, 'APPOINTMENT_ALREADY_COMPLETED');
  }
  if (!CANCELLABLE_STATUSES.includes(appointment.status)) {
    throw new AppError('Agendamento não pode ser cancelado.', 422, 'BUSINESS_RULE_VIOLATION');
  }
  if (isLateCancellation({ startAt: appointment.inicio_em, minimumHours, nowUtc })) {
    throw new AppError('Prazo de cancelamento encerrado.', 422, 'CANCELLATION_DEADLINE_PASSED');
  }
}

export function assertAdminCancellation(appointment, reason) {
  if (!reason?.trim()) throw new AppError('Motivo obrigatório.', 422, 'VALIDATION_ERROR');
  if (appointment.status === APPOINTMENT_STATUS.CANCELLED) {
    throw new AppError('Agendamento já cancelado.', 409, 'APPOINTMENT_ALREADY_CANCELLED');
  }
  if ([APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.ABSENT].includes(appointment.status)) {
    throw new AppError('Agendamento não pode ser cancelado.', 422, 'BUSINESS_RULE_VIOLATION');
  }
}
