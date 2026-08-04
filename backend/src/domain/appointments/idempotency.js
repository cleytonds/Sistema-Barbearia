import { createHash } from 'node:crypto';
import { AppError } from '../../utils/AppError.js';
import { IDEMPOTENCY_KEY_PATTERN } from './constants.js';

const hash = (value) => createHash('sha256').update(value).digest();

export function validateIdempotencyKey(value) {
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw new AppError('Idempotency-Key obrigatório ou inválido.', 422, 'IDEMPOTENCY_KEY_REQUIRED');
  }
  return value;
}

/** Gera hashes binários sem persistir a chave original. */
export function buildIdempotency({ key, operation, actorId, clientId, payload }) {
  validateIdempotencyKey(key);
  const canonical = JSON.stringify({
    operation,
    actorId: String(actorId),
    clientId: String(clientId),
    barberId: String(payload.barbeiroId),
    serviceId: String(payload.servicoId),
    date: payload.data,
    time: payload.horaInicio,
    observations: String(payload.observacoes ?? payload.observacoesInternas ?? '').trim(),
  });
  return { keyHash: hash(key), payloadHash: hash(canonical) };
}

export function sameHash(left, right) {
  return Buffer.isBuffer(left) && Buffer.isBuffer(right) && left.equals(right);
}

export function isIdempotencyDuplicate(error) {
  return (
    error?.code === 'ER_DUP_ENTRY' &&
    String(error?.message).includes('uq_agendamentos_idempotencia')
  );
}
