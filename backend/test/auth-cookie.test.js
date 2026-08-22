import assert from 'node:assert/strict';
import test from 'node:test';
import { AUTH_COOKIE_NAME, authCookieOptions, readAuthCookie } from '../src/auth/authCookie.js';

test('opções do cookie alinham segurança e expiração ao JWT', () => {
  assert.deepEqual(authCookieOptions({ production: false, maxAgeSeconds: 900 }), {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 900_000,
  });
  assert.equal(authCookieOptions({ production: true }).secure, true);
});

test('parser distingue cookie ausente de cookie presente e inválido', () => {
  assert.deepEqual(readAuthCookie({ get: () => undefined }), { present: false, value: null });
  assert.deepEqual(readAuthCookie({ get: () => `outro=1; ${AUTH_COOKIE_NAME}=token%2Ejwt` }), {
    present: true,
    value: 'token.jwt',
  });
  assert.deepEqual(readAuthCookie({ get: () => `${AUTH_COOKIE_NAME}=` }), {
    present: true,
    value: '',
  });
});
