import { overlaps } from './overlap.js';

/** Converte TIME do MySQL, HH:mm ou HH:mm:ss, em minutos desde meia-noite. */
export function timeToMinutes(time) {
  const [hours, minutes] = String(time).split(':').map(Number);
  return hours * 60 + minutes;
}

function toPause(start, end) {
  return start == null || end == null
    ? null
    : { start: timeToMinutes(start), end: timeToMinutes(end) };
}

/**
 * Cria a interseção entre funcionamento e jornada e reúne suas pausas.
 * Retorna null quando não existe janela ativa comum.
 */
export function buildWorkingWindow(businessHours, barberHours) {
  if (!businessHours?.ativo || !barberHours?.ativo) return null;

  const startMinute = Math.max(
    timeToMinutes(businessHours.hora_inicio),
    timeToMinutes(barberHours.hora_inicio),
  );
  const endMinute = Math.min(
    timeToMinutes(businessHours.hora_fim),
    timeToMinutes(barberHours.hora_fim),
  );
  if (endMinute <= startMinute) return null;

  const windowPeriod = { start: startMinute, end: endMinute };
  const pauses = [
    toPause(businessHours.intervalo_inicio, businessHours.intervalo_fim),
    toPause(barberHours.intervalo_inicio, barberHours.intervalo_fim),
  ]
    .filter(Boolean)
    .filter((pause) => overlaps(windowPeriod, pause));

  return { startMinute, endMinute, pauses };
}

export function fitsWorkingWindow(period, workingWindow) {
  return period.start >= workingWindow.startMinute && period.end <= workingWindow.endMinute;
}

export function crossesPause(period, pauses) {
  return pauses.some((pause) => overlaps(period, pause));
}
