import { DateTime, IANAZone } from 'luxon';
import { AppError } from './AppError.js';

/** Verifica se o identificador representa um fuso IANA reconhecido. */
export function isValidTimeZone(zone) {
  return typeof zone === 'string' && IANAZone.isValidZone(zone);
}

/** Converte um instante para a data civil no fuso informado, sem deslocamento por UTC. */
export function civilDateAt(value, zone) {
  const instant = value instanceof Date ? value : new Date(value);
  const parsed = DateTime.fromJSDate(instant, { zone });
  if (!parsed.isValid) throw new AppError('Data inválida.', 422, 'INVALID_CIVIL_DATE');
  return parsed.toISODate();
}

/**
 * Converte um instante informado no horário local da barbearia para UTC.
 *
 * A comparação com o texto reformatado rejeita datas inexistentes ou ajustes
 * silenciosos feitos pelo parser, preservando exatamente o horário solicitado.
 *
 * @param {string} value Data e hora no formato ISO local, sem offset.
 * @param {string} zone Fuso IANA configurado, normalmente America/Recife.
 * @returns {Date}
 */
export function localToUtc(value, zone) {
  const format = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
    ? "yyyy-MM-dd'T'HH:mm"
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)
      ? "yyyy-MM-dd'T'HH:mm:ss"
      : null;
  const parsed = DateTime.fromISO(value, { zone, setZone: true });
  if (!format || !parsed.isValid || parsed.toFormat(format) !== value) {
    throw new AppError('Data e hora local inválida.', 422, 'VALIDATION_ERROR');
  }
  return parsed.toUTC().toJSDate();
}

/** Compara instantes na mesma precisão de minuto aceita por datetime-local. */
export function isBeforeCurrentLocalMinute(value, zone, now = new Date()) {
  const candidate = DateTime.fromJSDate(value, { zone });
  const currentMinute = DateTime.fromJSDate(now, { zone }).startOf('minute');
  return candidate < currentMinute;
}
