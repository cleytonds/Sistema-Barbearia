import { app } from './app.js';
import { checkDatabaseConnection, pool } from './config/database.js';
import { env } from './config/env.js';
import { cleanupExpiredRevocations } from './auth/jwtRevocation.js';

let server;

async function start() {
  try {
    await checkDatabaseConnection();
    console.log('[database] conexão estabelecida');
  } catch {
    console.warn('[database] indisponível; a API continuará sem acesso a dados');
  }

  server = app.listen(env.port, () => {
    console.log(`[api] http://localhost:${env.port}`);
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

start();
