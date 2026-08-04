import { DateTime, IANAZone } from 'luxon';
import { AppError } from './AppError.js';

export function isValidTimeZone(zone) {
  return typeof zone === 'string' && IANAZone.isValidZone(zone);
}

export function localToUtc(value, zone) {
  const parsed = DateTime.fromISO(value, { zone, setZone: true });
  if (!parsed.isValid || parsed.toFormat("yyyy-MM-dd'T'HH:mm:ss") !== value) {
    throw new AppError('Data e hora local inválida.', 422, 'VALIDATION_ERROR');
  }
  return parsed.toUTC().toJSDate();
}
