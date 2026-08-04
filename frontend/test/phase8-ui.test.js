import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import axe from 'axe-core';
const dom = new JSDOM(
  '<!doctype html><html lang="pt-BR"><body><div id="root"></div></body></html>',
  { url: 'http://localhost/' },
);
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'CustomEvent'])
  globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const { render, cleanup, screen, waitFor } = await import('@testing-library/react');
const userEvent = (await import('@testing-library/user-event')).default;
const { MemoryRouter, Route, Routes } = await import('react-router-dom');
const { AuthContext } = await import('../src/contexts/AuthContext.jsx');
const { RoleRoute } = await import('../src/routes/RoleRoute.jsx');
const { OperationalLayout } = await import('../src/components/operational/index.jsx');
const { homeByRole, safeInternalPath } = await import('../src/routes/routeSecurity.js');
const AccessDeniedPage = (await import('../src/pages/AccessDeniedPage.jsx')).default;
const BarberDashboardPage = (await import('../src/pages/barber/BarberDashboardPage.jsx')).default;
const { operacionalService } = await import('../src/services/operacionalService.js');
const { api } = await import('../src/api/client.js');
const { authStorage } = await import('../src/utils/authStorage.js');
test.afterEach(cleanup);
function auth(value, children) {
  return React.createElement(
    AuthContext.Provider,
    { value: { loading: false, isAuthenticated: true, logout: async () => {}, ...value } },
    children,
  );
}
test('destinos por perfil são internos e rejeitam open redirect', () => {
  assert.equal(homeByRole('cliente'), '/meus-agendamentos');
  assert.equal(homeByRole('barbeiro'), '/barbeiro');
  assert.equal(homeByRole('admin'), '/admin');
  assert.equal(safeInternalPath('/admin'), '/admin');
  assert.equal(safeInternalPath('//evil.test'), null);
  assert.equal(safeInternalPath('https://evil.test'), null);
});
test('RoleRoute permite o perfil correto e envia perfil incompatível ao acesso negado', () => {
  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/admin'] },
      auth(
        { usuario: { perfil: 'barbeiro' } },
        React.createElement(
          Routes,
          null,
          React.createElement(
            Route,
            { element: React.createElement(RoleRoute, { roles: ['admin'] }) },
            React.createElement(Route, {
              path: '/admin',
              element: React.createElement('p', null, 'Admin'),
            }),
          ),
          React.createElement(Route, {
            path: '/acesso-negado',
            element: React.createElement('p', null, 'Negado'),
          }),
        ),
      ),
    ),
  );
  assert.ok(screen.getByText('Negado'));
});
test('layout operacional possui navegação, drawer acessível, Escape e axe sem erro crítico', async () => {
  const user = userEvent.setup({ document });
  render(
    React.createElement(
      MemoryRouter,
      null,
      auth(
        { usuario: { nome: 'Profissional', perfil: 'barbeiro' } },
        React.createElement(
          Routes,
          null,
          React.createElement(
            Route,
            {
              element: React.createElement(OperationalLayout, {
                area: 'Área do barbeiro',
                links: [{ to: '/barbeiro', label: 'Visão geral' }],
              }),
            },
            React.createElement(Route, {
              index: true,
              element: React.createElement('h1', null, 'Painel'),
            }),
          ),
        ),
      ),
    ),
  );
  const trigger = screen.getByRole('button', { name: 'Menu' });
  await user.click(trigger);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.ok(screen.getByRole('dialog', { name: 'Menu Área do barbeiro' }));
  await user.keyboard('{Escape}');
  assert.equal(screen.queryByRole('dialog'), null);
  assert.equal(document.activeElement, trigger);
  const results = await axe.run(document.body);
  assert.equal(results.violations.filter((v) => v.impact === 'critical').length, 0);
});

test('401 limpa a sessão e emite evento, enquanto 403 preserva o token', async () => {
  let unauthorized = 0;
  window.addEventListener('auth:unauthorized', () => unauthorized++, { once: true });
  authStorage.setToken('token-de-teste');
  await assert.rejects(
    api.get('/privada', {
      adapter: () => Promise.reject({ response: { status: 401 }, config: { url: '/privada' } }),
    }),
  );
  assert.equal(authStorage.getToken(), null);
  assert.equal(unauthorized, 1);
  authStorage.setToken('token-preservado');
  await assert.rejects(
    api.get('/proibida', {
      adapter: () => Promise.reject({ response: { status: 403 }, config: { url: '/proibida' } }),
    }),
  );
  assert.equal(authStorage.getToken(), 'token-preservado');
  authStorage.clear();
});

test('AccessDeniedPage orienta retorno para a área do perfil', () => {
  render(
    React.createElement(
      MemoryRouter,
      null,
      auth({ usuario: { perfil: 'barbeiro' } }, React.createElement(AccessDeniedPage)),
    ),
  );
  assert.ok(screen.getByRole('heading', { name: 'Acesso negado' }));
  assert.equal(
    screen.getByRole('link', { name: 'Voltar para minha área' }).getAttribute('href'),
    '/barbeiro',
  );
});

test('dashboard do barbeiro cobre loading e estado vazio sem dados financeiros', async () => {
  const original = operacionalService.barberDashboard;
  let resolveRequest;
  operacionalService.barberDashboard = () =>
    new Promise((resolve) => {
      resolveRequest = resolve;
    });
  render(React.createElement(MemoryRouter, null, React.createElement(BarberDashboardPage)));
  assert.ok(screen.getByRole('status'));
  resolveRequest({
    data: {
      total: 0,
      pendentes: 0,
      confirmados: 0,
      emAtendimento: 0,
      concluidos: 0,
      ausentes: 0,
      proximoAtendimento: null,
    },
  });
  await waitFor(() => assert.ok(screen.getByText('Nenhum próximo atendimento hoje.')));
  assert.equal(document.body.textContent.includes('Faturamento'), false);
  operacionalService.barberDashboard = original;
});
