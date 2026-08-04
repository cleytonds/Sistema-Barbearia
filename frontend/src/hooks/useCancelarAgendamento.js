import { useCallback, useRef, useState } from 'react';
import { agendamentoService } from '../services/agendamentoService.js';

export function useCancelarAgendamento() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const busy = useRef(false);
  const cancelar = useCallback(async (id, motivo) => {
    if (busy.current) return null;
    busy.current = true;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await agendamentoService.cancelar({ id, motivo });
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
  return { cancelar, loading, error, success };
}
