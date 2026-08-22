import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'http://localhost:5173,http://192.168.1.23:5173';
process.env.JWT_SECRET = 'cookie-test-secret-with-at-least-32-characters-123';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_ISSUER = 'barbearia-api';
process.env.JWT_AUDIENCE = 'barbearia-web';

const { app } = await import('../src/app.js');
const { verifyAccessToken } = await import('../src/auth/jwtVerifier.js');
const { revokeToken } = await import('../src/auth/jwtRevocation.js');
const { pool } = await import('../src/config/database.js');

const marker = randomUUID().replaceAll('-', '').slice(0, 12);
const email = `cookie-${marker}@example.test`;
const password = 'SenhaCookie123';
const changedPassword = 'SenhaCookie456';
const origin = 'http://localhost:5173';
let server;
let baseUrl;
let userId;
let accessToken;
let cookie;

async function request(
  path,
  { method = 'GET', body, bearer, cookieHeader, requestOrigin, csrf } = {},
) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body && { 'content-type': 'application/json' }),
      ...(bearer && { authorization: `Bearer ${bearer}` }),
      ...(cookieHeader && { cookie: cookieHeader }),
      ...(requestOrigin && { origin: requestOrigin }),
      ...(csrf && { 'x-csrf-protection': csrf }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
}

function sessionCookie(response) {
  return response.headers.get('set-cookie');
}

function cookiePair(setCookie) {
  return setCookie.split(';', 1)[0];
}

test.before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(async () => {
  if (userId) await pool.execute('DELETE FROM usuarios WHERE id=?', [userId]);
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('cadastro não expõe JWT e cria cookie HttpOnly de desenvolvimento', async () => {
  const response = await request('/auth/cadastro', {
    method: 'POST',
    body: {
      nome: 'Cliente Cookie Teste',
      email,
      telefone: `819${marker.replace(/\D/g, '').padEnd(8, '7').slice(0, 8)}`,
      senha: password,
      confirmacaoSenha: password,
    },
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  userId = body.usuario.id;
  cookie = sessionCookie(response);
  accessToken = cookiePair(cookie).slice('barbearia_session='.length);
  assert.equal('accessToken' in body, false);
  assert.match(cookie, /^barbearia_session=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Path=\//i);
  assert.match(cookie, /Max-Age=900/i);
  assert.doesNotMatch(cookie, /; Secure/i);
});

test('/auth/me aceita cookie e rejeita Bearer sem cookie', async () => {
  assert.equal((await request('/auth/me', { cookieHeader: cookiePair(cookie) })).status, 200);
  assert.equal((await request('/auth/me', { bearer: accessToken })).status, 401);
});

test('cookie inválido é rejeitado mesmo com Bearer válido', async () => {
  const response = await request('/auth/me', {
    cookieHeader: 'barbearia_session=invalido',
    bearer: accessToken,
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, 'INVALID_TOKEN');
});

test('CSRF é exigido somente para mutação autenticada por cookie', async () => {
  const path = '/auth/alterar-senha';
  const body = {};
  let response = await request(path, {
    method: 'PUT',
    body,
    cookieHeader: cookiePair(cookie),
    requestOrigin: origin,
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'CSRF_PROTECTION_REQUIRED');

  response = await request(path, {
    method: 'PUT',
    body,
    cookieHeader: cookiePair(cookie),
    requestOrigin: 'http://externa.invalid',
    csrf: '1',
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'CSRF_ORIGIN_REJECTED');

  response = await request(path, {
    method: 'PUT',
    body,
    cookieHeader: cookiePair(cookie),
    requestOrigin: origin,
    csrf: '1',
  });
  assert.equal(response.status, 422, 'CSRF válido deve alcançar o validator da rota');

  response = await request(path, { method: 'PUT', body, bearer: accessToken });
  assert.equal(response.status, 401, 'Bearer não autentica depois da Etapa 2');
});

test('alteração de senha renova somente o cookie sem expor JWT no body', async () => {
  const response = await request('/auth/alterar-senha', {
    method: 'PUT',
    body: {
      senhaAtual: password,
      novaSenha: changedPassword,
      confirmacaoNovaSenha: changedPassword,
    },
    cookieHeader: cookiePair(cookie),
    requestOrigin: origin,
    csrf: '1',
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  const renewedCookie = sessionCookie(response);
  assert.equal('accessToken' in body, false);
  accessToken = cookiePair(renewedCookie).slice('barbearia_session='.length);
  cookie = renewedCookie;
});

test('cookie com auth_versao antiga é rejeitado', async () => {
  await pool.execute('UPDATE usuarios SET auth_versao=auth_versao+1 WHERE id=?', [userId]);
  try {
    assert.equal((await request('/auth/me', { cookieHeader: cookiePair(cookie) })).status, 401);
  } finally {
    await pool.execute('UPDATE usuarios SET auth_versao=auth_versao-1 WHERE id=?', [userId]);
  }
});

test('cookie revogado é rejeitado', async () => {
  const payload = verifyAccessToken(accessToken);
  await revokeToken({
    userId,
    jti: payload.jti,
    expiresAt: new Date(payload.exp * 1000),
  });
  assert.equal((await request('/auth/me', { cookieHeader: cookiePair(cookie) })).status, 401);
});

test('login renova cookie e logout o limpa e revoga', async () => {
  const login = await request('/auth/login', {
    method: 'POST',
    body: { email, senha: changedPassword },
  });
  assert.equal(login.status, 200);
  const loginBody = await login.json();
  assert.equal('accessToken' in loginBody, false);
  const loginCookie = sessionCookie(login);
  const loginToken = cookiePair(loginCookie).slice('barbearia_session='.length);
  const logout = await request('/auth/logout', {
    method: 'POST',
    cookieHeader: cookiePair(loginCookie),
    requestOrigin: origin,
    csrf: '1',
  });
  assert.equal(logout.status, 204);
  const cleared = sessionCookie(logout);
  assert.match(cleared, /^barbearia_session=;/);
  assert.match(cleared, /HttpOnly/i);
  assert.match(cleared, /SameSite=Lax/i);
  assert.match(cleared, /Path=\//i);
  assert.match(cleared, /Expires=Thu, 01 Jan 1970/i);
  assert.equal((await request('/auth/me', { bearer: loginToken })).status, 401);
  assert.equal((await request('/auth/me', { cookieHeader: cookiePair(loginCookie) })).status, 401);
});
