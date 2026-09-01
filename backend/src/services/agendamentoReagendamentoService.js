import { runTransactionWithRetry } from '../database/transactionRetry.js';
import { assertClientOwner } from '../domain/appointments/permissions.js';
import { assertReschedule } from '../domain/appointments/rescheduleRules.js';
import { buildBookingSnapshot } from '../domain/appointments/snapshots.js';
import * as appointmentRepository from '../repositories/agendamentoRepository.js';
import * as availabilityRepository from '../repositories/disponibilidadeRepository.js';
import * as historyRepository from '../repositories/historicoAgendamentoRepository.js';
import { AppError } from '../utils/AppError.js';
import { localToUtc } from '../utils/dateTime.js';
import { logger } from '../utils/logger.js';
import {
  assertClientNextDayBookingDate,
  AVAILABILITY_MODE,
  validateAvailability,
} from './disponibilidadeService.js';
import { decidirCobertura } from './coberturaPlanoService.js';
import { atualizarUsoNoReagendamento } from './usoPlanoService.js';

export async function reschedule({ id, userId, role, payload, nowUtc = new Date(), requestId }) {
  const preliminary =
    role === 'cliente'
      ? await appointmentRepository.findClientAppointmentById(id, userId)
      : await appointmentRepository.findByIdWithoutLock(id);
  if (!preliminary) throw new AppError('Agendamento não encontrado.', 404, 'APPOINTMENT_NOT_FOUND');
  const settings = await appointmentRepository.findSettings();
  if (role === 'cliente')
    assertClientNextDayBookingDate(payload.data, settings.fuso_horario, nowUtc);
  const newStartAt = localToUtc(`${payload.data}T${payload.horaInicio}:00`, settings.fuso_horario);
  const logContext = {
    requestId,
    usuarioId: userId,
    agendamentoId: id,
    barbeiroId: preliminary.barbeiro_id,
    operation: 'appointment_reschedule',
  };
  try {
    await runTransactionWithRetry({
      logContext,
      operation: async ({ connection, transactionContext }) => {
        await availabilityRepository.lockBarber(preliminary.barbeiro_id, connection);
        const appointment =
          role === 'cliente'
            ? await appointmentRepository.findClientAppointmentByIdForUpdate(id, userId, connection)
            : await appointmentRepository.findByIdForUpdate(id, connection);
        if (!appointment || String(appointment.barbeiro_id) !== String(preliminary.barbeiro_id)) {
          throw new AppError('Agendamento não encontrado.', 404, 'APPOINTMENT_NOT_FOUND');
        }
        if (role === 'cliente') assertClientOwner(appointment, userId);
        const lockedSettings = await appointmentRepository.findSettings(connection);
        assertReschedule({
          appointment,
          newStartAt,
          minimumHours: lockedSettings.tempo_minimo_cancelamento_horas,
          nowUtc,
          isAdmin: role === 'admin',
        });
        const deadline =
          new Date(appointment.inicio_em).getTime() -
          lockedSettings.tempo_minimo_cancelamento_horas * 3_600_000;
        if (
          role === 'admin' &&
          new Date(nowUtc).getTime() > deadline &&
          !payload.justificativa?.trim()
        ) {
          throw new AppError('Justificativa obrigatória.', 422, 'VALIDATION_ERROR');
        }
        await validateAvailability({
          barbeiroId: appointment.barbeiro_id,
          servicoId: appointment.servico_id,
          inicioUtc: newStartAt,
          excludeAppointmentId: appointment.id,
          connection: transactionContext,
          mode: AVAILABILITY_MODE.TRANSACTIONAL,
          nowUtc,
          bookingSnapshot: {
            durationMinutes: appointment.duracao_minutos,
            bufferMinutes: appointment.buffer_minutos,
          },
        });
        const snapshot = buildBookingSnapshot({
          startUtc: newStartAt,
          price: appointment.preco,
          durationMinutes: appointment.duracao_minutos,
          bufferMinutes: appointment.buffer_minutos,
        });
        let convertedToSingle = false;
        if (appointment.tipo_cobranca === 'plano') {
          const coverage = await decidirCobertura({
            clienteId: appointment.cliente_id,
            servicoId: appointment.servico_id,
            barbeiroId: appointment.barbeiro_id,
            data: payload.data,
            connection,
            agendamentoIdIgnorado: appointment.id,
          });
          const continuesCovered =
            coverage.tipoCobranca === 'plano' &&
            String(coverage.assinaturaId) === String(appointment.assinatura_plano_id);
          await atualizarUsoNoReagendamento({
            agendamentoId: appointment.id,
            assinatura: coverage.assinatura,
            data: payload.data,
            continuaCoberto: continuesCovered,
            actorId: userId,
            connection,
            transactionContext,
            now: nowUtc,
          });
          if (!continuesCovered) {
            convertedToSingle = true;
            await appointmentRepository.updatePlanCoverage(
              { id, coverage: { tipoCobranca: 'avulso' } },
              connection,
            );
          }
        }
        await appointmentRepository.updateReschedule({ id, snapshot }, connection);
        await historyRepository.create(
          {
            appointmentId: id,
            type: 'reagendado',
            previousStatus: appointment.status,
            nextStatus: appointment.status,
            changedBy: userId,
            note: payload.justificativa?.trim() || null,
            previousData: {
              inicioEm: appointment.inicio_em,
              fimEm: appointment.fim_em,
              fimOcupacaoEm: appointment.fim_ocupacao_em,
            },
            newData: {
              inicioEm: snapshot.startAt,
              fimEm: snapshot.endAt,
              fimOcupacaoEm: snapshot.occupiedUntilAt,
              ...(convertedToSingle && { tipoCobranca: 'avulso', coberturaAnterior: 'plano' }),
            },
          },
          connection,
        );
      },
    });
  } catch (error) {
    if (error.code === 'AVAILABILITY_CHANGED') {
      logger.warn('appointment_availability_changed', { ...logContext, errorCode: error.code });
    }
    throw error;
  }
  logger.info('appointment_rescheduled', logContext);
  return appointmentRepository.findById(id);
}
