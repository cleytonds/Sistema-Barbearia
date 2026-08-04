import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { app } from '../src/app.js';
import {
  isTransientTransactionError,
  runTransactionWithRetry,
} from '../src/database/transactionRetry.js';
import { isValidRequestId, requestContext } from '../src/middlewares/requestContext.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';
import { createLogger, sanitizeLogContext } from '../src/utils/logger.js';

function fakeConnection(index, events) {
  return {
    query: async () => events.push(`isolation:${index}`),
    beginTransaction: async () => events.push(`begin:${index}`),
    commit: async () => events.push(`commit:${index}`),
    rollback: async () => events.push(`rollback:${index}`),
    release: () => events.push(`release:${index}`),
  };
}

function fakePool(events) {
  let created = 0;
  return {
    get count() {
      return created;
    },
    getConnection: async () => {
      created += 1;
      events.push(`connection:${created}`);
      return fakeConnection(created, events);
    },
  };
}

function captureLogger() {
  const entries = [];
  const sink = {
    log: (entry) => entries.push(entry),
    warn: (entry) => entries.push(entry),
    error: (entry) => entries.push(entry),
  };
  return { entries, logger: createLogger({ sink, production: false }) };
}

test('reconhece somente deadlock e lock timeout como transitórios', () => {
  assert.equal(isTransientTransactionError({ code: 'ER_LOCK_DEADLOCK' }), true);
  assert.equal(isTransientTransactionError({ code: 'ER_LOCK_WAIT_TIMEOUT' }), true);
  for (const code of [
    'ER_DUP_ENTRY',
    'AVAILABILITY_CHANGED',
    'VALIDATION_ERROR',
    'IDEMPOTENCY_KEY_CONFLICT',
    'ER_CHECK_CONSTRAINT_VIOLATED',
  ]) {
    assert.equal(isTransientTransactionError({ code }), false, code);
  }
});

test('primeira falha usa nova conexão e confirma somente a segunda tentativa', async () => {
  const events = [];
  const waits = [];
  const databasePool = fakePool(events);
  const captured = captureLogger();
  const hashes = { key: Buffer.alloc(32, 1), payload: Buffer.alloc(32, 2) };
  const observed = [];
  const result = await runTransactionWithRetry({
    databasePool,
    log: captured.logger,
    wait: async (delay) => waits.push(delay),
    operation: async ({ attempt }) => {
      observed.push([hashes.key, hashes.payload]);
      if (attempt === 1) throw Object.assign(new Error('deadlock'), { code: 'ER_LOCK_DEADLOCK' });
      return 'ok';
    },
  });
  assert.equal(result, 'ok');
  assert.equal(databasePool.count, 2);
  assert.deepEqual(waits, [25]);
  assert.deepEqual(
    events.filter((value) => value.startsWith('rollback')),
    ['rollback:1'],
  );
  assert.deepEqual(
    events.filter((value) => value.startsWith('commit')),
    ['commit:2'],
  );
  assert.deepEqual(
    events.filter((value) => value.startsWith('release')),
    ['release:1', 'release:2'],
  );
  assert.equal(observed[0][0], observed[1][0]);
  assert.equal(observed[0][1], observed[1][1]);
});

test('esgota três tentativas, libera conexões e preserva o erro final', async () => {
  const events = [];
  const databasePool = fakePool(events);
  const captured = captureLogger();
  const finalError = Object.assign(new Error('timeout'), { code: 'ER_LOCK_WAIT_TIMEOUT' });
  await assert.rejects(
    () =>
      runTransactionWithRetry({
        databasePool,
        wait: async () => {},
        log: captured.logger,
        operation: async () => {
          throw finalError;
        },
      }),
    (error) => error === finalError,
  );
  assert.equal(databasePool.count, 3);
  assert.equal(events.filter((value) => value.startsWith('rollback')).length, 3);
  assert.equal(events.filter((value) => value.startsWith('release')).length, 3);
  assert.equal(
    events.some((value) => value.startsWith('commit')),
    false,
  );
  assert.deepEqual(
    captured.entries.map((entry) => entry.message),
    ['transaction_retry_started', 'transaction_retry_started', 'transaction_retry_exhausted'],
  );
  assert.equal(captured.entries[0].errorCode, 'ER_LOCK_WAIT_TIMEOUT');
});

test('erros de negócio, conflito e duplicidade não entram no retry', async () => {
  for (const code of ['AVAILABILITY_CHANGED', 'IDEMPOTENCY_KEY_CONFLICT', 'ER_DUP_ENTRY']) {
    const events = [];
    const databasePool = fakePool(events);
    await assert.rejects(
      () =>
        runTransactionWithRetry({
          databasePool,
          wait: async () => {},
          operation: async () => {
            throw Object.assign(new Error(code), { code });
          },
        }),
      { code },
    );
    assert.equal(databasePool.count, 1, code);
    assert.equal(events.filter((value) => value.startsWith('rollback')).length, 1, code);
    assert.equal(events.filter((value) => value.startsWith('release')).length, 1, code);
  }
});

