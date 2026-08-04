import 'dotenv/config';

const toPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: toPositiveInteger(process.env.PORT, 3000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: toPositiveInteger(process.env.DB_PORT, 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'barbearia_agendamento',
    connectionLimit: toPositiveInteger(process.env.DB_CONNECTION_LIMIT, 10)
  }
});

