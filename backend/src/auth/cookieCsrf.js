import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function assertCookieCsrf(request) {
  if (request.auth?.method !== 'cookie' || SAFE_METHODS.has(request.method)) return;
  if (!env.frontendOrigins.includes(request.get('origin'))) {
    throw new AppError('Origem da requisição não permitida.', 403, 'CSRF_ORIGIN_REJECTED');
  }
  if (request.get('x-csrf-protection') !== '1') {
    throw new AppError('Proteção CSRF obrigatória.', 403, 'CSRF_PROTECTION_REQUIRED');
  }
}