test('rollback impede agendamento e histórico duplicados após retry', async () => {
  const persisted = { appointments: 0, histories: 0 };
  let sequence = 0;
  const databasePool = {
    getConnection: async () => {
      sequence += 1;
      const pending = { appointments: 0, histories: 0 };
      return {
        query: async () => {},
        beginTransaction: async () => {},
        commit: async () => {
          persisted.appointments += pending.appointments;
          persisted.histories += pending.histories;
        },
        rollback: async () => {
          pending.appointments = 0;
          pending.histories = 0;
        },
        release: () => {},
        pending,
        sequence,
      };
    },
  };
  await runTransactionWithRetry({
    databasePool,
    wait: async () => {},
    log: captureLogger().logger,
    operation: async ({ connection, attempt }) => {
      connection.pending.appointments += 1;
      connection.pending.histories += 1;
      if (attempt === 1) throw Object.assign(new Error('deadlock'), { code: 'ER_LOCK_DEADLOCK' });
    },
  });
  assert.deepEqual(persisted, { appointments: 1, histories: 1 });
  assert.equal(sequence, 2);
});

test('requestId é validado, preservado e substituído quando inválido', () => {
  assert.equal(isValidRequestId('req-123:abc'), true);
  assert.equal(isValidRequestId('x'.repeat(65)), false);
  assert.equal(isValidRequestId('inválido'), false);
  for (const received of ['req-123:abc', 'x'.repeat(65), 'inválido']) {
    const headers = {};
    const request = { get: () => received };
    requestContext(
      request,
      {
        set: (name, value) => {
          headers[name] = value;
        },
      },
      () => {
        assert.equal(headers['X-Request-Id'], request.requestId);
      },
    );
    if (received === 'req-123:abc') assert.equal(request.requestId, received);
    else assert.notEqual(request.requestId, received);
  }
});

test('API gera e devolve requestId ou preserva header válido', async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/health`;
  try {
    let response = await fetch(url);
    assert.match(response.headers.get('x-request-id'), /^[0-9a-f-]{36}$/i);
    response = await fetch(url, { headers: { 'X-Request-Id': 'support-case-123' } });
    assert.equal(response.headers.get('x-request-id'), 'support-case-123');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('logger mantém requestId e omite segredos e chave idempotente', () => {
  const captured = captureLogger();
  captured.logger.error('operation_failed', {
    requestId: 'req-1',
    usuarioId: '2',
    errorCode: 'INTERNAL_ERROR',
    password: 'secret',
    senha_hash: 'hash',
    authorization: 'Bearer token',
    idempotencyKey: 'plain-key',
    email: 'a@example.test',
  });
  assert.deepEqual(captured.entries[0], {
    level: 'error',
    message: 'operation_failed',
    requestId: 'req-1',
    usuarioId: '2',
    errorCode: 'INTERNAL_ERROR',
  });
  assert.deepEqual(sanitizeLogContext({ requestId: 'req-2', body: { password: 'x' } }), {
    requestId: 'req-2',
  });
  captured.logger.info('appointment_idempotent_replay', {
    requestId: 'req-3',
    agendamentoId: '9',
    idempotencyKey: 'plain-key',
  });
  assert.deepEqual(captured.entries[1], {
    level: 'info',
    message: 'appointment_idempotent_replay',
    requestId: 'req-3',
    agendamentoId: '9',
  });
});

test('erro inesperado é registrado com requestId e sem detalhes sensíveis', () => {
  const original = console.error;
  const entries = [];
  console.error = (entry) => entries.push(entry);
  try {
    const response = { status: () => response, json: () => response };
    errorHandler(
      new Error('password=db-secret'),
      {
        requestId: 'req-error',
        method: 'GET',
        path: '/test',
        auth: null,
      },
      response,
      () => {},
    );
  } finally {
    console.error = original;
  }
  assert.equal(entries.length, 1);
  assert.equal(entries[0].requestId, 'req-error');
  assert.equal(JSON.stringify(entries[0]).includes('db-secret'), false);
});

test('contrato mantém os 14 métodos e caminhos da Fase 6', async () => {
  const specifications = [
    ['../src/routes/agendamentoRoutes.js', '/api/agendamentos'],
    ['../src/routes/barbeiroAgendamentoRoutes.js', '/api/barbeiro/agendamentos'],
    ['../src/routes/adminAgendamentoRoutes.js', '/api/admin/agendamentos'],
  ];
  const routes = [];
  for (const [relativePath, prefix] of specifications) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
    for (const match of source.matchAll(/Routes\.(get|post|put)\(\s*'([^']+)'/g)) {
      routes.push(`${match[1].toUpperCase()} ${prefix}${match[2] === '/' ? '' : match[2]}`);
    }
  }
  assert.deepEqual(
    routes.sort(),
    [
      'GET /api/admin/agendamentos',
      'GET /api/admin/agendamentos/:id',
      'GET /api/agendamentos/:id',
      'GET /api/agendamentos/meus',
      'GET /api/barbeiro/agendamentos',
      'GET /api/barbeiro/agendamentos/:id',
      'POST /api/admin/agendamentos',
      'POST /api/agendamentos',
      'PUT /api/admin/agendamentos/:id/cancelar',
      'PUT /api/admin/agendamentos/:id/reagendar',
      'PUT /api/admin/agendamentos/:id/status',
      'PUT /api/agendamentos/:id/cancelar',
      'PUT /api/agendamentos/:id/reagendar',
      'PUT /api/barbeiro/agendamentos/:id/status',
    ].sort(),
  );
});
