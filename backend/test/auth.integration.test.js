import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-characters-123456789';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_ISSUER = 'barbearia-api';
process.env.JWT_AUDIENCE = 'barbearia-web';
process.env.FRONTEND_URL = 'http://localhost:5173';

const { app } = await import('../src/app.js');
const { pool } = await import('../src/config/database.js');
const { default: jwt } = await import('jsonwebtoken');
const { cleanupExpiredRevocations, hashJti } = await import('../src/auth/jwtRevocation.js');
const authService = await import('../src/services/authService.js');
const { hashRecoveryToken } = await import('../src/auth/recoveryToken.js');

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
let cookie;

async function request(path, { method = 'GET', body, token, cookieHeader, csrf = false } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body && { 'content-type': 'application/json' }),
      ...(token && { authorization: `Bearer ${token}` }),
      ...(cookieHeader && { cookie: cookieHeader }),
      ...(csrf && { origin: 'http://localhost:5173', 'x-csrf-protection': '1' }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
}

function sessionCookie(response) {
  return response.headers.get('set-cookie').split(';', 1)[0];
}

function tokenFromCookie(value) {
  return value.slice('barbearia_session='.length);
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
    body: {
      nome: 'A',
      email: 'invalido',
      telefone: '1',
      senha: 'fraca',
      confirmacaoSenha: 'outra',
      perfil: 'admin',
    },
  });
  assert.equal(invalid.status, 422);

  const response = await request('/auth/cadastro', {
    method: 'POST',
    body: {
      nome: 'Cliente Fase Três',
      email: `  ${email.toUpperCase()} `,
      telefone: phone,
      senha: initialPassword,
      confirmacaoSenha: initialPassword,
    },
  });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.usuario.email, email);
  assert.equal(body.usuario.perfil, 'cliente');
  assert.equal(body.expiresIn, 900);
  assert.equal('accessToken' in body, false);
  assert.equal(body.usuario.senha_hash, undefined);
  cookie = sessionCookie(response);
  accessToken = tokenFromCookie(cookie);
  const [[user]] = await pool.execute('SELECT id FROM usuarios WHERE email = ?', [email]);
  userId = user.id;
});

test('cadastro duplicado é rejeitado', async () => {
  const response = await request('/auth/cadastro', {
    method: 'POST',
    body: {
      nome: 'Cliente Duplicado',
      email,
      telefone: phone,
      senha: initialPassword,
      confirmacaoSenha: initialPassword,
    },
  });
  assert.equal(response.status, 409);
});

test('login inválido é genérico e login correto gera cookie com JWT mínimo', async () => {
  const invalid = await request('/auth/login', {
    method: 'POST',
    body: { email, senha: 'SenhaErrada123' },
  });
  const invalidBody = await invalid.json();
  assert.equal(invalid.status, 401);
  assert.equal(invalidBody.error.code, 'INVALID_CREDENTIALS');

  const response = await request('/auth/login', {
    method: 'POST',
    body: { email, senha: initialPassword },
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal('accessToken' in body, false);
  cookie = sessionCookie(response);
  accessToken = tokenFromCookie(cookie);
  const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'));
  assert.deepEqual(
    Object.keys(payload).sort(),
    ['aud', 'exp', 'iat', 'iss', 'jti', 'sub', 'ver'].sort(),
  );
  assert.equal(payload.email, undefined);
  assert.equal(payload.perfil, undefined);
});

test('/auth/me exige cookie e consulta usuário ativo', async () => {
  assert.equal((await request('/auth/me')).status, 401);
  assert.equal((await request('/auth/me', { token: accessToken })).status, 401);
  const response = await request('/auth/me', { cookieHeader: cookie });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.usuario.id, String(userId));

  await pool.execute('UPDATE usuarios SET ativo = FALSE WHERE id = ?', [userId]);
  assert.equal((await request('/auth/me', { cookieHeader: cookie })).status, 401);
  await pool.execute('UPDATE usuarios SET ativo = TRUE WHERE id = ?', [userId]);
});

test('JWT inválido e JWT expirado retornam 401', async () => {
  assert.equal(
    (await request('/auth/me', { cookieHeader: 'barbearia_session=token.invalido.valor' })).status,
    401,
  );
  const expired = jwt.sign({ ver: 1, jti: randomUUID() }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: String(userId),
    issuer: 'barbearia-api',
    audience: 'barbearia-web',
    expiresIn: -1,
  });
  const response = await request('/auth/me', { cookieHeader: `barbearia_session=${expired}` });
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.error.code, 'EXPIRED_TOKEN');
});

