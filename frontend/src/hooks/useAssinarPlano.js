import { useCallback, useRef, useState } from 'react';
import { planoService } from '../services/planoService.js';
import { createIdempotencyKey } from '../utils/idempotencyKey.js';

/**
 * Assina um plano com Idempotency-Key única por tentativa.
 * Nunca reutiliza a mesma chave entre chamadas distintas.
 */
export function useAssinarPlano() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const busy = useRef(false);

  const assinar = useCallback(async (planoId, data, { key } = {}) => {
    if (busy.current) return null;
    busy.current = true;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const freshKey = key ?? createIdempotencyKey();
      const result = await planoService.sign(planoId, data, freshKey);
      setSuccess(result);
      return result;
    } catch (requestError) {
      setError(requestError);
      throw requestError;
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  return { assinar, loading, error, success };
}
