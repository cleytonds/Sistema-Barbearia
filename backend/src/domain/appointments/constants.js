export const APPOINTMENT_STATUS = Object.freeze({
  PENDING: 'pendente',
  CONFIRMED: 'confirmado',
  IN_SERVICE: 'em_atendimento',
  COMPLETED: 'concluido',
  CANCELLED: 'cancelado',
  ABSENT: 'ausente',
});

export const APPOINTMENT_ORIGIN = Object.freeze({ CLIENT: 'cliente', ADMIN: 'admin' });
export const TERMINAL_STATUSES = Object.freeze([
  APPOINTMENT_STATUS.COMPLETED,
  APPOINTMENT_STATUS.CANCELLED,
  APPOINTMENT_STATUS.ABSENT,
]);
export const CANCELLABLE_STATUSES = Object.freeze([
  APPOINTMENT_STATUS.PENDING,
  APPOINTMENT_STATUS.CONFIRMED,
]);
export const RESCHEDULABLE_STATUSES = CANCELLABLE_STATUSES;
export const IDEMPOTENCY_KEY_PATTERN = new RegExp(
  `^[\\x21-\\x7e]{${IDEMPOTENCY_KEY_MIN_LENGTH},${IDEMPOTENCY_KEY_MAX_LENGTH}}$`,
);
import { IDEMPOTENCY_KEY_MAX_LENGTH, IDEMPOTENCY_KEY_MIN_LENGTH } from '../../config/httpConfig.js';
