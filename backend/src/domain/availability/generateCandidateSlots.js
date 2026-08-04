import { SLOT_INTERVAL_MINUTES } from './constants.js';

/** Gera somente minutos locais candidatos, sem consultar disponibilidade externa. */
export function generateCandidateSlots({
  startMinute,
  endMinute,
  intervalMinutes = SLOT_INTERVAL_MINUTES,
}) {
  const candidates = [];
  for (let minute = startMinute; minute < endMinute; minute += intervalMinutes) {
    candidates.push(minute);
  }
  return candidates;
}
