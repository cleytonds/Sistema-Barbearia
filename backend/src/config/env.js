import 'dotenv/config';

const toPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const knownPlaceholder = 'substitua_por_uma_chave_longa_e_aleatoria';

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: toPositiveInteger(process.env.PORT, 3000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    issuer: process.env.JWT_ISSUER ?? 'barbearia-api',
    audience: process.env.JWT_AUDIENCE ?? 'barbearia-web',
    revocationCleanupMinutes: toPositiveInteger(process.env.JWT_REVOCATION_CLEANUP_MINUTES, 60),
    isConfigured: Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET !== knownPlaceholder && process.env.JWT_SECRET.length >= 32)
  },
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: toPositiveInteger(process.env.DB_PORT, 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'barbearia_agendamento',
    connectionLimit: toPositiveInteger(process.env.DB_CONNECTION_LIMIT, 10)
  }
});
