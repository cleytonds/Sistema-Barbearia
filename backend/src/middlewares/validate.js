import { validationResult } from 'express-validator';
import { AppError } from '../utils/AppError.js';

export function validate(req, _res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const details = result
      .array({ onlyFirstError: true })
      .map(({ path, msg }) => ({ campo: path, mensagem: msg }));
    return next(new AppError('Dados inválidos.', 422, 'VALIDATION_ERROR', details));
  }
  next();
}
