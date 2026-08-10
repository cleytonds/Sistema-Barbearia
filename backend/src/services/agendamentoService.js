import { runTransactionWithRetry } from '../database/transactionRetry.js';
import { APPOINTMENT_ORIGIN, APPOINTMENT_STATUS } from '../domain/appointments/constants.js';
import {
  buildIdempotency,
  isIdempotencyDuplicate,
  sameHash,
} from '../domain/appointments/idempotency.js';
import { serializeAppointment } from '../domain/appointments/serializers.js';
import { buildBookingSnapshot } from '../domain/appointments/snapshots.js';
import * as appointmentRepository from '../repositories/agendamentoRepository.js';
import * as availabilityRepository from '../repositories/disponibilidadeRepository.js';
import * as historyRepository from '../repositories/historicoAgendamentoRepository.js';
import { AppError } from '../utils/AppError.js';
import { localToUtc } from '../utils/dateTime.js';
import { logger } from '../utils/logger.js';
import { AVAILABILITY_MODE, validateAvailability } from './disponibilidadeService.js';
import { decidirCobertura } from './coberturaPlanoService.js';
import { reservarUso } from './usoPlanoService.js';

function replayResult(row, payloadHash, logContext) {
  if (!sameHash(row.idempotency_payload_hash, payloadHash)) {
    logger.warn('appointment_idempotency_conflict', logContext);
    throw new AppError('A chave já foi usada com outro conteúdo.', 409, 'IDEMPOTENCY_KEY_CONFLICT');
  }
  logger.info('appointment_idempotent_replay', {
    ...logContext,
    agendamentoId: String(row.id),
  });
  return { appointment: serializeAppointment(row, row.fuso_horario), replayed: true };
}

async function createTransactional({
  actorId,
  clientId,
  origin,
  status,
  payload,
  key,
  nowUtc,
  requestId,
}) {
  const startedAt = Date.now();
  const idempotency = buildIdempotency({
    key,
    operation: 'create-appointment',
    actorId,
    clientId,
    payload,
  });
  const lookup = { actorId, origin, keyHash: idempotency.keyHash };
  const logContext = {
    requestId,
    usuarioId: actorId,
    barbeiroId: payload.barbeiroId,
    operation: 'appointment_create',
  };
  const existing = await appointmentRepository.findByIdempotency(lookup);
  if (existing) return replayResult(existing, idempotency.payloadHash, logContext);

  const settings = await appointmentRepository.findSettings();
  const startAt = localToUtc(`${payload.data}T${payload.horaInicio}:00`, settings.fuso_horario);
  let id;
  try {
    id = await runTransactionWithRetry({
      logContext,
      operation: async ({ connection, transactionContext }) => {
        await availabilityRepository.lockBarber(payload.barbeiroId, connection);
        const client = await appointmentRepository.findActiveClient(clientId, connection);
        if (!client) throw new AppError('Cliente não encontrado.', 404, 'CLIENT_NOT_FOUND');
        const coverage = await decidirCobertura({
          clienteId: clientId,
          servicoId: payload.servicoId,
          barbeiroId: payload.barbeiroId,
          data: payload.data,
          connection,
        });
        const availability = await validateAvailability({
          barbeiroId: payload.barbeiroId,
          servicoId: payload.servicoId,
          inicioUtc: startAt,
          connection: transactionContext,
          mode: AVAILABILITY_MODE.TRANSACTIONAL,
          nowUtc,
        });
        const snapshot = buildBookingSnapshot({
          startUtc: startAt,
          price: availability.servicePrice,
          durationMinutes: availability.serviceDurationMinutes,
          bufferMinutes: availability.bufferMinutes,
        });
        const appointmentId = await appointmentRepository.create(
          {
            clientId,
            barberId: payload.barbeiroId,
            serviceId: payload.servicoId,
            createdBy: actorId,
            origin,
            status,
            snapshot,
            clientNotes: payload.observacoes,
            internalNotes: payload.observacoesInternas,
            keyHash: idempotency.keyHash,
            payloadHash: idempotency.payloadHash,
            billingType: coverage.tipoCobranca,
            subscriptionId: coverage.assinaturaId,
            planId: coverage.planoId,
            planName: coverage.planoNome,
            coverageConfirmedAt: coverage.tipoCobranca === 'plano' ? nowUtc : null,
          },
          connection,
        );
        if (coverage.tipoCobranca === 'plano') {
          await reservarUso({
            assinatura: coverage.assinatura,
            agendamentoId: appointmentId,
            data: payload.data,
            actorId,
            connection,
            transactionContext,
          });
        }
        await historyRepository.create(
          {
            appointmentId,
            type: 'criado',
            previousStatus: null,
            nextStatus: status,
            changedBy: actorId,
            newData: {
              inicioEm: snapshot.startAt,
              fimEm: snapshot.endAt,
              fimOcupacaoEm: snapshot.occupiedUntilAt,
              tipoCobranca: coverage.tipoCobranca,
              planoId: coverage.planoId ?? null,
            },
          },
          connection,
        );
        return appointmentId;
      },
    });
  } catch (error) {
    if (isIdempotencyDuplicate(error)) {
      const winner = await appointmentRepository.findByIdempotency(lookup);
      if (!winner)
        throw new AppError(
          'Não foi possível confirmar a operação.',
          409,
          'IDEMPOTENCY_RETRY_REQUIRED',
        );
      return replayResult(winner, idempotency.payloadHash, logContext);
    }
    if (error.code === 'AVAILABILITY_CHANGED') {
      logger.warn('appointment_availability_changed', { ...logContext, errorCode: error.code });
    }
    throw error;
  }
  const created = await appointmentRepository.findById(id);
  logger.info('appointment_created', {
    ...logContext,
    agendamentoId: String(id),
    durationMs: Date.now() - startedAt,
  });
  return { appointment: serializeAppointment(created, created.fuso_horario), replayed: false };
}

export function createClient({ userId, payload, key, nowUtc = new Date(), requestId }) {
  return createTransactional({
    actorId: userId,
    clientId: userId,
    origin: APPOINTMENT_ORIGIN.CLIENT,
    status: APPOINTMENT_STATUS.PENDING,
    payload,
    key,
    nowUtc,
    requestId,
  });
}

export function createAdmin({ userId, payload, key, nowUtc = new Date(), requestId }) {
  return createTransactional({
    actorId: userId,
    clientId: payload.clienteId,
    origin: APPOINTMENT_ORIGIN.ADMIN,
    status: APPOINTMENT_STATUS.CONFIRMED,
    payload,
    key,
    nowUtc,
    requestId,
  });
}
