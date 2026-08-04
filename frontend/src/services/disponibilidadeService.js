import { api } from '../api/client.js';
import { apiError } from '../utils/apiError.js';

/** Consulta horários públicos e permite cancelamento da requisição em andamento. */
export async function getDisponibilidade({ barbeiroId, servicoId, data, signal }) {
  try {
    const response = await api.get('/disponibilidade', {
      params: { barbeiroId, servicoId, data },
      signal,
    });
    return response.data;
  } catch (error) {
    // Cancelamentos precisam permanecer reconhecíveis para não virarem erro visual.
    if (signal?.aborted) throw error;
    throw apiError(error);
  }
}
