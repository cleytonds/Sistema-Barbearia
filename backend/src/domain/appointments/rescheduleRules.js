import { AppError } from '../../utils/AppError.js';
import { RESCHEDULABLE_STATUSES } from './constants.js';

export function assertReschedule({ appointment, newStartAt, minimumHours, nowUtc, isAdmin }) {
  if (!RESCHEDULABLE_STATUSES.includes(appointment.status)) {
    throw new AppError('Agendamento não pode ser reagendado.', 422, 'BUSINESS_RULE_VIOLATION');
  }
  if (new Date(newStartAt).getTime() === new Date(appointment.inicio_em).getTime()) {
    throw new AppError('O novo horário deve ser diferente.', 422, 'BUSINESS_RULE_VIOLATION');
  }
  const deadline = new Date(appointment.inicio_em).getTime() - minimumHours * 3_600_000;
  if (!isAdmin && new Date(nowUtc).getTime() > deadline) {
    throw new AppError('Prazo de reagendamento encerrado.', 422, 'RESCHEDULE_DEADLINE_PASSED');
  }
}
