import { AppError } from './AppError.js';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function parsePagination(query, allowedSorts, defaultSort = 'id') {
  const page = Number.parseInt(query.page ?? '1', 10);
  const limit = Number.parseInt(query.limit ?? String(DEFAULT_PAGE_SIZE), 10);
  const order = String(query.order ?? 'asc').toLowerCase();
  const sort = String(query.sort ?? defaultSort);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new AppError('Paginação inválida.', 422, 'VALIDATION_ERROR');
  }
  if (!allowedSorts[sort] || !['asc', 'desc'].includes(order)) throw new AppError('Ordenação inválida.', 422, 'VALIDATION_ERROR');
  return { page, limit, offset: (page - 1) * limit, sortColumn: allowedSorts[sort], order: order.toUpperCase() };
}

export function paginationResult(data, total, { page, limit }) {
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
