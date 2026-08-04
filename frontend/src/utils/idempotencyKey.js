/** Gera uma chave imprevisível sem armazená-la global ou persistentemente. */
export function createIdempotencyKey() {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
