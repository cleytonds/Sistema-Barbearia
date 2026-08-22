import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'phase9-test-secret-with-at-least-32-characters-123';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_ISSUER = 'barbearia-api';
process.env.JWT_AUDIENCE = 'barbearia-web';

const { app } = await import('../src/app.js');
const { hashPassword } = await import('../src/auth/password.js');
const { pool } = await import('../src/config/database.js');
const { issueAccessToken } = await import('../src/auth/jwtIssuer.js');
const { grantRole, listUserRoles } = await import('../src/repositories/roleRepository.js');

let server, base;
const marker = `P9-${randomUUID().slice(0, 8)}`;
let barberOnlyId, barberAdminId;

async function addBarber({ admin = false, suffix }) {
  const [result] = await pool.execute(
    'INSERT INTO usuarios(nome,email,telefone,senha_hash,perfil) VALUES(?,?,?,?,?)',
    [
      `${marker} ${suffix}`,
      `${marker}-${suffix}@example.test`,
      `81${String(Date.now() + Math.floor(Math.random() * 9999)).slice(-9)}`,
      await hashPassword('SenhaTeste123'),
      'barbeiro',
    ],
  );
  await grantRole(result.insertId, 'barbeiro');
  if (admin) await grantRole(result.insertId, 'admin');
  await pool.execute('INSERT INTO barbeiros(usuario_id) VALUES(?)', [result.insertId]);
  return result.insertId;
}

async function tokenFor(id) {
  const [[user]] = await pool.execute('SELECT id,auth_versao FROM usuarios WHERE id=?', [id]);
  return issueAccessToken(user);
}

async function request(path, token) {
  return fetch(`${base}${path}`, { headers: { cookie: `barbearia_session=${token}` } });
}

test.before(async () => {
  barberOnlyId = await addBarber({ suffix: 'barbeiro' });
  barberAdminId = await addBarber({ admin: true, suffix: 'barbeiro-admin' });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(async () => {
  try {
    await pool.execute('DELETE FROM barbeiros WHERE usuario_id IN (?,?)', [
      barberOnlyId,
      barberAdminId,
    ]);
    await pool.execute('DELETE FROM usuario_papeis WHERE usuario_id IN (?,?)', [
      barberOnlyId,
      barberAdminId,
    ]);
    await pool.execute('DELETE FROM usuarios WHERE id IN (?,?)', [barberOnlyId, barberAdminId]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});

test('papéis de fixtures preservam acesso duplo com isolamento profissional', async () => {
  assert.deepEqual(await listUserRoles(barberOnlyId), ['barbeiro']);
  assert.deepEqual(await listUserRoles(barberAdminId), ['barbeiro', 'admin']);
  const barberOnly = await tokenFor(barberOnlyId);
  const barberAdmin = await tokenFor(barberAdminId);
  assert.equal((await request('/barbeiro/dashboard?data=2026-08-05', barberOnly)).status, 200);
  assert.equal((await request('/admin/dashboard?data=2026-08-05', barberOnly)).status, 403);
  assert.equal((await request('/barbeiro/dashboard?data=2026-08-05', barberAdmin)).status, 200);
  assert.equal((await request('/admin/dashboard?data=2026-08-05', barberAdmin)).status, 200);
});
