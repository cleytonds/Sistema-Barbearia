import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('', { url: 'http://192.168.1.23:5173/' });
globalThis.window = dom.window;
globalThis.CustomEvent = dom.window.CustomEvent;
globalThis.location = dom.window.location;

window.sessionStorage.setItem('barbearia.accessToken', 'jwt-legado');
const { api } = await import('../src/api/client.js');

function response(config, data = {}) {
  return Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config });
}

test('Axios envia cookies, remove JWT legado e nunca monta Authorization', async () => {
  let received;
  await api.get('/auth/me', {
    adapter: (config) => {
      received = config;
      return response(config, { usuario: { perfil: 'cliente' } });
    },
  });
  assert.equal(api.defaults.withCredentials, true);
  assert.equal(received.withCredentials, true);
  assert.equal(received.headers.get('Authorization'), undefined);
  assert.equal(received.headers.get('X-CSRF-Protection'), undefined);
  assert.equal(window.sessionStorage.getItem('barbearia.accessToken'), null);
});

test('Axios adiciona CSRF somente a métodos mutáveis', async () => {
  for (const method of ['post', 'put', 'patch', 'delete']) {
    let received;
    await api.request({
      url: '/recurso',
      method,
      adapter: (config) => {
        received = config;
        return response(config);
      },
    });
    assert.equal(received.headers.get('X-CSRF-Protection'), '1');
    assert.equal(received.headers.get('Authorization'), undefined);
  }
});

test('URL automática preserva acesso por LAN', () => {
  assert.equal(api.defaults.baseURL, 'http://192.168.1.23:3000/api');
});
