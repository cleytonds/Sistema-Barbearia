/** Normaliza e-mails para que comparações e índices únicos sejam consistentes. */
export function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

/** Remove caracteres de apresentação e mantém somente os dígitos do telefone. */
export function normalizePhone(value) {
  return value.replace(/\D/g, '');
}

/** Remove espaços externos e reduz sequências internas a um único espaço. */
export function normalizeName(value) {
  return value.trim().replace(/\s+/g, ' ');
}
