import assert from 'node:assert/strict';
import test from 'node:test';

process.env.FRONTEND_URL = 'http://localhost:5173,http://192.168.1.23:5173';
const { app } = await import('../src/app.js');

let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

for (const origin of ['http://localhost:5173', 'http://192.168.1.23:5173']) {
  test(`permite CORS de desenvolvimento para ${origin}`, async () => {
    const response = await fetch(`${baseUrl}/api/health`, { headers: { Origin: origin } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  });
}

test('não libera origem fora da configuração', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'http://192.168.1.99:5173' },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

for (const path of ['/api/auth/login', '/api/auth/register']) {
  test(`permite preflight do celular para ${path}`, async () => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://192.168.1.23:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://192.168.1.23:5173');
    assert.match(response.headers.get('access-control-allow-methods'), /POST/);
  });
}
