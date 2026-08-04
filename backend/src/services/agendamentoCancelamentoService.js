import { runTransactionWithRetry } from '../database/transactionRetry.js';
import {
  assertAdminCancellation,
  assertClientCancellation,
} from '../domain/appointments/cancellationRules.js';
import { assertClientOwner } from '../domain/appointments/permissions.js';
import * as appointmentRepository from '../repositories/agendamentoRepository.js';
import * as availabilityRepository from '../repositories/disponibilidadeRepository.js';
import * as historyRepository from '../repositories/historicoAgendamentoRepository.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export async function cancel({ id, userId, role, reason, nowUtc = new Date(), requestId }) {
  const preliminary = await appointmentRepository.findByIdWithoutLock(id);
  if (!preliminary) throw new AppError('Agendamento não encontrado.', 404, 'APPOINTMENT_NOT_FOUND');
  const logContext = {
    requestId,
    usuarioId: userId,
    agendamentoId: id,
    barbeiroId: preliminary.barbeiro_id,
    operation: 'appointment_cancel',
  };
  await runTransactionWithRetry({
    logContext,
    operation: async ({ connection }) => {
      await availabilityRepository.lockBarber(preliminary.barbeiro_id, connection);
      const appointment = await appointmentRepository.findByIdForUpdate(id, connection);
      if (!appointment || String(appointment.barbeiro_id) !== String(preliminary.barbeiro_id)) {
        throw new AppError('Agendamento não encontrado.', 404, 'APPOINTMENT_NOT_FOUND');
      }
      if (role === 'cliente') {
        assertClientOwner(appointment, userId);
        const settings = await appointmentRepository.findSettings(connection);
        assertClientCancellation({
          appointment,
          minimumHours: settings.tempo_minimo_cancelamento_horas,
          nowUtc,
        });
      } else assertAdminCancellation(appointment, reason);
      await appointmentRepository.updateCancellation(
        { id, userId, reason: reason?.trim(), nowUtc },
        connection,
      );
      await historyRepository.create(
        {
          appointmentId: id,
          type: 'cancelado',
          previousStatus: appointment.status,
          nextStatus: 'cancelado',
          changedBy: userId,
          note: reason?.trim() || null,
        },
        connection,
      );
    },
  });
  logger.info('appointment_cancelled', logContext);
  return appointmentRepository.findById(id);
}
