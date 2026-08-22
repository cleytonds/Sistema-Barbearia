import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { app } from '../src/app.js';
import { checkDatabaseReadiness } from '../src/config/database.js';
import { createRouter } from '../src/routes/index.js';

async function request(router, path) {
  const testApp = express();
  testApp.use('/api', router);
  const server = testApp.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    return await fetch(`http://127.0.0.1:${server.address().port}${path}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('GET /api/health returns 200 without depending on the database', async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('GET /api/ready returns 200 when readiness succeeds', async () => {
  const response = await request(createRouter({ checkDatabase: async () => {} }), '/api/ready');

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ready' });
});

test('readiness requires schema and configuracoes.id=1', async () => {
  let query;
  let released = false;
  await checkDatabaseReadiness({
    getConnection: async () => ({
      execute: async (sql) => {
        query = sql;
        return [[{ ready: 1 }]];
      },
      release: () => {
        released = true;
      },
    }),
  });

  assert.match(query, /FROM configuracoes WHERE id = 1/);
  assert.equal(released, true);
});

test('GET /api/ready returns 503 without exposing database details', async () => {
  const response = await request(
    createRouter({
      checkDatabase: async () => {
        throw new Error('mysql://internal:password@host:3306');
      },
    }),
    '/api/ready',
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'not_ready' });
});

test('GET /api/ready returns 503 without configuracoes.id=1', async () => {
  const response = await request(
    createRouter({
      checkDatabase: async () => {
        throw new Error('Essential configuration is unavailable.');
      },
    }),
    '/api/ready',
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'not_ready' });
});

test('GET /api/ready returns 503 when the schema is unavailable', async () => {
  const response = await request(
    createRouter({
      checkDatabase: async () => {
        throw new Error('Table does not exist');
      },
    }),
    '/api/ready',
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'not_ready' });
});

test('unknown routes keep central error handling', async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/unknown`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error.code, 'ROUTE_NOT_FOUND');
});
