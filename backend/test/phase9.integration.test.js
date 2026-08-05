import assert from 'node:assert/strict';
import test from 'node:test';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'phase9-test-secret-with-at-least-32-characters-123';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_ISSUER = 'barbearia-api';
process.env.JWT_AUDIENCE = 'barbearia-web';
const { app } = await import('../src/app.js');
const { pool } = await import('../src/config/database.js');
const { issueAccessToken } = await import('../src/auth/jwtIssuer.js');
const { listUserRoles } = await import('../src/repositories/roleRepository.js');
let server, base;
async function tokenFor(id) {
  const [[user]] = await pool.execute('SELECT id,auth_versao FROM usuarios WHERE id=?', [id]);
  return issueAccessToken(user);
}
async function request(path, token) {
  return fetch(`${base}${path}`, { headers: { authorization: `Bearer ${token}` } });
}
test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});
test('papéis reais preservam Cadu e dão acesso duplo a Jonatas com isolamento profissional', async () => {
  assert.deepEqual(await listUserRoles(439), ['barbeiro']);
  assert.deepEqual(await listUserRoles(440), ['barbeiro', 'admin']);
  const cadu = await tokenFor(439),
    jonatas = await tokenFor(440);
  assert.equal((await request('/barbeiro/dashboard?data=2026-08-05', cadu)).status, 200);
  assert.equal((await request('/admin/dashboard?data=2026-08-05', cadu)).status, 403);
  assert.equal((await request('/barbeiro/dashboard?data=2026-08-05', jonatas)).status, 200);
  assert.equal((await request('/admin/dashboard?data=2026-08-05', jonatas)).status, 200);
  const [[preserved]] = await pool.execute(
    `SELECT
      (SELECT COUNT(*) FROM barbeiro_servicos WHERE barbeiro_id=158) cadu_servicos,
      (SELECT COUNT(*) FROM horarios_trabalho WHERE barbeiro_id=158) cadu_jornadas,
      (SELECT COUNT(*) FROM barbeiro_servicos WHERE barbeiro_id=159) jonatas_servicos,
      (SELECT COUNT(*) FROM horarios_trabalho WHERE barbeiro_id=159) jonatas_jornadas`,
  );
  assert.deepEqual(preserved, {
    cadu_servicos: 5,
    cadu_jornadas: 7,
    jonatas_servicos: 5,
    jonatas_jornadas: 7,
  });
});
