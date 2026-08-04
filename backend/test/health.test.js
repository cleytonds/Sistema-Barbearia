import assert from 'node:assert/strict';
import test from 'node:test';
import { app } from '../src/app.js';

test('GET /api/health responde sem depender do banco', async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
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
