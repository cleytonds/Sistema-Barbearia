import { AppError } from '../../utils/AppError.js';

export const AVAILABILITY_MODE = Object.freeze({
  READ_ONLY: 'read_only',
  TRANSACTIONAL: 'transactional',
});

/** Garante que decisões críticas de concorrência usem somente modos conhecidos. */
export function assertAvailabilityMode(mode) {
  if (!Object.values(AVAILABILITY_MODE).includes(mode)) {
    throw new AppError('Modo de disponibilidade inválido.', 500, 'INVALID_AVAILABILITY_MODE');
  }
  return mode;
}
