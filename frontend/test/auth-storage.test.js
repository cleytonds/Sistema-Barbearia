import assert from 'node:assert/strict';
import test from 'node:test';

const values = new Map();
globalThis.window = {
  sessionStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  },
};

values.set('barbearia.accessToken', 'token-legado');
const { authStorage } = await import('../src/utils/authStorage.js');

test('authStorage remove somente o token legado e não oferece gravação de JWT', () => {
  assert.equal(values.has('barbearia.accessToken'), false);
  assert.equal('getToken' in authStorage, false);
  assert.equal('setToken' in authStorage, false);
  values.set('barbearia.accessToken', 'outro-token-legado');
  authStorage.clearLegacyToken();
  assert.equal(values.has('barbearia.accessToken'), false);
});
