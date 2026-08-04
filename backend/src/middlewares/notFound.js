import { AppError } from '../utils/AppError.js';

export function notFound(req, _res, next) {
  next(
    new AppError(`Rota ${req.method} ${req.originalUrl} não encontrada.`, 404, 'ROUTE_NOT_FOUND'),
  );
}
