import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(
  '<!doctype html><html lang="pt-BR"><body><div id="root"></div></body></html>',
  { url: 'http://localhost/' },
);
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'CustomEvent'])
  globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import('react');
const { render, cleanup, fireEvent, screen } = await import('@testing-library/react');
const { MemoryRouter, Outlet, Route, Routes, useLocation } = await import('react-router-dom');
const { AuthContext } = await import('../src/contexts/AuthContext.jsx');
const { Header } = await import('../src/components/layout/index.jsx');
const { OperationalLayout } = await import('../src/components/operational/index.jsx');

test.afterEach(cleanup);

function auth(children, roles) {
  let logoutCalls = 0;
  const value = {
    loading: false,
    isAuthenticated: true,
    usuario: { nome: 'Usuário', perfil: roles[0], papeis: roles },
    logout: async () => {
      logoutCalls += 1;
    },
    hasRole: (role) => roles.includes(role),
    hasAnyRole: (expected) => expected.some((role) => roles.includes(role)),
  };
  return {
    element: React.createElement(AuthContext.Provider, { value }, children),
    logoutCalls: () => logoutCalls,
  };
}

function CurrentPath() {
  return React.createElement('output', { 'aria-label': 'Rota atual' }, useLocation().pathname);
}

function Content() {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(CurrentPath),
    React.createElement(Outlet),
  );
}

function renderOperational(path, homePath, roles) {
  const session = auth(
    React.createElement(
      MemoryRouter,
      { initialEntries: [path] },
      React.createElement(
        Routes,
        null,
        React.createElement(
          Route,
          {
            element: React.createElement(Content, null),
          },
          React.createElement(
            Route,
            {
              element: React.createElement(OperationalLayout, {
                area: homePath === '/admin' ? 'Administração' : 'Área do barbeiro',
                homePath,
                links: [{ to: homePath, label: 'Início' }],
              }),
            },
            React.createElement(Route, {
              path: `${homePath}/*`,
              element: React.createElement('p', null, 'Conteúdo da área'),
            }),
          ),
        ),
      ),
    ),
    roles,
  );
  render(session.element);
  return session;
}

for (const path of ['/admin', '/admin/planos', '/admin/servicos']) {
  test(`logo em ${path} aponta para o início administrativo`, () => {
    const session = renderOperational(path, '/admin', ['admin', 'barbeiro']);
    const logo = screen.getByRole('link', { name: 'Elite Barbearia 081 — início' });
    assert.equal(logo.getAttribute('href'), '/admin');
    fireEvent.click(logo);
    assert.equal(screen.getByLabelText('Rota atual').textContent, '/admin');
    assert.equal(session.logoutCalls(), 0);
    assert.equal(screen.queryByText('Acesso negado'), null);
  });
}

for (const path of ['/barbeiro', '/barbeiro/agenda']) {
  test(`logo em ${path} aponta para o início do barbeiro`, () => {
    const session = renderOperational(path, '/barbeiro', ['barbeiro', 'admin']);
    const logo = screen.getByRole('link', { name: 'Elite Barbearia 081 — início' });
    assert.equal(logo.getAttribute('href'), '/barbeiro');
    fireEvent.click(logo);
    assert.equal(screen.getByLabelText('Rota atual').textContent, '/barbeiro');
    assert.equal(session.logoutCalls(), 0);
    assert.equal(screen.queryByText('Acesso negado'), null);
  });
}

test('logo do layout público preserva o destino comum', () => {
  const session = auth(
    React.createElement(MemoryRouter, { initialEntries: ['/planos'] }, React.createElement(Header)),
    ['cliente'],
  );
  render(session.element);
  assert.equal(
    screen.getByRole('link', { name: 'Elite Barbearia 081 — início' }).getAttribute('href'),
    '/',
  );
  assert.equal(session.logoutCalls(), 0);
});
