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
