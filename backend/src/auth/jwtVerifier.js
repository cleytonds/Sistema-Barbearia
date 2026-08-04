import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function verifyAccessToken(token) {
  if (!env.jwt.isConfigured) throw new AppError('JWT não configurado no servidor.', 500, 'JWT_NOT_CONFIGURED');
  try {
    const payload = jwt.verify(token, env.jwt.secret, {
      algorithms: ['HS256'],
      issuer: env.jwt.issuer,
      audience: env.jwt.audience
    });
    if (!payload.sub || !payload.jti || !Number.isInteger(payload.ver) || payload.ver < 1) {
      throw new Error('Payload inválido');
    }
    return payload;
  } catch (error) {
    if (error.name === 'TokenExpiredError') throw new AppError('Sessão expirada.', 401, 'EXPIRED_TOKEN');
    throw new AppError('Token inválido.', 401, 'INVALID_TOKEN');
  }
}