test('recuperação nunca revela se a conta existe', async () => {
  const existing = await request('/auth/esqueci-senha', { method: 'POST', body: { email } });
  const missing = await request('/auth/esqueci-senha', {
    method: 'POST',
    body: { email: `missing-${unique}@example.com` },
  });
  assert.equal(existing.status, 200);
  assert.equal(missing.status, 200);
  assert.deepEqual(await existing.json(), await missing.json());
});

test('reset usa token único, expira sessões anteriores e não permite reutilização', async () => {
  let rawToken;
  await authService.requestPasswordRecovery(email, {
    sendEmail: async ({ token }) => {
      rawToken = token;
    },
  });
  assert.equal(rawToken.length, 64);
  assert.match(rawToken, /^[a-f0-9]{64}$/);
  const link = new URL(
    `http://localhost:5173/redefinir-senha?token=${encodeURIComponent(rawToken)}`,
  );
  assert.equal(link.searchParams.get('token'), rawToken);
  const [[storedBefore]] = await pool.execute(
    `SELECT token_hash, utilizado_em, expira_em > UTC_TIMESTAMP(6) AS valido
     FROM tokens_recuperacao_senha WHERE usuario_id=? ORDER BY id DESC LIMIT 1`,
    [userId],
  );
  assert.equal(storedBefore.token_hash, hashRecoveryToken(rawToken));
  assert.equal(storedBefore.utilizado_em, null);
  assert.equal(Boolean(storedBefore.valido), true);

  const invalidToken = createHash('sha256').update(`invalid-${unique}`).digest('hex');
  const invalid = await request('/auth/redefinir-senha', {
    method: 'POST',
    body: { token: invalidToken, novaSenha: resetPassword, confirmacaoNovaSenha: resetPassword },
  });
  assert.equal(invalid.status, 400);

  const unchangedPassword = await request('/auth/redefinir-senha', {
    method: 'POST',
    body: {
      token: rawToken,
      novaSenha: initialPassword,
      confirmacaoNovaSenha: initialPassword,
    },
  });
  assert.equal(unchangedPassword.status, 422);
  const [[stillNotConsumed]] = await pool.execute(
    'SELECT utilizado_em FROM tokens_recuperacao_senha WHERE token_hash=?',
    [hashRecoveryToken(rawToken)],
  );
  assert.equal(stillNotConsumed.utilizado_em, null);

  const response = await request('/auth/redefinir-senha', {
    method: 'POST',
    body: { token: rawToken, novaSenha: resetPassword, confirmacaoNovaSenha: resetPassword },
  });
  assert.equal(response.status, 200);
  assert.equal((await request('/auth/me', { cookieHeader: cookie })).status, 401);
  const login = await request('/auth/login', {
    method: 'POST',
    body: { email, senha: resetPassword },
  });
  assert.equal(login.status, 200);
  const oldLogin = await request('/auth/login', {
    method: 'POST',
    body: { email, senha: initialPassword },
  });
  assert.equal(oldLogin.status, 401);
  const [[passwordRecord]] = await pool.execute('SELECT senha_hash FROM usuarios WHERE id=?', [
    userId,
  ]);
  assert.notEqual(passwordRecord.senha_hash, resetPassword);
  assert.match(passwordRecord.senha_hash, /^\$2[aby]\$/);
  const [[consumed]] = await pool.execute(
    'SELECT utilizado_em FROM tokens_recuperacao_senha WHERE token_hash=?',
    [hashRecoveryToken(rawToken)],
  );
  assert.notEqual(consumed.utilizado_em, null);
  const reused = await request('/auth/redefinir-senha', {
    method: 'POST',
    body: { token: rawToken, novaSenha: finalPassword, confirmacaoNovaSenha: finalPassword },
  });
  assert.equal(reused.status, 400);
});

