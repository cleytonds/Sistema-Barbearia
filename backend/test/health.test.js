import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { app } from '../src/app.js';
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

test('GET /api/health responde sem depender do banco', async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { status: 'ok' });
});

test('GET /api/ready responde pronto quando o banco está acessível', async () => {
  const response = await request(createRouter({ checkDatabase: async () => {} }), '/api/ready');

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ready' });
});

test('GET /api/ready não expõe detalhes quando o banco está indisponível', async () => {
  const response = await request(
    createRouter({
      checkDatabase: async () => {
        throw new Error('mysql://interno:senha@host-interno:3306');
      },
    }),
    '/api/ready',
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'not_ready' });
});

test('rota inexistente utiliza o tratamento centralizado de erros', async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/inexistente`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error.code, 'ROUTE_NOT_FOUND');
  assert.match(body.error.message, /não encontrada/);
});
