import 'dotenv/config';
import { isIP } from 'node:net';
import { assertSafeTestDatabase } from './testDatabaseSafety.js';

const toPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const knownPlaceholder = 'substitua_por_uma_chave_longa_e_aleatoria';
const trustedProxyAliases = new Set(['loopback', 'linklocal', 'uniquelocal']);

export function parseTrustProxy(value) {
  const configured = value?.trim();
  if (!configured) return false;
  if (/^[1-9]\d*$/.test(configured)) return Number(configured);

  const proxies = configured.split(',').map((proxy) => proxy.trim());
  const valid = proxies.every((proxy) => {
    if (trustedProxyAliases.has(proxy)) return true;
    const [address, prefix] = proxy.split('/');
    const family = isIP(address);
    return (
      family !== 0 &&
      (prefix === undefined ||
        (/^\d+$/.test(prefix) && Number(prefix) <= (family === 4 ? 32 : 128)))
    );
  });
  return valid ? proxies : false;
}

// In production, use same-site browser origins (for example app.example.com + api.example.com)
// or a reverse proxy at /api. TRUST_PROXY must name explicit proxy hops or CIDRs.
const frontendOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const nodeEnv = process.env.NODE_ENV ?? 'development';
const databaseName = process.env.DB_NAME ?? 'barbearia_agendamento';
const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);

assertSafeTestDatabase(nodeEnv, databaseName);

export function validateProductionEnvironment({
  environment = process.env,
  nodeEnv = environment.NODE_ENV ?? 'development',
} = {}) {
  if (nodeEnv !== 'production') return [];

  const required = [
    [
      'JWT_SECRET',
      environment.JWT_SECRET?.length >= 32 && environment.JWT_SECRET !== knownPlaceholder,
    ],
    ['FRONTEND_URL', Boolean(environment.FRONTEND_URL?.trim())],
    ['DB_HOST', Boolean(environment.DB_HOST?.trim())],
    ['DB_PORT', Number.isInteger(Number(environment.DB_PORT)) && Number(environment.DB_PORT) > 0],
    ['DB_USER', Boolean(environment.DB_USER?.trim())],
    ['DB_NAME', Boolean(environment.DB_NAME?.trim())],
    ['BREVO_API_KEY', Boolean(environment.BREVO_API_KEY?.trim())],
    ['EMAIL_FROM', Boolean(environment.EMAIL_FROM?.trim())],
    [
      'TRUST_PROXY',
      !environment.TRUST_PROXY?.trim() || Boolean(parseTrustProxy(environment.TRUST_PROXY)),
    ],
  ];
  return required.filter(([, configured]) => !configured).map(([name]) => name);
}

export const env = Object.freeze({
  nodeEnv,
  port: toPositiveInteger(process.env.PORT, 3000),
  frontendUrl: frontendOrigins[0],
  frontendOrigins,
  trustProxy,
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    issuer: process.env.JWT_ISSUER ?? 'barbearia-api',
    audience: process.env.JWT_AUDIENCE ?? 'barbearia-web',
    revocationCleanupMinutes: toPositiveInteger(process.env.JWT_REVOCATION_CLEANUP_MINUTES, 60),
    isConfigured: Boolean(
      process.env.JWT_SECRET &&
      process.env.JWT_SECRET !== knownPlaceholder &&
      process.env.JWT_SECRET.length >= 32,
    ),
  },
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: toPositiveInteger(process.env.DB_PORT, 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: databaseName,
    connectionLimit: toPositiveInteger(process.env.DB_CONNECTION_LIMIT, 10),
  },
});
