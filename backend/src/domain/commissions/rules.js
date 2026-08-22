import { AppError } from '../../utils/AppError.js';

const DECIMAL_PATTERN = /^\d+(?:\.\d{1,2})?$/;

function decimalToHundredths(value, field) {
  const normalized = String(value);
  if (!DECIMAL_PATTERN.test(normalized))
    throw new AppError(`${field} inválido.`, 422, 'INVALID_COMMISSION_VALUE');
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

export function assertCommissionPercentage(value) {
  const hundredths = decimalToHundredths(value, 'Percentual');
  if (hundredths > 10000n)
    throw new AppError(
      'Percentual deve estar entre 0 e 100.',
      422,
      'INVALID_COMMISSION_PERCENTAGE',
    );
  return hundredths;
}

export function calculateCommission(baseValue, percentage) {
  const baseCents = decimalToHundredths(baseValue, 'Valor-base');
  const percentageHundredths = assertCommissionPercentage(percentage);
  const commissionCents = (baseCents * percentageHundredths + 5000n) / 10000n;
  return `${commissionCents / 100n}.${String(commissionCents % 100n).padStart(2, '0')}`;
}
