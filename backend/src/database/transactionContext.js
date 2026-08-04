const activeContexts = new WeakSet();

/**
 * Inicia uma transação e cria o contexto explícito aceito pelas validações críticas.
 * O WeakSet impede que um objeto improvisado seja tratado como transação ativa.
 */
export async function beginTransactionContext(connection) {
  await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
  await connection.beginTransaction();
  const context = Object.freeze({ connection, transactionActive: true });
  activeContexts.add(context);
  return context;
}

export function isActiveTransactionContext(context) {
  return Boolean(context?.transactionActive && context.connection && activeContexts.has(context));
}

/** Finaliza o contexto após o chamador responsável executar commit ou rollback. */
export function closeTransactionContext(context) {
  activeContexts.delete(context);
}
