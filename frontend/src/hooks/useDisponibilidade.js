import { useCallback, useEffect, useRef, useState } from 'react';

import { getDisponibilidade } from '../services/disponibilidadeService.js';
import { apiError } from '../utils/apiError.js';

/**
 * Carrega disponibilidade e cancela respostas obsoletas quando os filtros mudam.
 */
export function useDisponibilidade({ barbeiroId, servicoId, data }) {
  const [disponibilidade, setDisponibilidade] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const controllerRef = useRef(null);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    controllerRef.current?.abort();
    if (!barbeiroId || !servicoId || !data) {
      setDisponibilidade(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    controllerRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const result = await getDisponibilidade({
        barbeiroId,
        servicoId,
        data,
        signal: controller.signal,
      });
      if (requestId === requestIdRef.current) setDisponibilidade(result);
    } catch (requestError) {
      if (!controller.signal.aborted && requestId === requestIdRef.current) {
        setError(requestError?.code ? requestError : apiError(requestError));
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [barbeiroId, servicoId, data]);

  useEffect(() => {
    reload();
    return () => controllerRef.current?.abort();
  }, [reload]);

  return { disponibilidade, loading, error, reload };
}
