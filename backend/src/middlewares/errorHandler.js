import { env } from '../config/env.js';

export function errorHandler(error, _req, res, _next) {
  const statusCode = error.statusCode ?? 500;
  const isProduction = env.nodeEnv === 'production';

  if (statusCode >= 500) {
    console.error('[api:error]', error.message);
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
