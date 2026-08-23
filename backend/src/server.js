import { app } from './app.js';
import { checkDatabaseConnection, pool } from './config/database.js';
import { env, validateProductionEnvironment } from './config/env.js';
import { cleanupExpiredRevocations } from './auth/jwtRevocation.js';
import { fileURLToPath } from 'node:url';

let server;

function databaseFailureMessage(error) {
  const details = [];
  if (typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code))
    details.push(`code=${error.code}`);
  if (Number.isInteger(error?.errno)) details.push(`errno=${error.errno}`);
  if (typeof error?.sqlState === 'string' && /^[A-Z0-9]{5}$/.test(error.sqlState))
    details.push(`sqlState=${error.sqlState}`);
  const suffix = details.length > 0 ? `: ${details.join(', ')}` : '';
  return `[database] indisponível${suffix}; a API não será iniciada`;
}

export async function start({
  checkDatabase = checkDatabaseConnection,
  closeDatabase = () => pool.end(),
  listen = (...args) => app.listen(...args),
  logger = console,
  nodeEnv = env.nodeEnv,
  environment = process.env,
} = {}) {
  const invalidVariables = validateProductionEnvironment({ environment, nodeEnv });
  if (invalidVariables.length > 0) {
    logger.error(`[config] produção incompleta: ${invalidVariables.join(', ')}`);
    process.exitCode = 1;
    return null;
  }

  if (validateProductionEnvironment({ environment, nodeEnv }).length > 0) {
    logger.error('[config] produÃ§Ã£o incompleta; a API nÃ£o serÃ¡ iniciada');
    process.exitCode = 1;
    return null;
  }

  try {
    await checkDatabase();
    logger.log('[database] conexão estabelecida');
  } catch (error) {
    if (nodeEnv === 'production') {
      logger.error(databaseFailureMessage(error));
      try {
        await closeDatabase();
      } catch {
        // A falha de encerramento não pode impedir o encerramento fail-closed.
      }
      process.exitCode = 1;
      return null;
    }

    if (nodeEnv === 'production') {
      logger.error('[database] indisponível; a API não será iniciada');
      try {
        await closeDatabase();
      } catch {
        // A falha de encerramento não pode impedir o encerramento fail-closed.
      }
      process.exitCode = 1;
      return null;
    }
    logger.warn('[database] indisponível; a API continuará sem acesso a dados');
  }

  server = listen(env.port, () => {
    logger.log(`[api] http://localhost:${env.port}`);
  });

  const cleanupInterval = setInterval(async () => {
    try {
      const removed = await cleanupExpiredRevocations();
      if (removed > 0) console.log(`[auth] ${removed} revogação(ões) expirada(s) removida(s)`);
    } catch {
      console.error('[auth] falha na limpeza de revogações expiradas');
    }
  }, env.jwt.revocationCleanupMinutes * 60_000);
  cleanupInterval.unref();
}

async function shutdown(signal) {
  console.log(`[api] encerrando (${signal})`);
  server?.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) start();
