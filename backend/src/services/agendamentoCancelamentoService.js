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
import { consumirUso, liberarUso } from './usoPlanoService.js';

export async function cancel({
  id,
  userId,
  role,
  reason,
  responsibility,
  nowUtc = new Date(),
  requestId,
}) {
  if (!reason?.trim()) throw new AppError('Motivo obrigatÃ³rio.', 422, 'VALIDATION_ERROR');
  const cancellationResponsibility = role === 'cliente' ? 'cliente' : responsibility;
  if (!['cliente', 'barbearia'].includes(cancellationResponsibility))
    throw new AppError('Responsabilidade invÃ¡lida.', 422, 'VALIDATION_ERROR');
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
    operation: async ({ connection, transactionContext }) => {
      await availabilityRepository.lockBarber(preliminary.barbeiro_id, connection);
      const appointment = await appointmentRepository.findByIdForUpdate(id, connection);
      if (!appointment || String(appointment.barbeiro_id) !== String(preliminary.barbeiro_id)) {
        throw new AppError('Agendamento não encontrado.', 404, 'APPOINTMENT_NOT_FOUND');
      }
      if (appointment.status === 'cancelado') return;
      const settings = await appointmentRepository.findSettings(connection);
      if (role === 'cliente') {
        assertClientOwner(appointment, userId);
        try {
          assertClientCancellation({
            appointment,
            minimumHours: settings.tempo_minimo_cancelamento_horas,
            nowUtc,
          });
        } catch (error) {
          if (error.code !== 'CANCELLATION_DEADLINE_PASSED') throw error;
        }
      } else assertAdminCancellation(appointment, reason);
      await appointmentRepository.updateCancellation(
        { id, userId, reason: reason?.trim(), nowUtc },
        connection,
      );
      const deadline =
        new Date(appointment.inicio_em).getTime() -
        settings.tempo_minimo_cancelamento_horas * 3_600_000;
      const late = new Date(nowUtc).getTime() > deadline;
      let usageEffect = 'liberado';
      if (cancellationResponsibility === 'cliente' && late) {
        usageEffect = 'consumido';
        await consumirUso({
          agendamentoId: id,
          actorId: userId,
          connection,
          transactionContext,
          now: nowUtc,
          motivo: reason,
          responsabilidade: cancellationResponsibility,
        });
      } else {
        await liberarUso({
          agendamentoId: id,
          actorId: userId,
          motivo: reason,
          connection,
          transactionContext,
          now: nowUtc,
          responsabilidade: cancellationResponsibility,
          administrativo: cancellationResponsibility === 'barbearia',
        });
      }
      await historyRepository.create(
        {
          appointmentId: id,
          type: 'cancelado',
          previousStatus: appointment.status,
          nextStatus: 'cancelado',
          changedBy: userId,
          note: reason?.trim() || null,
          newData: {
            responsabilidade: cancellationResponsibility,
            efeitoUtilizacao: usageEffect,
          },
        },
        connection,
      );
    },
  });
  logger.info('appointment_cancelled', logContext);
  return appointmentRepository.findById(id);
}
