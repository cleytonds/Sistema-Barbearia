import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost:5173/',
});
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'CustomEvent']) {
  globalThis[key] = dom.window[key];
}
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: dom.window.navigator,
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import('react');
const { render, cleanup, waitFor, act } = await import('@testing-library/react');
const { AuthProvider, AuthContext } = await import('../src/contexts/AuthContext.jsx');
const { api } = await import('../src/api/client.js');

const originalAdapter = api.defaults.adapter;
let current;

function Probe() {
  current = React.useContext(AuthContext);
  return null;
}

function response(config, data = {}, status = 200) {
  return Promise.resolve({ data, status, statusText: 'OK', headers: {}, config });
}

test.afterEach(() => {
  cleanup();
  api.defaults.adapter = originalAdapter;
  current = null;
});

test('reload consulta /auth/me e preserva usuário com múltiplos papéis', async () => {
  const usuario = { id: '1', perfil: 'barbeiro', papeis: ['barbeiro', 'admin'] };
  let requested;
  api.defaults.adapter = (config) => {
    requested = config;
    return response(config, { usuario });
  };
  render(React.createElement(AuthProvider, null, React.createElement(Probe)));
  await waitFor(() => assert.equal(current.loading, false));
  assert.equal(requested.url, '/auth/me');
  assert.equal(requested.method, 'get');
  assert.equal(current.isAuthenticated, true);
  assert.deepEqual(current.papeis, ['barbeiro', 'admin']);
  assert.equal('token' in current, false);
});

test('login confirma a sessÃ£o por /auth/me antes de atualizar o estado React', async () => {
  const usuario = { id: '2', perfil: 'cliente', papeis: ['cliente'] };
  const requests = [];
  let loginConcluido = false;
  api.defaults.adapter = (config) => {
    requests.push(config);
    if (config.url === '/auth/me') {
      if (loginConcluido) return response(config, { usuario });
      return Promise.reject({ response: { status: 401 }, config });
    }
    if (config.url === '/auth/login') {
      loginConcluido = true;
      return response(config, {});
    }
    if (config.url === '/auth/logout') return response(config, {}, 204);
    throw new Error(`Requisição inesperada: ${config.url}`);
  };
  render(React.createElement(AuthProvider, null, React.createElement(Probe)));
  await waitFor(() => assert.equal(current.loading, false));
  assert.equal(current.isAuthenticated, false);

  let loggedUser;
  await act(async () => {
    loggedUser = await current.login('cliente@example.test', 'senha-artificial');
  });
  await waitFor(() => assert.equal(current.isAuthenticated, true));
  assert.equal(loggedUser, usuario);
  assert.equal(window.sessionStorage.getItem('barbearia.accessToken'), null);

  await act(async () => {
    await current.logout();
  });
  await waitFor(() => assert.equal(current.isAuthenticated, false));
  const loginRequest = requests.find((request) => request.url === '/auth/login');
  const logoutRequest = requests.find((request) => request.url === '/auth/logout');
  assert.equal(loginRequest.headers.get('Authorization'), undefined);
  assert.equal(loginRequest.headers.get('X-CSRF-Protection'), '1');
  assert.equal(logoutRequest.headers.get('X-CSRF-Protection'), '1');
});

test('login nÃ£o autentica quando a confirmaÃ§Ã£o por /auth/me retorna 401', async () => {
  api.defaults.adapter = (config) => {
    if (config.url === '/auth/login') return response(config, {});
    if (config.url === '/auth/me') return Promise.reject({ response: { status: 401 }, config });
    throw new Error(`RequisiÃ§Ã£o inesperada: ${config.url}`);
  };
  render(React.createElement(AuthProvider, null, React.createElement(Probe)));
  await waitFor(() => assert.equal(current.loading, false));

  await assert.rejects(() => current.login('cliente@example.test', 'senha-artificial'));
  assert.equal(current.isAuthenticated, false);
});
