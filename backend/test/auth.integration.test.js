import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-characters-123456789';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_ISSUER = 'barbearia-api';
process.env.JWT_AUDIENCE = 'barbearia-web';

const { app } = await import('../src/app.js');
const { pool } = await import('../src/config/database.js');
const { default: jwt } = await import('jsonwebtoken');
const { cleanupExpiredRevocations, hashJti } = await import('../src/auth/jwtRevocation.js');

const unique = randomUUID().replaceAll('-', '').slice(0, 12);
const email = `fase3-${unique}@example.com`;
const phone = `81${unique.replace(/\D/g, '').padEnd(9, '7').slice(0, 9)}`;
const initialPassword = 'SenhaTeste123';
const resetPassword = 'SenhaReset456';
const finalPassword = 'SenhaFinal789';

let server;
let baseUrl;
let userId;
let accessToken;

async function request(path, { method = 'GET', body, token } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body && { 'content-type': 'application/json' }),
      ...(token && { authorization: `Bearer ${token}` })
    },
    ...(body && { body: JSON.stringify(body) })
  });
}

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(async () => {
  if (userId) await pool.execute('DELETE FROM usuarios WHERE id = ?', [userId]);
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('cadastro valida entrada e cria sessão sem campos sensíveis', async () => {
  const invalid = await request('/auth/cadastro', {
    method: 'POST',
    body: { nome: 'A', email: 'invalido', telefone: '1', senha: 'fraca', confirmacaoSenha: 'outra', perfil: 'admin' }
  });
  assert.equal(invalid.status, 422);

  const response = await request('/auth/cadastro', {
    method: 'POST',
    body: { nome: 'Cliente Fase Três', email: `  ${email.toUpperCase()} `, telefone: phone, senha: initialPassword, confirmacaoSenha: initialPassword }
  });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.usuario.email, email);
  assert.equal(body.usuario.perfil, 'cliente');
  assert.equal(body.expiresIn, 900);
  assert.ok(body.accessToken);
  assert.equal(body.usuario.senha_hash, undefined);
  accessToken = body.accessToken;
  const [[user]] = await pool.execute('SELECT id FROM usuarios WHERE email = ?', [email]);
  userId = user.id;
});

test('cadastro duplicado é rejeitado', async () => {
  const response = await request('/auth/cadastro', {
    method: 'POST',
    body: { nome: 'Cliente Duplicado', email, telefone: phone, senha: initialPassword, confirmacaoSenha: initialPassword }
  });
  assert.equal(response.status, 409);
});

test('login inválido é genérico e login correto gera JWT mínimo', async () => {
  const invalid = await request('/auth/login', { method: 'POST', body: { email, senha: 'SenhaErrada123' } });
  const invalidBody = await invalid.json();
  assert.equal(invalid.status, 401);
  assert.equal(invalidBody.error.code, 'INVALID_CREDENTIALS');

  const response = await request('/auth/login', { method: 'POST', body: { email, senha: initialPassword } });
  const body = await response.json();
  assert.equal(response.status, 200);
  const payload = JSON.parse(Buffer.from(body.accessToken.split('.')[1], 'base64url').toString('utf8'));
  assert.deepEqual(Object.keys(payload).sort(), ['aud', 'exp', 'iat', 'iss', 'jti', 'sub', 'ver'].sort());
  assert.equal(payload.email, undefined);
  assert.equal(payload.perfil, undefined);
  accessToken = body.accessToken;
});

test('/auth/me exige token e consulta usuário ativo', async () => {
  assert.equal((await request('/auth/me')).status, 401);
  const response = await request('/auth/me', { token: accessToken });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.usuario.id, String(userId));

  await pool.execute('UPDATE usuarios SET ativo = FALSE WHERE id = ?', [userId]);
  assert.equal((await request('/auth/me', { token: accessToken })).status, 401);
  await pool.execute('UPDATE usuarios SET ativo = TRUE WHERE id = ?', [userId]);
});

test('JWT inválido e JWT expirado retornam 401', async () => {
  assert.equal((await request('/auth/me', { token: 'token.invalido.valor' })).status, 401);
  const expired = jwt.sign(
    { ver: 1, jti: randomUUID() },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', subject: String(userId), issuer: 'barbearia-api', audience: 'barbearia-web', expiresIn: -1 }
  );
  const response = await request('/auth/me', { token: expired });
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.error.code, 'EXPIRED_TOKEN');
});

