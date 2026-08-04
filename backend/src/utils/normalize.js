export function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

export function normalizePhone(value) {
  return value.replace(/\D/g, '');
}

export function normalizeName(value) {
  return value.trim().replace(/\s+/g, ' ');
}

