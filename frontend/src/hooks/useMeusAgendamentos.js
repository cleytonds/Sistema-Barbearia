import { useCallback, useEffect, useRef, useState } from 'react';
import { agendamentoService } from '../services/agendamentoService.js';

export function useMeusAgendamentos(params = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const controller = useRef();
  const serialized = JSON.stringify(params);
  const reload = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    setError(null);
    try {
      setData(
        await agendamentoService.meus({ params: JSON.parse(serialized), signal: current.signal }),
      );
    } catch (requestError) {
      if (!current.signal.aborted) setError(requestError);
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }, [serialized]);
  useEffect(() => {
    reload();
    return () => controller.current?.abort();
  }, [reload]);
  return { data, loading, error, reload };
}
