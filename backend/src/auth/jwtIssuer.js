import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

function assertConfigured() {
  if (!env.jwt.isConfigured) {
    throw new AppError('JWT não configurado no servidor.', 500, 'JWT_NOT_CONFIGURED');
  }
}

export function issueAccessToken(user) {
  assertConfigured();
  return jwt.sign(
    { ver: user.auth_versao, jti: randomUUID() },
    env.jwt.secret,
    {
      algorithm: 'HS256',
      subject: String(user.id),
      issuer: env.jwt.issuer,
      audience: env.jwt.audience,
      expiresIn: env.jwt.expiresIn
    }
  );
}

