/**
 * Valida preços decimais sem aceitar notação científica ou arredondamento implícito.
 * O banco recebe no máximo duas casas decimais, exatamente como informado pela API.
 */
export function isMoney(value) {
  return typeof value === 'string' && /^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(value);
}
