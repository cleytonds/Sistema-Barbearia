import * as clients from '../repositories/clienteAdminRepository.js';
import * as queryService from './agendamentoQueryService.js';
import { AppError } from '../utils/AppError.js';
import { paginationResult, parsePagination } from '../utils/pagination.js';
const sorts = { inicio: 'a.inicio_em', criadoEm: 'a.criado_em', status: 'a.status' };
export async function list(query) {
  const pagination = parsePagination(query, { nome: 'nome' }, 'nome');
  const result = await clients.list({ search: query.search.trim(), pagination });
  return paginationResult(
    result.rows.map((row) => ({ ...row, id: String(row.id) })),
    result.total,
    pagination,
  );
}
export async function history(id, query) {
  const client = await clients.find(id);
  if (!client) throw new AppError('Cliente não encontrado.', 404, 'CLIENT_NOT_FOUND');
  const [summary, appointments] = await Promise.all([
    clients.summary(id),
    queryService.listAdmin({ ...query, clienteId: id }, parsePagination(query, sorts, 'inicio')),
  ]);
  return {
    cliente: { ...client, id: String(client.id) },
    resumo: {
      total: Number(summary.counts.total),
      proximos: Number(summary.counts.proximos ?? 0),
      concluidos: Number(summary.counts.concluidos ?? 0),
      cancelados: Number(summary.counts.cancelados ?? 0),
      ausentes: Number(summary.counts.ausentes ?? 0),
    },
    servicos: summary.services.map((item) => ({ ...item, id: String(item.id) })),
    profissionais: summary.barbers.map((item) => ({ ...item, id: String(item.id) })),
    agendamentos: appointments,
  };
}
