import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import axe from 'axe-core';
const dom = new JSDOM(
  '<!doctype html><html lang="pt-BR"><body><div id="root"></div></body></html>',
  { url: 'http://localhost/' },
);
for (const key of ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'Node', 'CustomEvent'])
  globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
HTMLDialogElement.prototype.showModal = function showModal() {
  this.open = true;
};
HTMLDialogElement.prototype.close = function close() {
  this.open = false;
  this.dispatchEvent(new dom.window.Event('close'));
};
const React = await import('react');
const { render, cleanup, fireEvent, screen, waitFor, within } =
  await import('@testing-library/react');
const userEvent = (await import('@testing-library/user-event')).default;
const { MemoryRouter, Route, Routes, useLocation } = await import('react-router-dom');
const { AuthContext } = await import('../src/contexts/AuthContext.jsx');
const { BrandMark } = await import('../src/components/brand/BrandMark.jsx');
const { Button, Dialog, EmptyState, Input, PasswordInput, Stepper } =
  await import('../src/components/ui/index.jsx');
const { Footer, Header, PublicLayout, SkipLink } =
  await import('../src/components/layout/index.jsx');
const { operacionalService } = await import('../src/services/operacionalService.js');
const { servicoService } = await import('../src/services/servicoService.js');
const NotFoundPage = (await import('../src/pages/NotFoundPage.jsx')).default;
const globalStyles = await readFile(new URL('../src/styles/global.css', import.meta.url), 'utf8');
const auth = { loading: false, isAuthenticated: false, usuario: null, logout() {} };
function wrapper(children, authValue = auth) {
  return React.createElement(
    MemoryRouter,
    null,
    React.createElement(AuthContext.Provider, { value: authValue }, children),
  );
}
test.afterEach(cleanup);

