import assert from 'node:assert/strict';
import test from 'node:test';
import { start } from '../src/server.js';

const productionEnvironment = {
  NODE_ENV: 'production',
  JWT_SECRET: 'test-secret-with-at-least-thirty-two-characters',
  FRONTEND_URL: 'https://app.example.test',
  DB_HOST: 'db.example.test',
  DB_PORT: '3306',
  DB_USER: 'app',
  DB_NAME: 'barbearia',
};

function unavailableDatabase() {
  return Promise.reject(new Error('database unavailable'));
}

async function assertProductionConfigurationFailure(environment) {
  const originalExitCode = process.exitCode;
  let listenCalls = 0;
  const errors = [];
  try {
    const result = await start({
      checkDatabase: async () => assert.fail('database must not be checked'),
      listen: () => {
        listenCalls += 1;
      },
      logger: { error: (message) => errors.push(message), log: () => {}, warn: () => {} },
      nodeEnv: 'production',
      environment,
    });
    assert.equal(result, null);
    assert.equal(listenCalls, 0);
    assert.equal(process.exitCode, 1);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /^\[config\]/);
  } finally {
    process.exitCode = originalExitCode;
  }
}

test('production does not start without JWT_SECRET', async () => {
  const environment = { ...productionEnvironment };
  delete environment.JWT_SECRET;
  await assertProductionConfigurationFailure(environment);
});

test('production does not start without FRONTEND_URL', async () => {
  const environment = { ...productionEnvironment };
  delete environment.FRONTEND_URL;
  await assertProductionConfigurationFailure(environment);
});

test('production does not start when the database is unavailable', async () => {
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
      environment: productionEnvironment,
    });
    assert.equal(result, null);
    assert.equal(listenCalls, 0);
    assert.equal(closeCalls, 1);
    assert.equal(process.exitCode, 1);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /^\[database\]/);
  } finally {
    process.exitCode = originalExitCode;
  }
});

test('development preserves startup when the database is unavailable', async () => {
  const originalExitCode = process.exitCode;
  let listenCalls = 0;
  const warnings = [];
  try {
    const fakeServer = {};
    const result = await start({
      checkDatabase: unavailableDatabase,
      closeDatabase: async () => assert.fail('database pool must remain open in development'),
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
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /^\[database\]/);
  } finally {
    process.exitCode = originalExitCode;
  }
});
