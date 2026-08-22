import { DateTime } from 'luxon';
import { runTransactionWithRetry } from '../database/transactionRetry.js';
import { assertAssignedBarber } from '../domain/appointments/permissions.js';
import {
  assertStatusTransition,
  historyEventForStatus,
} from '../domain/appointments/statusMachine.js';
import * as appointmentRepository from '../repositories/agendamentoRepository.js';
import * as historyRepository from '../repositories/historicoAgendamentoRepository.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { consumirUso } from './usoPlanoService.js';
import { gerarComissao } from './comissaoService.js';

export async function updateStatus({
  id,
  userId,
  role,
  nextStatus,
  justification,
  nowUtc = new Date(),
  requestId,
}) {
  const logContext = {
    requestId,
    usuarioId: userId,
    agendamentoId: id,
    operation: 'appointment_status',
  };
  await runTransactionWithRetry({
    logContext,
    operation: async ({ connection, transactionContext }) => {
      const appointment = await appointmentRepository.findByIdForUpdate(id, connection);
      if (!appointment)
        throw new AppError('Agendamento não encontrado.', 404, 'APPOINTMENT_NOT_FOUND');
      if (role === 'barbeiro') {
        const barber = await appointmentRepository.findBarberByUser(userId, connection);
        assertAssignedBarber(appointment, barber);
      }
      if (appointment.status === nextStatus && ['concluido', 'ausente'].includes(nextStatus)) {
        await consumirUso({
          agendamentoId: id,
          actorId: userId,
          connection,
          transactionContext,
          now: nowUtc,
        });
        if (nextStatus === 'concluido')
          await gerarComissao({ agendamento: appointment, connection, transactionContext });
        return;
      }
      let allowEarlyStart = false;
      if (role === 'barbeiro' && nextStatus === 'em_atendimento') {
        const settings = await appointmentRepository.findSettings(connection);
        const localDay = DateTime.fromJSDate(new Date(appointment.inicio_em), {
          zone: settings.fuso_horario,
        });
        const blocker = await appointmentRepository.findBarberStartBlockerForUpdate(
          {
            id,
            barberId: appointment.barbeiro_id,
            startAt: appointment.inicio_em,
            dayStartAt: localDay.startOf('day').toUTC().toJSDate(),
            dayEndAt: localDay.plus({ days: 1 }).startOf('day').toUTC().toJSDate(),
          },
          connection,
        );
        if (blocker) {
          const message =
            blocker.status === 'em_atendimento'
              ? 'Já existe outro atendimento em andamento.'
              : 'Existe um agendamento anterior aguardando resolução.';
          throw new AppError(message, 422, 'EARLY_START_BLOCKED');
        }
        allowEarlyStart = true;
      }
      assertStatusTransition({
        currentStatus: appointment.status,
        nextStatus,
        startAt: appointment.inicio_em,
        nowUtc,
        allowEarlyStart,
      });
      await appointmentRepository.updateStatus({ id, status: nextStatus, nowUtc }, connection);
      if (['concluido', 'ausente'].includes(nextStatus)) {
        await consumirUso({
          agendamentoId: id,
          actorId: userId,
          connection,
          transactionContext,
          now: nowUtc,
        });
      }
      if (nextStatus === 'concluido')
        await gerarComissao({ agendamento: appointment, connection, transactionContext });
      await historyRepository.create(
        {
          appointmentId: id,
          type: historyEventForStatus(nextStatus),
          previousStatus: appointment.status,
          nextStatus,
          changedBy: userId,
          note: justification?.trim() || null,
        },
        connection,
      );
    },
  });
  logger.info('appointment_status_changed', logContext);
  return appointmentRepository.findById(id);
}
