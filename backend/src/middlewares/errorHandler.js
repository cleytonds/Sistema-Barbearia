import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export function errorHandler(error, req, res, _next) {
  const statusCode = error.statusCode ?? 500;
  const isProduction = env.nodeEnv === 'production';

  if (statusCode >= 500) {
    logger.error('api_unexpected_error', {
      requestId: req.requestId,
      usuarioId: req.auth?.usuario?.id,
      errorCode: error.code ?? 'INTERNAL_ERROR',
      operation: `${req.method} ${req.path}`,
    });
  }

  res.status(statusCode).json({
    error: {
      code: error.code ?? 'INTERNAL_ERROR',
      message: statusCode >= 500 && isProduction ? 'Erro interno do servidor.' : error.message,
      ...(error.details && { details: error.details }),
      ...(!isProduction && error.stack && { stack: error.stack }),
    },
  });
}
