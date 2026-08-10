/** Remove campos internos sensíveis de uma assinatura antes de devolvê-la na API. */
export function serializeAssinatura(assinatura) {
  if (!assinatura) return assinatura;
  const publica = { ...assinatura };
  delete publica.idempotency_key_hash;
  delete publica.idempotency_payload_hash;
  return stringifyIds(publica);
}

export function stringifyIds(value) {
  if (Array.isArray(value)) return value.map((item) => stringifyIds(item));
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(
    Object.entries(value).map(([itemKey, itemValue]) => {
      const isId = itemKey === 'id' || itemKey.endsWith('_id') || itemKey.endsWith('Id');
      return [
        itemKey,
        isId && itemValue != null ? String(itemValue) : stringifyIds(itemValue, itemKey),
      ];
    }),
  );
}
