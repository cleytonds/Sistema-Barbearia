/** Remove campos internos sensíveis de uma assinatura antes de devolvê-la na API. */
export function serializeAssinatura(assinatura) {
  if (!assinatura) return assinatura;
  const publica = { ...assinatura };
  delete publica.idempotency_key_hash;
  delete publica.idempotency_payload_hash;
  return publica;
}
