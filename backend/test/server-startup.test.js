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
  EMAIL_HOST: 'smtp.example.test',
  EMAIL_PORT: '587',
  EMAIL_USER: 'mailer',
  EMAIL_PASSWORD: 'test-password',
  EMAIL_FROM: 'App <mailer@example.test>',
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

test('production does not start without SMTP configuration', async () => {
  const environment = { ...productionEnvironment };
  delete environment.EMAIL_PASSWORD;
  await assertProductionConfigurationFailure(environment);
});

test('production reports invalid variable names without exposing their values', async () => {
  const originalExitCode = process.exitCode;
  const errors = [];
  let listenCalls = 0;
  try {
    const result = await start({
      checkDatabase: async () => assert.fail('database must not be checked'),
      listen: () => {
        listenCalls += 1;
      },
      logger: { error: (message) => errors.push(message), log: () => {}, warn: () => {} },
      nodeEnv: 'production',
      environment: {
        ...productionEnvironment,
        JWT_SECRET: 'short-secret-value',
        DB_PORT: 'invalid-port-value',
      },
    });
    assert.equal(result, null);
    assert.equal(listenCalls, 0);
    assert.equal(errors[0], '[config] produção incompleta: JWT_SECRET, DB_PORT');
    assert.doesNotMatch(errors[0], /short-secret-value|invalid-port-value/);
  } finally {
    process.exitCode = originalExitCode;
  }
});

test('production does not start when the database is unavailable', async () => {
  const originalExitCode = process.exitCode;
  let listenCalls = 0;
  let closeCalls = 0;
  const errors = [];
  try {
    const result = await start({
      checkDatabase: unavailableDatabase,
      diagnoseDatabase: async () => ({
        databaseName: 'barbearia',
        databaseListed: false,
        useError: null,
      }),
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

test('production reports safe database error fields without starting the API', async () => {
  const originalExitCode = process.exitCode;
  const errors = [];
  let listenCalls = 0;
  const databaseError = Object.assign(new Error('mysql://user:secret-password@host/database'), {
    code: 'ECONNREFUSED',
    errno: 111,
    sqlState: 'HY000',
    password: 'secret-password',
  });
  try {
    const result = await start({
      checkDatabase: async () => Promise.reject(databaseError),
      diagnoseDatabase: async () => ({
        databaseName: 'barbearia',
        databaseListed: false,
        useError: null,
      }),
      closeDatabase: async () => {},
      listen: () => {
        listenCalls += 1;
      },
      logger: { error: (message) => errors.push(message), log: () => {}, warn: () => {} },
      nodeEnv: 'production',
      environment: productionEnvironment,
    });
    assert.equal(result, null);
    assert.equal(listenCalls, 0);
    assert.equal(
      errors[0],
      '[database] indisponível: code=ECONNREFUSED, errno=111, sqlState=HY000; a API não será iniciada',
    );
    assert.doesNotMatch(errors[0], /secret-password|mysql:\/\/user/);
  } finally {
    process.exitCode = originalExitCode;
  }
});

test('production database diagnostic logs only database availability and safe error code', async () => {
  const originalExitCode = process.exitCode;
  const logs = [];
  const errors = [];
  let listenCalls = 0;
  try {
    const result = await start({
      checkDatabase: async () => Promise.reject(Object.assign(new Error('connection failed'), { code: 'ER_BAD_DB_ERROR' })),
      diagnoseDatabase: async () => ({
        databaseName: 'railway',
        databaseListed: true,
        useError: Object.assign(new Error('mysql://user:secret-password@host/railway'), {
          code: 'ER_BAD_DB_ERROR',
          password: 'secret-password',
        }),
      }),
      closeDatabase: async () => {},
      listen: () => {
        listenCalls += 1;
      },
      logger: {
        error: (message) => errors.push(message),
        log: (message) => logs.push(message),
        warn: () => {},
      },
      nodeEnv: 'production',
      environment: productionEnvironment,
    });
    assert.equal(result, null);
    assert.equal(listenCalls, 0);
    assert.ok(logs.includes('[database] diagnostic: database=railway, listed=yes'));
    assert.ok(errors.includes('[database] diagnostic use failed: code=ER_BAD_DB_ERROR'));
    assert.doesNotMatch([...logs, ...errors].join(' '), /secret-password|mysql:\/\/user|db\.example\.test|\bapp\b/);
  } finally {
    process.exitCode = originalExitCode;
  }
});

test('production starts when SMTP configuration is complete', async () => {
  const originalExitCode = process.exitCode;
  let listenCalls = 0;
  const logs = [];
  try {
    const result = await start({
      checkDatabase: async () => {},
      listen: (_port, onListening) => {
        listenCalls += 1;
        onListening();
        return {};
      },
      logger: { error: () => {}, log: (message) => logs.push(message), warn: () => {} },
      nodeEnv: 'production',
      environment: productionEnvironment,
    });
    assert.equal(result, undefined);
    assert.equal(listenCalls, 1);
    assert.equal(process.exitCode, originalExitCode);
    assert.equal(logs[0], '[database] database=barbearia');
    assert.doesNotMatch(logs.join(' '), /db\.example\.test|test-password|\bapp\b/);
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
