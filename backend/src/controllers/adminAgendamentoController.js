import * as appointmentService from '../services/agendamentoService.js';
import { IDEMPOTENCY_KEY_HEADER } from '../config/httpConfig.js';
import * as cancellationService from '../services/agendamentoCancelamentoService.js';
import * as queryService from '../services/agendamentoQueryService.js';
import * as rescheduleService from '../services/agendamentoReagendamentoService.js';
import * as statusService from '../services/agendamentoStatusService.js';
import { parsePagination } from '../utils/pagination.js';

const sorts = { inicio: 'a.inicio_em', criadoEm: 'a.criado_em', status: 'a.status' };
export async function create(request, response) {
  const result = await appointmentService.createAdmin({
    userId: request.auth.usuario.id,
    payload: request.body,
    key: request.get(IDEMPOTENCY_KEY_HEADER),
    requestId: request.requestId,
  });
  response.set('Idempotent-Replayed', String(result.replayed));
  response.status(result.replayed ? 200 : 201).json({ data: result.appointment });
}
export async function list(request, response) {
  response.json(
    await queryService.listAdmin(request.query, parsePagination(request.query, sorts, 'inicio')),
  );
}
export async function detail(request, response) {
  response.json({
    data: await queryService.detail({
      id: request.params.id,
      userId: request.auth.usuario.id,
      role: 'admin',
    }),
  });
}
async function updatedDetail(request) {
  return queryService.detail({
    id: request.params.id,
    userId: request.auth.usuario.id,
    role: 'admin',
  });
}
export async function cancel(request, response) {
  await cancellationService.cancel({
    id: request.params.id,
    userId: request.auth.usuario.id,
    role: 'admin',
    reason: request.body.motivo,
    responsibility: request.body.responsabilidade,
    requestId: request.requestId,
  });
  response.json({ data: await updatedDetail(request) });
}
export async function reschedule(request, response) {
  await rescheduleService.reschedule({
    id: request.params.id,
    userId: request.auth.usuario.id,
    role: 'admin',
    payload: request.body,
    requestId: request.requestId,
  });
  response.json({ data: await updatedDetail(request) });
}
export async function updateStatus(request, response) {
  await statusService.updateStatus({
    id: request.params.id,
    userId: request.auth.usuario.id,
    role: 'admin',
    nextStatus: request.body.status,
    justification: request.body.justificativa,
    requestId: request.requestId,
  });
  response.json({ data: await updatedDetail(request) });
}
