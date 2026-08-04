export function isMoney(value) {
  return typeof value === 'string' && /^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(value);
}
