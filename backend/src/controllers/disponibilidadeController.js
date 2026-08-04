import * as disponibilidadeService from '../services/disponibilidadeService.js';

export async function list(request, response) {
  const result = await disponibilidadeService.listAvailability({
    barbeiroId: Number(request.query.barbeiroId),
    servicoId: Number(request.query.servicoId),
    date: request.query.data,
  });
  response.set('Cache-Control', 'no-store').json(result);
}
