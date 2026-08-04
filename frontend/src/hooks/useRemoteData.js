import { useCallback, useEffect, useState } from 'react';

import { apiError } from '../utils/apiError.js';

/**
 * Carrega dados remotos e expõe um estado uniforme de carregamento e erro.
 *
 * O chamador controla explicitamente quando o loader deve ser recriado por meio
 * de `dependencies`, da mesma forma que faria ao usar `useCallback` diretamente.
 *
 * @param {() => Promise<unknown>} loader
 * @param {unknown[]} dependencies
 * @returns {{data: unknown, loading: boolean, error: unknown, reload: () => Promise<void>}}
 */
export function useRemoteData(loader, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // A lista é parte da API do hook; incluir `loader` causaria recargas em cada render
  // quando o chamador fornece uma função inline.
  /* eslint-disable react-hooks/exhaustive-deps */
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loader());
    } catch (requestError) {
      setError(apiError(requestError));
    } finally {
      setLoading(false);
    }
  }, dependencies);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}
