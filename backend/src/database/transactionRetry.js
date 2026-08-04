import { pool } from '../config/database.js';
import {
  TRANSACTION_MAX_ATTEMPTS,
  TRANSACTION_RETRY_INITIAL_DELAY_MS,
  TRANSACTION_RETRY_MAX_DELAY_MS,
  TRANSIENT_MYSQL_ERROR_CODES,
} from '../config/transactionConfig.js';
import { beginTransactionContext, closeTransactionContext } from './transactionContext.js';
import { logger } from '../utils/logger.js';

const defaultWait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function isTransientTransactionError(error) {
  return TRANSIENT_MYSQL_ERROR_CODES.includes(error?.code);
}

/** Executa cada tentativa com conexão e contexto transacional inteiramente novos. */
export async function runTransactionWithRetry({
  operation,
  databasePool = pool,
  maxAttempts = TRANSACTION_MAX_ATTEMPTS,
  initialDelayMs = TRANSACTION_RETRY_INITIAL_DELAY_MS,
  wait = defaultWait,
  log = logger,
  logContext = {},
}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const connection = await databasePool.getConnection();
    let transactionContext;
    let retryDelay;
    try {
      transactionContext = await beginTransactionContext(connection);
      const result = await operation({ connection, transactionContext, attempt });
      await connection.commit();
      return result;
    } catch (error) {
      if (transactionContext) {
        try {
          await connection.rollback();
        } catch {
          log.error('transaction_rollback_failed', {
            ...logContext,
            errorCode: error.code ?? 'TRANSACTION_ERROR',
            attempt,
          });
        }
      }
      const transient = isTransientTransactionError(error);
      if (!transient || attempt >= maxAttempts) {
        if (transient)
          log.error('transaction_retry_exhausted', {
            ...logContext,
            errorCode: error.code,
            attempt,
          });
        throw error;
      }
      log.warn('transaction_retry_started', { ...logContext, errorCode: error.code, attempt });
      retryDelay = Math.min(initialDelayMs * 2 ** (attempt - 1), TRANSACTION_RETRY_MAX_DELAY_MS);
    } finally {
      if (transactionContext) closeTransactionContext(transactionContext);
      connection.release();
    }
    await wait(retryDelay);
  }
  throw new Error('Limite transacional inválido.');
}
