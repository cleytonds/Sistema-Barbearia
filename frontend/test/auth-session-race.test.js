import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost:5173/',
});
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'CustomEvent']) {
  globalThis[key] = dom.window[key];
}
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import('react');
const { act, cleanup, render, waitFor } = await import('@testing-library/react');
const { AuthContext, AuthProvider } = await import('../src/contexts/AuthContext.jsx');
const { api } = await import('../src/api/client.js');

const originalAdapter = api.defaults.adapter;
let current;

function Probe() {
  current = React.useContext(AuthContext);
  return null;
}

function response(config, data) {
  return Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config });
}

test.afterEach(() => {
  cleanup();
  api.defaults.adapter = originalAdapter;
  current = null;
});

test('401 inicial atrasado nao remove sessao confirmada no login', async () => {
  const usuario = { id: '440', perfil: 'barbeiro', papeis: ['barbeiro', 'admin'] };
  let rejectInitialCheck;
  let loginConcluido = false;
  api.defaults.adapter = (config) => {
    if (config.url === '/auth/login') {
      loginConcluido = true;
      return response(config, {});
    }
    if (config.url === '/auth/me' && loginConcluido) return response(config, { usuario });
    if (config.url === '/auth/me')
      return new Promise((_, reject) => {
        rejectInitialCheck = () => reject({ response: { status: 401 }, config });
      });
    throw new Error(`Unexpected request: ${config.url}`);
  };
  render(React.createElement(AuthProvider, null, React.createElement(Probe)));

  await act(async () => {
    await current.login('barbeiro@example.test', 'senha-artificial');
  });
  await waitFor(() => assert.equal(current.isAuthenticated, true));
  await act(async () => rejectInitialCheck());
  assert.equal(current.isAuthenticated, true);
  assert.deepEqual(current.papeis, ['barbeiro', 'admin']);
});

test('401 de auth/me nao emite logout global e 403 tambem nao', async () => {
  let unauthorized = 0;
  const listener = () => unauthorized++;
  window.addEventListener('auth:unauthorized', listener);
  for (const [url, status] of [
    ['/auth/me', 401],
    ['/admin/recurso', 403],
  ]) {
    await assert.rejects(
      api.get(url, { adapter: () => Promise.reject({ response: { status }, config: { url } }) }),
    );
  }
  assert.equal(unauthorized, 0);
  window.removeEventListener('auth:unauthorized', listener);
});

test('Axios protegido preserva URL relativa e cookies', () => {
  assert.equal(api.defaults.baseURL, 'http://localhost:3000/api');
  assert.equal(api.defaults.withCredentials, true);
});
