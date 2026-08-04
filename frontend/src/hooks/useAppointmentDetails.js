import { useCallback, useEffect, useRef, useState } from 'react';
import { agendamentoService } from '../services/agendamentoService.js';
export function useAppointmentDetails(id) {
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(null);
  const controller = useRef();
  const reload = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    setError(null);
    try {
      setData((await agendamentoService.getById(id, { signal: current.signal })).data);
    } catch (requestError) {
      if (!current.signal.aborted) setError(requestError);
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    reload();
    return () => controller.current?.abort();
  }, [reload]);
  return { data, loading, error, reload, setData };
}
