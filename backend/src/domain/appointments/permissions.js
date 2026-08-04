import { AppError } from '../../utils/AppError.js';

export function assertClientOwner(appointment, userId) {
  if (String(appointment.cliente_id) !== String(userId)) {
    throw new AppError('Acesso não autorizado.', 403, 'APPOINTMENT_FORBIDDEN');
  }
}

export function assertAssignedBarber(appointment, barber) {
  if (!barber || String(appointment.barbeiro_id) !== String(barber.id)) {
    throw new AppError('Acesso não autorizado.', 403, 'APPOINTMENT_FORBIDDEN');
  }
}
