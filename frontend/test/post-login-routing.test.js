import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
});
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'CustomEvent'])
  globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import('react');
const { cleanup, render, screen } = await import('@testing-library/react');
const { MemoryRouter, Route, Routes } = await import('react-router-dom');
const { AuthContext } = await import('../src/contexts/AuthContext.jsx');
const { GuestRoute } = await import('../src/routes/GuestRoute.jsx');
const { RoleRoute } = await import('../src/routes/RoleRoute.jsx');
const AccessDeniedPage = (await import('../src/pages/AccessDeniedPage.jsx')).default;
const {
  accessDeniedAction,
  defaultRouteForUser,
  isPathAuthorizedForUser,
  resolvePostLoginDestination,
  safeInternalPath,
} = await import('../src/routes/routeSecurity.js');

test.afterEach(cleanup);

const client = { perfil: 'cliente', papeis: ['cliente'] };
const barber = { perfil: 'barbeiro', papeis: ['barbeiro'] };
const admin = { perfil: 'admin', papeis: ['admin'] };
const dual = { perfil: 'barbeiro', papeis: ['barbeiro', 'admin'] };

test('cliente com intenção /admin volta para a área segura do cliente', () => {
  assert.equal(resolvePostLoginDestination(client, '/admin'), '/meus-agendamentos');
});

test('cliente com intenção /barbeiro volta para a área segura do cliente', () => {
  assert.equal(resolvePostLoginDestination(client, '/barbeiro'), '/meus-agendamentos');
});

test('cliente preserva intenção pública ou da própria área', () => {
  assert.equal(resolvePostLoginDestination(client, '/agendar?servico=1'), '/agendar?servico=1');
  assert.equal(resolvePostLoginDestination(client, '/meus-agendamentos'), '/meus-agendamentos');
  assert.equal(
    resolvePostLoginDestination(client, '/agendamentos/9007199254740993'),
    '/agendamentos/9007199254740993',
  );
});

test('cliente sem intenção recebe destino padrão', () => {
  assert.equal(resolvePostLoginDestination(client), '/meus-agendamentos');
});

test('barbeiro sem intenção ou com intenção cliente permanece na área do barbeiro', () => {
  assert.equal(resolvePostLoginDestination(barber), '/barbeiro');
  assert.equal(resolvePostLoginDestination(barber, '/meus-agendamentos'), '/barbeiro');
  assert.equal(resolvePostLoginDestination(barber, '/barbeiro/agenda'), '/barbeiro/agenda');
});

test('admin sem intenção ou com intenção cliente permanece na área administrativa', () => {
  assert.equal(resolvePostLoginDestination(admin), '/admin');
  assert.equal(resolvePostLoginDestination(admin, '/meus-agendamentos'), '/admin');
  assert.equal(resolvePostLoginDestination(admin, '/admin/agendamentos'), '/admin/agendamentos');
});

test('usuário barbeiro e admin sempre escolhe a área', () => {
  assert.equal(resolvePostLoginDestination(dual), '/selecionar-area');
  assert.equal(resolvePostLoginDestination(dual, '/admin'), '/selecionar-area');
  assert.equal(resolvePostLoginDestination(dual, '/barbeiro'), '/selecionar-area');
});

test('URLs externas, protocol-relative e esquemas perigosos são rejeitados', () => {
  for (const path of ['https://evil.test', '//evil.test/admin', 'javascript:alert(1)']) {
    assert.equal(safeInternalPath(path), null);
    assert.equal(resolvePostLoginDestination(client, path), '/meus-agendamentos');
  }
});

test('rotas de login e cadastro não são reutilizadas como intenção', () => {
  assert.equal(resolvePostLoginDestination(client, '/login'), '/meus-agendamentos');
  assert.equal(resolvePostLoginDestination(client, '/cadastro'), '/meus-agendamentos');
});

test('perfil ausente ou inválido nunca recebe fallback administrativo', () => {
  assert.equal(defaultRouteForUser({}), '/acesso-negado');
  assert.equal(resolvePostLoginDestination({ perfil: 'invalido' }, '/admin'), '/acesso-negado');
  assert.equal(isPathAuthorizedForUser({}, '/admin'), false);
});

function authValue(usuario, overrides = {}) {
  const roles = usuario?.papeis ?? [usuario?.perfil].filter(Boolean);
  return {
    usuario,
    loading: false,
    isAuthenticated: Boolean(usuario),
    hasAnyRole: (expected) => expected.some((role) => roles.includes(role)),
    ...overrides,
  };
}

test('GuestRoute autenticada usa o mesmo resolvedor central', () => {
  render(
    React.createElement(
      AuthContext.Provider,
      { value: authValue(client) },
      React.createElement(
        MemoryRouter,
        { initialEntries: [{ pathname: '/login', state: { from: { pathname: '/admin' } } }] },
        React.createElement(
          Routes,
          null,
          React.createElement(
            Route,
            { element: React.createElement(GuestRoute) },
            React.createElement(Route, {
              path: '/login',
              element: React.createElement('p', null, 'Login'),
            }),
          ),
          React.createElement(Route, {
            path: '/meus-agendamentos',
            element: React.createElement('p', null, 'Área cliente'),
          }),
        ),
      ),
    ),
  );
  assert.ok(screen.getByText('Área cliente'));
});

test('RoleRoute aguarda loading, exige autenticação e nega papel incompatível', () => {
  const renderRoute = (value) =>
    render(
      React.createElement(
        AuthContext.Provider,
        { value },
        React.createElement(
          MemoryRouter,
          { initialEntries: ['/admin'] },
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
              path: '/login',
              element: React.createElement('p', null, 'Login'),
            }),
            React.createElement(Route, {
              path: '/acesso-negado',
              element: React.createElement('p', null, 'Negado'),
            }),
          ),
        ),
      ),
    );

  renderRoute(authValue(null, { loading: true }));
  assert.ok(screen.getByText(/Validando permissões/));
  cleanup();
  renderRoute(authValue(null));
  assert.ok(screen.getByText('Login'));
  cleanup();
  renderRoute(authValue(client));
  assert.ok(screen.getByText('Negado'));
});

test('AccessDenied oferece retorno correto para cada conjunto de papéis', () => {
  assert.deepEqual(accessDeniedAction(client), {
    destination: '/meus-agendamentos',
    label: 'Voltar para meus agendamentos',
  });
  assert.equal(accessDeniedAction(barber).destination, '/barbeiro');
  assert.equal(accessDeniedAction(admin).destination, '/admin');
  assert.equal(accessDeniedAction(dual).destination, '/selecionar-area');
});

test('AccessDenied renderiza destino e rótulo específicos do cliente', () => {
  render(
    React.createElement(
      AuthContext.Provider,
      { value: authValue(client) },
      React.createElement(MemoryRouter, null, React.createElement(AccessDeniedPage)),
    ),
  );
  const link = screen.getByRole('link', { name: 'Voltar para meus agendamentos' });
  assert.equal(link.getAttribute('href'), '/meus-agendamentos');
});
