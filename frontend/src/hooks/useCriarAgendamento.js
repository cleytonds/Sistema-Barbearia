import { useCallback, useRef, useState } from 'react';
import { agendamentoService } from '../services/agendamentoService.js';
import { createIdempotencyKey } from '../utils/idempotencyKey.js';

export function useCriarAgendamento() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const attemptKey = useRef(null);
  const busy = useRef(false);
  const criar = useCallback(async (data) => {
    if (busy.current) return null;
    busy.current = true;
    setLoading(true);
    setError(null);
    setSuccess(null);
    attemptKey.current ??= createIdempotencyKey();
    try {
      const result = await agendamentoService.criar({ data, idempotencyKey: attemptKey.current });
      setSuccess(result);
      attemptKey.current = null;
      return result;
    } catch (requestError) {
      setError(requestError);
      throw requestError;
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);
  const novaTentativa = useCallback(() => {
    attemptKey.current = null;
    setError(null);
    setSuccess(null);
  }, []);
  return { criar, novaTentativa, loading, error, success };
}
