import assert from 'node:assert/strict';
import test from 'node:test';
import { start } from '../src/server.js';

function unavailableDatabase() {
  return Promise.reject(new Error('database unavailable'));
}

test('produção não inicia a API quando o banco está indisponível', async () => {
  const originalExitCode = process.exitCode;
  let listenCalls = 0;
  let closeCalls = 0;
  const errors = [];
  try {
    const result = await start({
      checkDatabase: unavailableDatabase,
      closeDatabase: async () => {
        closeCalls += 1;
      },
      listen: () => {
        listenCalls += 1;
      },
      logger: { error: (message) => errors.push(message), log: () => {}, warn: () => {} },
      nodeEnv: 'production',
    });
    assert.equal(result, null);
    assert.equal(listenCalls, 0);
    assert.equal(closeCalls, 1);
    assert.equal(process.exitCode, 1);
    assert.deepEqual(errors, ['[database] indisponível; a API não será iniciada']);
  } finally {
    process.exitCode = originalExitCode;
  }
});

test('desenvolvimento preserva a inicialização quando o banco está indisponível', async () => {
  const originalExitCode = process.exitCode;
  let listenCalls = 0;
  const warnings = [];
  try {
    const fakeServer = {};
    const result = await start({
      checkDatabase: unavailableDatabase,
      closeDatabase: async () => assert.fail('não deve encerrar o pool em desenvolvimento'),
      listen: (_port, onListening) => {
        listenCalls += 1;
        onListening();
        return fakeServer;
      },
      logger: { error: () => {}, log: () => {}, warn: (message) => warnings.push(message) },
      nodeEnv: 'development',
    });
    assert.equal(result, undefined);
    assert.equal(listenCalls, 1);
    assert.equal(process.exitCode, originalExitCode);
    assert.deepEqual(warnings, ['[database] indisponível; a API continuará sem acesso a dados']);
  } finally {
    process.exitCode = originalExitCode;
  }
});
