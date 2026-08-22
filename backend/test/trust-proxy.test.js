import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { configureTrustProxy } from '../src/app.js';
import { parseTrustProxy } from '../src/config/env.js';

async function requestIp(trustProxy, headers = {}) {
  const testApp = express();
  configureTrustProxy(testApp, trustProxy);
  testApp.get('/', (request, response) => response.json({ ip: request.ip }));
  const server = testApp.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}`, { headers });
    return response.json();
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('development defaults to not trusting a proxy', async () => {
  assert.equal(parseTrustProxy(undefined), false);
  const body = await requestIp(false, { 'x-forwarded-for': '203.0.113.10' });

  assert.notEqual(body.ip, '203.0.113.10');
});

test('configured production proxy uses the forwarded client IP', async () => {
  assert.deepEqual(parseTrustProxy('loopback'), ['loopback']);
  const body = await requestIp(['loopback'], { 'x-forwarded-for': '203.0.113.10' });

  assert.equal(body.ip, '203.0.113.10');
});

test('rejects trust proxy values that would trust arbitrary proxies', () => {
  assert.equal(parseTrustProxy('true'), false);
});