test('recuperação nunca revela se a conta existe', async () => {
  const existing = await request('/auth/esqueci-senha', { method: 'POST', body: { email } });
  const missing = await request('/auth/esqueci-senha', { method: 'POST', body: { email: `missing-${unique}@example.com` } });
  assert.equal(existing.status, 200);
  assert.equal(missing.status, 200);
  assert.deepEqual(await existing.json(), await missing.json());
});

test('reset usa token único, expira sessões anteriores e não permite reutilização', async () => {
  const rawToken = createHash('sha256').update(`valid-${unique}`).digest('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  await pool.execute(
    `INSERT INTO tokens_recuperacao_senha (usuario_id, token_hash, expira_em)
     VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 30 MINUTE))`,
    [userId, tokenHash]
  );
  const response = await request('/auth/redefinir-senha', {
    method: 'POST',
    body: { token: rawToken, novaSenha: resetPassword, confirmacaoNovaSenha: resetPassword }
  });
  assert.equal(response.status, 200);
  assert.equal((await request('/auth/me', { token: accessToken })).status, 401);
  const reused = await request('/auth/redefinir-senha', {
    method: 'POST',
    body: { token: rawToken, novaSenha: finalPassword, confirmacaoNovaSenha: finalPassword }
  });
  assert.equal(reused.status, 400);
});

test('reset rejeita token de recuperação expirado', async () => {
  const rawToken = createHash('sha256').update(`expired-${unique}`).digest('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  await pool.execute(
    `INSERT INTO tokens_recuperacao_senha (usuario_id, token_hash, expira_em)
     VALUES (?, ?, DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 1 MINUTE))`,
    [userId, tokenHash]
  );
  const response = await request('/auth/redefinir-senha', {
    method: 'POST',
    body: { token: rawToken, novaSenha: finalPassword, confirmacaoNovaSenha: finalPassword }
  });
  assert.equal(response.status, 400);
});

test('alteração de senha confirma senha atual e devolve nova sessão', async () => {
  const loginResponse = await request('/auth/login', { method: 'POST', body: { email, senha: resetPassword } });
  const loginBody = await loginResponse.json();
  const oldToken = loginBody.accessToken;
  const wrong = await request('/auth/alterar-senha', {
    method: 'PUT', token: oldToken,
    body: { senhaAtual: 'Errada123', novaSenha: finalPassword, confirmacaoNovaSenha: finalPassword }
  });
  assert.equal(wrong.status, 400);
  const changed = await request('/auth/alterar-senha', {
    method: 'PUT', token: oldToken,
    body: { senhaAtual: resetPassword, novaSenha: finalPassword, confirmacaoNovaSenha: finalPassword }
  });
  const changedBody = await changed.json();
  assert.equal(changed.status, 200);
  assert.ok(changedBody.accessToken);
  assert.equal((await request('/auth/me', { token: oldToken })).status, 401);
  accessToken = changedBody.accessToken;
});

test('logout revoga o token atual e é protegido', async () => {
  assert.equal((await request('/auth/logout', { method: 'POST' })).status, 401);
  const response = await request('/auth/logout', { method: 'POST', token: accessToken });
  assert.equal(response.status, 204);
  assert.equal((await request('/auth/me', { token: accessToken })).status, 401);
  const [[row]] = await pool.execute('SELECT jti_hash FROM tokens_jwt_revogados WHERE usuario_id = ?', [userId]);
  assert.match(row.jti_hash, /^[a-f0-9]{64}$/);
});

test('limpeza periódica remove somente revogações expiradas', async () => {
  const expiredJti = randomUUID();
  await pool.execute(
    `INSERT INTO tokens_jwt_revogados (usuario_id, jti_hash, expira_em)
     VALUES (?, ?, DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 1 MINUTE))`,
    [userId, hashJti(expiredJti)]
  );
  const removed = await cleanupExpiredRevocations();
  assert.ok(removed >= 1);
  const [[row]] = await pool.execute('SELECT id FROM tokens_jwt_revogados WHERE jti_hash = ?', [hashJti(expiredJti)]);
  assert.equal(row, undefined);
});

test('rate limit bloqueia a sexta falha de login da mesma chave', async () => {
  const isolatedEmail = `ratelimit-${unique}@example.com`;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await request('/auth/login', { method: 'POST', body: { email: isolatedEmail, senha: 'SenhaErrada123' } });
    assert.equal(response.status, 401, `tentativa ${attempt}`);
  }
  const blocked = await request('/auth/login', { method: 'POST', body: { email: isolatedEmail, senha: 'SenhaErrada123' } });
  assert.equal(blocked.status, 429);
});
