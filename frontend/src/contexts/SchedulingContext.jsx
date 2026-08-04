import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { schedulingStorage } from '../utils/schedulingStorage.js';

const SchedulingContext = createContext(null);
const initial = {
  etapa: 0,
  servicoId: null,
  barbeiroId: null,
  data: null,
  horaInicio: null,
  observacoes: '',
};
export function SchedulingProvider({ children }) {
  const [state, setState] = useState(() => {
    const draft = schedulingStorage.read() ?? {};
    const etapa = draft.horaInicio
      ? 4
      : draft.data
        ? 3
        : draft.barbeiroId
          ? 2
          : draft.servicoId
            ? 1
            : 0;
    return { ...initial, ...draft, etapa };
  });
  const update = useCallback(
    (patch) =>
      setState((current) => {
        const next = { ...current, ...patch };
        const draft = { ...next };
        delete draft.etapa;
        schedulingStorage.save(draft);
        return next;
      }),
    [],
  );
  const value = useMemo(
    () => ({
      ...state,
      selecionarServico: (servicoId) =>
        update({ servicoId: String(servicoId), barbeiroId: null, data: null, horaInicio: null }),
      selecionarBarbeiro: (barbeiroId) =>
        update({ barbeiroId: String(barbeiroId), data: null, horaInicio: null }),
      selecionarData: (data) => update({ data, horaInicio: null }),
      selecionarHorario: (horaInicio) => update({ horaInicio }),
      atualizarObservacoes: (observacoes) => update({ observacoes }),
      avancar: () => update({ etapa: Math.min(4, state.etapa + 1) }),
      voltar: () => update({ etapa: Math.max(0, state.etapa - 1) }),
      irPara: (etapa) => update({ etapa }),
      limparHorario: () => update({ horaInicio: null }),
      abandonar: () => {
        schedulingStorage.clear();
        setState(initial);
      },
      concluir: () => {
        schedulingStorage.clear();
        setState(initial);
      },
    }),
    [state, update],
  );
  return <SchedulingContext.Provider value={value}>{children}</SchedulingContext.Provider>;
}
export function useScheduling() {
  return useContext(SchedulingContext);
}
