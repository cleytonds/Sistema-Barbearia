import { DateTime, IANAZone } from 'luxon';
import { AppError } from './AppError.js';

/** Verifica se o identificador representa um fuso IANA reconhecido. */
export function isValidTimeZone(zone) {
  return typeof zone === 'string' && IANAZone.isValidZone(zone);
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
  const parsed = DateTime.fromISO(value, { zone, setZone: true });
  if (!parsed.isValid || parsed.toFormat("yyyy-MM-dd'T'HH:mm:ss") !== value) {
    throw new AppError('Data e hora local inválida.', 422, 'VALIDATION_ERROR');
  }
  return parsed.toUTC().toJSDate();
}