test('reset rejeita token de recuperação expirado', async () => {
  const rawToken = createHash('sha256').update(`expired-${unique}`).digest('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  await pool.execute(
    `INSERT INTO tokens_recuperacao_senha (usuario_id, token_hash, expira_em)
     VALUES (?, ?, DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 1 MINUTE))`,
    [userId, tokenHash],
  );
  const response = await request('/auth/redefinir-senha', {
    method: 'POST',
    body: { token: rawToken, novaSenha: finalPassword, confirmacaoNovaSenha: finalPassword },
  });
  assert.equal(response.status, 400);
});

test('alteração de senha confirma senha atual e devolve nova sessão', async () => {
  const loginResponse = await request('/auth/login', {
    method: 'POST',
    body: { email, senha: resetPassword },
  });
  const loginBody = await loginResponse.json();
  assert.equal('accessToken' in loginBody, false);
  const oldCookie = sessionCookie(loginResponse);
  const wrong = await request('/auth/alterar-senha', {
    method: 'PUT',
    cookieHeader: oldCookie,
    csrf: true,
    body: {
      senhaAtual: 'Errada123',
      novaSenha: finalPassword,
      confirmacaoNovaSenha: finalPassword,
    },
  });
  assert.equal(wrong.status, 400);
  const changed = await request('/auth/alterar-senha', {
    method: 'PUT',
    cookieHeader: oldCookie,
    csrf: true,
    body: {
      senhaAtual: resetPassword,
      novaSenha: finalPassword,
      confirmacaoNovaSenha: finalPassword,
    },
  });
  const changedBody = await changed.json();
  assert.equal(changed.status, 200);
  assert.equal('accessToken' in changedBody, false);
  cookie = sessionCookie(changed);
  accessToken = tokenFromCookie(cookie);
  assert.equal((await request('/auth/me', { cookieHeader: oldCookie })).status, 401);
});

test('logout revoga o token atual e é protegido', async () => {
  assert.equal((await request('/auth/logout', { method: 'POST' })).status, 401);
  const response = await request('/auth/logout', {
    method: 'POST',
    cookieHeader: cookie,
    csrf: true,
  });
  assert.equal(response.status, 204);
  assert.equal((await request('/auth/me', { cookieHeader: cookie })).status, 401);
  const [[row]] = await pool.execute(
    'SELECT jti_hash FROM tokens_jwt_revogados WHERE usuario_id = ?',
    [userId],
  );
  assert.match(row.jti_hash, /^[a-f0-9]{64}$/);
});

test('limpeza periódica remove somente revogações expiradas', async () => {
  const expiredJti = randomUUID();
  await pool.execute(
    `INSERT INTO tokens_jwt_revogados (usuario_id, jti_hash, expira_em)
     VALUES (?, ?, DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 1 MINUTE))`,
    [userId, hashJti(expiredJti)],
  );
  const removed = await cleanupExpiredRevocations();
  assert.ok(removed >= 1);
  const [[row]] = await pool.execute('SELECT id FROM tokens_jwt_revogados WHERE jti_hash = ?', [
    hashJti(expiredJti),
  ]);
  assert.equal(row, undefined);
});

test('rate limit bloqueia a sexta falha de login da mesma chave', async () => {
  const isolatedEmail = `ratelimit-${unique}@example.com`;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await request('/auth/login', {
      method: 'POST',
      body: { email: isolatedEmail, senha: 'SenhaErrada123' },
    });
    assert.equal(response.status, 401, `tentativa ${attempt}`);
  }
  const blocked = await request('/auth/login', {
    method: 'POST',
    body: { email: isolatedEmail, senha: 'SenhaErrada123' },
  });
  assert.equal(blocked.status, 429);
});
