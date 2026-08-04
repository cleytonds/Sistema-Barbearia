import { createHash } from 'node:crypto';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

const base = { standardHeaders: 'draft-8', legacyHeaders: false };
const hash = (value = '') =>
  createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
const accountKey = (req) => `${ipKeyGenerator(req.ip)}:${hash(req.body?.email)}`;
const userKey = (req) => `${ipKeyGenerator(req.ip)}:${req.auth?.usuario?.id ?? 'anonymous'}`;

export const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 5,
  keyGenerator: accountKey,
  skipSuccessfulRequests: true,
});
export const registerLimiter = rateLimit({ ...base, windowMs: 60 * 60_000, limit: 5 });
export const recoveryLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 3,
  keyGenerator: accountKey,
});
export const resetLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 5 });
export const passwordLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60_000,
  limit: 5,
  keyGenerator: userKey,
});
export const authenticatedLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 300,
  keyGenerator: userKey,
});

// O armazenamento padrão em memória atende uma instância. Uma implantação
// horizontal deverá compartilhar os contadores por meio de Redis ou equivalente.
export const availabilityLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 60,
});

export const appointmentCreationLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 10,
  keyGenerator: userKey,
});
export const appointmentMutationLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 20,
  keyGenerator: userKey,
});
export const appointmentStatusLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 60,
  keyGenerator: userKey,
});
export const appointmentReadLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 120,
  keyGenerator: userKey,
});
