import { createHash, randomBytes } from 'node:crypto';

export function generateRecoveryToken() {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashRecoveryToken(token) };
}

export function hashRecoveryToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

