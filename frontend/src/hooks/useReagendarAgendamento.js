import { useCallback, useRef, useState } from 'react';
import { agendamentoService } from '../services/agendamentoService.js';

export function useReagendarAgendamento() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const busy = useRef(false);
  const reagendar = useCallback(async (id, data) => {
    if (busy.current) return null;
    busy.current = true;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await agendamentoService.reagendar({ id, data });
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
  return { reagendar, loading, error, success };
}
