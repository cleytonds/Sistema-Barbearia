import { api } from '../api/client.js';
import { apiError } from '../utils/apiError.js';

async function request(call, signal) {
  try {
    const response = await call();
    return { ...response.data, replayed: response.headers['idempotent-replayed'] === 'true' };
  } catch (error) {
    if (signal?.aborted) throw error;
    throw apiError(error);
  }
}

export const agendamentoService = {
  meus: ({ params, signal }) =>
    request(() => api.get('/agendamentos/meus', { params, signal }), signal),
  criar: ({ data, idempotencyKey, signal }) =>
    request(
      () =>
        api.post('/agendamentos', data, { signal, headers: { 'Idempotency-Key': idempotencyKey } }),
      signal,
    ),
  cancelar: ({ id, motivo, signal }) =>
    request(() => api.put(`/agendamentos/${id}/cancelar`, { motivo }, { signal }), signal),
  reagendar: ({ id, data, signal }) =>
    request(() => api.put(`/agendamentos/${id}/reagendar`, data, { signal }), signal),
};
