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

const { authStorage } = await import('../src/utils/authStorage.js');

test('authStorage centraliza gravação, leitura e remoção do token', () => {
  assert.equal(authStorage.getToken(), null);
  authStorage.setToken('token-test');
  assert.equal(authStorage.getToken(), 'token-test');
  authStorage.clear();
  assert.equal(authStorage.getToken(), null);
});
