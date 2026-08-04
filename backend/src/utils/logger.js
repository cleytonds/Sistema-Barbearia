import { env } from '../config/env.js';

const allowedContextFields = new Set([
  'requestId',
  'usuarioId',
  'agendamentoId',
  'barbeiroId',
  'operation',
  'errorCode',
  'attempt',
  'durationMs',
]);

export function sanitizeLogContext(context = {}) {
  return Object.fromEntries(
    Object.entries(context).filter(
      ([key, value]) => allowedContextFields.has(key) && value !== undefined && value !== null,
    ),
  );
}

/** Cria um logger pequeno, estruturado e testável sem aceitar bodies ou segredos arbitrários. */
export function createLogger({ sink = console, production = env.nodeEnv === 'production' } = {}) {
  const write = (level, message, context) => {
    const entry = { level, message, ...sanitizeLogContext(context) };
    const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    sink[method](production ? JSON.stringify(entry) : entry);
  };
  return {
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, context) => write('error', message, context),
  };
}

export const logger = createLogger();
