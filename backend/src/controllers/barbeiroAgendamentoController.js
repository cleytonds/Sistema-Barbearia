import * as queryService from '../services/agendamentoQueryService.js';
import * as statusService from '../services/agendamentoStatusService.js';
import { parsePagination } from '../utils/pagination.js';

const sorts = { inicio: 'a.inicio_em', criadoEm: 'a.criado_em', status: 'a.status' };
export async function list(request, response) {
  response.json(
    await queryService.listBarber(
      request.auth.usuario.id,
      request.query,
      parsePagination(request.query, sorts, 'inicio'),
    ),
  );
}
export async function detail(request, response) {
  response.json({
    data: await queryService.detail({
      id: request.params.id,
      userId: request.auth.usuario.id,
      role: 'barbeiro',
    }),
  });
}
export async function updateStatus(request, response) {
  await statusService.updateStatus({
    id: request.params.id,
    userId: request.auth.usuario.id,
    role: 'barbeiro',
    nextStatus: request.body.status,
    justification: request.body.justificativa,
    requestId: request.requestId,
  });
  response.json({
    data: await queryService.detail({
      id: request.params.id,
      userId: request.auth.usuario.id,
      role: 'barbeiro',
    }),
  });
}