test('BrandMark renderiza a logo oficial, alt e fallback textual', () => {
  render(wrapper(React.createElement(BrandMark)));
  const image = screen.getByAltText('Elite Barbearia 081');
  assert.match(image.getAttribute('src'), /elite-barbearia-081-logo\.jpg/);
  assert.equal(image.getAttribute('width'), '1024');
  assert.equal(image.getAttribute('height'), '1024');
  fireEvent.error(image);
  assert.ok(screen.getByText('Elite Barbearia 081'));
});
test('Button respeita loading e Input associa erro acessível', () => {
  render(
    React.createElement(
      'div',
      null,
      React.createElement(Button, { loading: true }, 'Salvar'),
      React.createElement(Input, { label: 'E-mail', error: 'Inválido' }),
    ),
  );
  assert.equal(screen.getByRole('button').disabled, true);
  const input = screen.getByLabelText('E-mail');
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  assert.match(input.getAttribute('aria-describedby'), /error/);
});
test('PasswordInput alterna visibilidade', async () => {
  const user = userEvent.setup({ document });
  render(React.createElement(PasswordInput, { label: 'Senha' }));
  assert.equal(screen.getByLabelText('Senha').type, 'password');
  await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));
  assert.equal(screen.getByLabelText('Senha').type, 'text');
});
test('Dialog abre e fecha por Escape', async () => {
  let open = true;
  const close = () => {
    open = false;
  };
  render(
    React.createElement(
      Dialog,
      { open, onClose: close, title: 'Confirmar' },
      React.createElement(Button, null, 'Continuar'),
    ),
  );
  assert.equal(screen.getByRole('dialog').open, true);
  screen.getByRole('dialog').dispatchEvent(new dom.window.Event('cancel', { cancelable: true }));
  assert.equal(open, false);
});
test('Stepper identifica etapa atual e concluídas sem depender apenas de cor', () => {
  render(React.createElement(Stepper, { steps: ['Serviço', 'Profissional', 'Data'], current: 1 }));
  const currentStep = screen.getByText('Profissional').closest('li');
  assert.equal(currentStep.getAttribute('aria-current'), 'step');
  assert.match(screen.getByText(/concluída/).textContent, /concluída/);
  assert.equal(
    screen.getByText('Serviço').closest('li').classList.contains('stepper__item--complete'),
    true,
  );
});
test('EmptyState oferece ação acessível para recuperação', async () => {
  let selected = false;
  const user = userEvent.setup({ document });
  render(
    React.createElement(
      EmptyState,
      { title: 'Nenhum profissional disponível para este serviço' },
      React.createElement('p', null, 'Escolha outro serviço ou tente novamente mais tarde.'),
      React.createElement(
        Button,
        {
          onClick: () => {
            selected = true;
          },
        },
        'Escolher outro serviço',
      ),
    ),
  );
  await user.click(screen.getByRole('button', { name: 'Escolher outro serviço' }));
  assert.equal(selected, true);
});
test('Header visitante preserva navegação sem duplicar Agendar', async () => {
  const user = userEvent.setup({ document });
  render(
    wrapper(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(SkipLink),
        React.createElement(Header),
        React.createElement(NotFoundPage),
      ),
    ),
  );
  assert.ok(screen.getByText('Pular para o conteúdo'));
  assert.ok(screen.getByRole('link', { name: 'Elite Barbearia 081 — início' }));
  assert.equal(screen.getAllByRole('link', { name: 'Agendar' }).length, 1);
  assert.equal(screen.getByRole('link', { name: 'Agendar' }).getAttribute('href'), '/agendar');
  assert.equal(screen.getByRole('link', { name: 'Entrar' }).getAttribute('href'), '/login');
  assert.match(
    globalStyles,
    /\.header-actions\s*>\s*\.header-account-link\s*\{\s*display:\s*inline-flex;/,
  );
  assert.equal(screen.queryByRole('link', { name: 'Criar conta' }), null);
  for (const [name, href] of [
    ['Início', '/'],
    ['Serviços', '/#servicos'],
    ['Barbeiros', '/#profissionais'],
    ['Planos', '/planos'],
  ]) {
    assert.equal(screen.getByRole('link', { name }).getAttribute('href'), href);
  }
  assert.equal(screen.queryByRole('link', { name: 'Meus agendamentos' }), null);
  assert.ok(screen.getByRole('heading', { name: 'Página não encontrada.' }));
  const trigger = screen.getByRole('button', { name: 'Abrir menu' });
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(trigger.getAttribute('aria-controls'), 'mobile-navigation');
  await user.click(trigger);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  const mobileMenu = within(screen.getByRole('dialog', { name: 'Menu principal' }));
  assert.equal(mobileMenu.getByRole('link', { name: 'Entrar' }).getAttribute('href'), '/login');
  assert.equal(
    mobileMenu.getByRole('link', { name: 'Criar conta' }).getAttribute('href'),
    '/cadastro',
  );
  assert.equal(screen.getAllByRole('link', { name: 'Criar conta' }).length, 1);
  await user.keyboard('{Escape}');
  assert.equal(screen.queryByRole('dialog', { name: 'Menu principal' }), null);
  assert.equal(document.activeElement, trigger);
});
test('Header autenticado preserva Conta e Sair sem opções de visitante no menu mobile', async () => {
  const user = userEvent.setup({ document });
  render(
    wrapper(React.createElement(Header), {
      loading: false,
      isAuthenticated: true,
      usuario: { perfil: 'cliente' },
      logout() {},
    }),
  );
  assert.ok(screen.getByRole('link', { name: 'Meus agendamentos' }));
  assert.ok(screen.getByRole('link', { name: 'Conta' }));
  assert.ok(screen.getByRole('button', { name: 'Sair' }));
  await user.click(screen.getByRole('button', { name: 'Abrir menu' }));
  const mobileMenu = within(screen.getByRole('dialog', { name: 'Menu principal' }));
  assert.equal(
    mobileMenu.getByRole('link', { name: 'Conta' }).getAttribute('href'),
    '/meus-agendamentos',
  );
  assert.ok(mobileMenu.getByRole('button', { name: 'Sair' }));
  assert.equal(mobileMenu.queryByRole('link', { name: 'Entrar' }), null);
  assert.equal(mobileMenu.queryByRole('link', { name: 'Criar conta' }), null);
});
test('Footer consome serviços reais, mantém contato oficial e omite endereço ausente', async () => {
  operacionalService.publicConfig = async () => ({ data: { telefone: null, endereco: null } });
  operacionalService.publicHours = async () => ({ data: [] });
  let receivedParameters;
  servicoService.listPublic = async (parameters) => {
    receivedParameters = parameters;
    return { data: [{ id: 7, nome: 'Serviço real da API' }] };
  };
  render(wrapper(React.createElement(Footer)));
  await waitFor(() => assert.ok(screen.getByText('Serviço real da API')));
  assert.deepEqual(receivedParameters, { page: 1, limit: 5, sort: 'nome', order: 'asc' });
  assert.ok(screen.getByRole('link', { name: 'Ver todos os serviços' }));
  assert.equal(
    screen.getByRole('link', { name: 'Serviço real da API' }).getAttribute('href'),
    '/agendar?servicoId=7',
  );
  for (const [name, href] of [
    ['Início', '/'],
    ['Serviços', '/#servicos'],
    ['Barbeiros', '/#profissionais'],
    ['Planos', '/planos'],
    ['Agendar horário', '/agendar'],
    ['Meus agendamentos', '/meus-agendamentos'],
    ['Meu plano', '/meu-plano'],
  ]) {
    assert.equal(screen.getByRole('link', { name }).getAttribute('href'), href);
  }
  const instagram = screen.getAllByRole('link', {
    name: 'Abrir Instagram da Elite Barbearia 081 em nova aba',
  })[0];
  assert.equal(instagram.getAttribute('href'), 'https://www.instagram.com/barbeariaelite081/');
  assert.equal(instagram.getAttribute('target'), '_blank');
  assert.equal(instagram.getAttribute('rel'), 'noopener noreferrer');
  assert.ok(screen.getByText('(81) 99268-0506'));
  assert.equal(screen.queryByText('Endereço'), null);
  for (const link of ['Início', 'Serviços', 'Barbeiros', 'Agendar horário', 'Meus agendamentos'])
    assert.ok(screen.getByRole('link', { name: link }));
  for (const fakeLink of ['Política de Privacidade', 'Termos de Uso', 'Desenvolvido por'])
    assert.equal(screen.queryByText(fakeLink), null);
  assert.ok(screen.getByText(new RegExp(String(new Date().getFullYear()))));
  assert.equal(screen.getByAltText('Elite Barbearia 081').getAttribute('loading'), 'lazy');
});
test('Footer esconde seção de serviços vazia e preserva o contato administrativo oficial', async () => {
  operacionalService.publicConfig = async () => ({
    data: { telefone: '5581992680506', endereco: 'Rua retornada pela API' },
  });
  operacionalService.publicHours = async () => ({
    data: [{ dia_semana: 1, ativo: true, hora_inicio: '09:00', hora_fim: '18:00' }],
  });
  servicoService.listPublic = async () => ({ data: [] });
  render(wrapper(React.createElement(Footer)));
  await waitFor(() => assert.ok(screen.getByText('(81) 99268-0506')));
  assert.equal(
    screen.getByText('(81) 99268-0506').closest('a').getAttribute('href'),
    'tel:5581992680506',
  );
  assert.ok(screen.getByText('Rua retornada pela API'));
  assert.equal(screen.queryByRole('heading', { name: 'Serviços' }), null);
  assert.ok(screen.getByText('Segunda: 09:00–18:00'));
});
test('Links rápidos navegam para os destinos reais e restauram o topo', async () => {
  operacionalService.publicConfig = async () => ({ data: {} });
  operacionalService.publicHours = async () => ({ data: [] });
  servicoService.listPublic = async () => ({ data: [] });
  const scrollCalls = [];
  window.scrollTo = (...args) => scrollCalls.push(args);
  const LocationProbe = () => {
    const location = useLocation();
    return React.createElement(
      'output',
      { 'aria-label': 'Destino atual' },
      `${location.pathname}${location.hash}`,
    );
  };
  const user = userEvent.setup({ document });
  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/origem'] },
      React.createElement(
        AuthContext.Provider,
        { value: auth },
        React.createElement(
          Routes,
          null,
          React.createElement(
            Route,
            { element: React.createElement(PublicLayout) },
            React.createElement(Route, {
              path: '*',
              element: React.createElement(LocationProbe),
            }),
          ),
        ),
      ),
    ),
  );
  await waitFor(() => assert.ok(screen.getByRole('contentinfo')));
  const quickLinks = within(screen.getByRole('heading', { name: 'Links rápidos' }).closest('nav'));

  for (const [name, destination] of [
    ['Início', '/'],
    ['Serviços', '/#servicos'],
    ['Barbeiros', '/#profissionais'],
    ['Planos', '/planos'],
    ['Agendar horário', '/agendar'],
    ['Meus agendamentos', '/meus-agendamentos'],
    ['Meu plano', '/meu-plano'],
  ]) {
    await user.click(quickLinks.getByRole('link', { name }));
    assert.equal(screen.getByLabelText('Destino atual').textContent, destination);
  }
  assert.ok(scrollCalls.length >= 6);
  assert.deepEqual(scrollCalls.at(-1), [{ top: 0, left: 0, behavior: 'auto' }]);
});
test('Header e Footer não têm violações críticas no axe', async () => {
  operacionalService.publicConfig = async () => ({ data: {} });
  operacionalService.publicHours = async () => ({ data: [] });
  servicoService.listPublic = async () => ({ data: [] });
  const { container } = render(
    wrapper(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(Header),
        React.createElement(Footer),
      ),
    ),
  );
  await waitFor(() => assert.ok(screen.getByRole('contentinfo')));
  const result = await axe.run(container);
  assert.equal(result.violations.filter((item) => item.impact === 'critical').length, 0);
});
test('componentes fundamentais não têm violações críticas no axe', async () => {
  const { container } = render(
    wrapper(
      React.createElement(
        'main',
        null,
        React.createElement('h1', null, 'Teste'),
        React.createElement(Input, { label: 'Nome' }),
        React.createElement(Button, null, 'Enviar'),
      ),
    ),
  );
  const result = await axe.run(container);
  assert.equal(result.violations.filter((item) => item.impact === 'critical').length, 0);
});
