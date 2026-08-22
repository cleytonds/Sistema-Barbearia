import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html lang="pt-BR"><body></body></html>', {
  url: 'http://localhost/',
});
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'CustomEvent'])
  globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLDialogElement.prototype.showModal = function showModal() {
  this.open = true;
};
dom.window.HTMLDialogElement.prototype.close = function close() {
  this.open = false;
};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import('react');
const { cleanup, fireEvent, render, screen, waitFor, within } =
  await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { api } = await import('../src/api/client.js');
const { AuthContext } = await import('../src/contexts/AuthContext.jsx');
const { ToastProvider } = await import('../src/contexts/ToastContext.jsx');
const { AppRoutes } = await import('../src/routes/AppRoutes.jsx');
const AdminCommissionsPage = (await import('../src/pages/admin/AdminCommissionsPage.jsx')).default;
const { AdminPlansPage } = await import('../src/pages/admin/AdminPages.jsx');

const originalAdapter = api.defaults.adapter;
const response = (data) => ({ data, status: 200, statusText: 'OK', headers: {}, config: {} });
const envelope = (data = []) => ({
  data,
  pagination: { page: 1, totalPages: 1, total: data.length },
});
const barber = { id: '10', nome: 'Profissional da API', ativo: true };
const commission = {
  id: '9007199254740993',
  agendamentoId: '9007199254740995',
  barbeiro: barber,
  servico: { id: '20', nome: 'Serviço dinâmico' },
  tipoCobranca: 'avulso',
  valorBaseSnapshot: '40.00',
  percentualSnapshot: '50.00',
  valorComissao: '20.00',
  status: 'pendente',
  criadoEm: '2026-08-10T12:00:00.000Z',
};

function renderPage(element = React.createElement(AdminCommissionsPage)) {
  return render(React.createElement(MemoryRouter, null, element));
}

test.afterEach(() => {
  cleanup();
  api.defaults.adapter = originalAdapter;
});

test('rota administrativa renderiza listagem, resumo e estrutura responsiva', async () => {
  api.defaults.adapter = async (config) =>
    response(config.url === '/admin/barbeiros' ? envelope([barber]) : envelope([commission]));
  const { container } = renderPage();
  await waitFor(() => assert.ok(screen.getByText('Serviço dinâmico')));
  assert.ok(screen.getAllByText('R$ 20,00').length >= 1);
  assert.ok(container.querySelector('.data-table-wrap'));
  assert.ok(container.querySelector('.commission-filters'));
});

test('cliente e barbeiro não acessam a rota administrativa de comissões', async () => {
  api.defaults.adapter = async () => response({ data: null });
  for (const role of ['cliente', 'barbeiro']) {
    render(
      React.createElement(
        ToastProvider,
        null,
        React.createElement(
          AuthContext.Provider,
          {
            value: {
              loading: false,
              isAuthenticated: true,
              usuario: { id: '1', nome: 'Teste', perfil: role, papeis: [role] },
              hasAnyRole: (roles) => roles.includes(role),
              hasRole: (candidate) => candidate === role,
              logout: async () => {},
            },
          },
          React.createElement(
            MemoryRouter,
            { initialEntries: ['/admin/comissoes'] },
            React.createElement(AppRoutes),
          ),
        ),
      ),
    );
    await waitFor(() => assert.ok(screen.getByRole('heading', { name: 'Acesso negado' })));
    assert.equal(screen.queryByRole('heading', { name: 'Comissões' }), null);
    cleanup();
  }
});

test('estado vazio e erro da API não derrubam a página', async () => {
  api.defaults.adapter = async (config) => {
    if (config.url === '/admin/barbeiros') return response(envelope([]));
    return response(envelope([]));
  };
  renderPage();
  await waitFor(() => assert.ok(screen.getByText('Nenhuma comissão encontrada')));
  cleanup();
  api.defaults.adapter = async (config) => {
    if (config.url === '/admin/barbeiros') return response(envelope([]));
    throw { response: { data: { error: { message: 'Falha segura da API' } } } };
  };
  renderPage();
  await waitFor(() => assert.ok(screen.getByText('Falha segura da API')));
});

test('filtros são enviados e percentuais são validados e configurados', async () => {
  let listParams;
  let configuration;
  api.defaults.adapter = async (config) => {
    if (config.url === '/admin/barbeiros') return response(envelope([barber]));
    if (config.url === '/admin/comissoes') {
      listParams = config.params;
      return response(envelope([]));
    }
    if (config.url === '/admin/barbeiros/10')
      return response({
        data: {
          ...barber,
          percentualComissaoAvulsa: '48.50',
          percentualComissaoPlano: '38.25',
        },
      });
    if (config.url === '/admin/barbeiros/10/comissao') {
      configuration = JSON.parse(config.data);
      return response({ data: { barbeiroId: '10', ...configuration, ativo: true } });
    }
    return response({});
  };
  renderPage();
  await waitFor(() => screen.getAllByLabelText('Profissional').length === 2);
  fireEvent.change(screen.getAllByLabelText('Profissional')[1], { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'plano' } });
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'pendente' } });
  await waitFor(() => assert.equal(listParams.tipo, 'plano'));

  fireEvent.change(screen.getAllByLabelText('Profissional')[0], { target: { value: '10' } });
  await waitFor(() => assert.equal(screen.getByLabelText('Comissão avulsa (%)').value, '48.50'));
  assert.equal(screen.getByLabelText('Comissão de plano (%)').value, '38.25');
  fireEvent.change(screen.getByLabelText('Comissão avulsa (%)'), { target: { value: '101' } });
  fireEvent.change(screen.getByLabelText('Comissão de plano (%)'), { target: { value: '40' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar percentuais' }));
  assert.ok(screen.getByText('Os percentuais devem estar entre 0 e 100.'));
  fireEvent.change(screen.getByLabelText('Comissão avulsa (%)'), { target: { value: '50,5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar percentuais' }));
  await waitFor(() =>
    assert.deepEqual(configuration, { percentualAvulso: '50.5', percentualPlano: '40' }),
  );
  assert.ok(screen.getByText('Percentuais de comissão salvos.'));
});

test('marcar como paga exige confirmação, atualiza e suporta replay da API', async () => {
  let paid = false;
  let calls = 0;
  api.defaults.adapter = async (config) => {
    if (config.url === '/admin/barbeiros') return response(envelope([barber]));
    if (config.url.endsWith('/pagar')) {
      calls += 1;
      paid = true;
      return response({ data: { comissao: { ...commission, status: 'paga' }, replay: calls > 1 } });
    }
    return response(envelope([{ ...commission, status: paid ? 'paga' : 'pendente' }]));
  };
  renderPage();
  await waitFor(() => screen.getByRole('button', { name: 'Marcar como paga' }));
  fireEvent.click(screen.getByRole('button', { name: 'Marcar como paga' }));
  const dialog = screen.getByRole('dialog');
  assert.ok(within(dialog).getByText('Confirmar pagamento desta comissão?'));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => assert.ok(screen.getByText('Comissão marcada como paga.')));
  assert.equal(screen.queryByRole('button', { name: 'Marcar como paga' }), null);
  assert.equal(calls, 1);
});

test('edição do plano configura valor-base somente com valor informado pelo admin', async () => {
  let saved;
  let persistedBase = null;
  const plan = {
    id: '30',
    nome: 'Plano API',
    preco: '90.00',
    adesaoInicio: '2026-08-01',
    adesaoFim: '2026-08-31',
    utilizacaoInicio: '2026-08-01',
    utilizacaoFim: '2026-08-31',
    possuiLimiteSemanal: false,
    possuiLimiteTotal: false,
    ativo: true,
    adesoesAbertas: true,
    usoStatus: 'permitido',
    servicos: [{ id: '20', nome: 'Serviço dinâmico' }],
    barbeiros: [barber],
  };
  api.defaults.adapter = async (config) => {
    if (config.url === '/admin/planos/30/servicos/20/comissao') {
      saved = JSON.parse(config.data);
      persistedBase = saved.valorBase;
      return response({ data: { planoId: '30', servicoId: '20', valorBase: saved.valorBase } });
    }
    if (config.url === '/admin/planos/30')
      return response({
        data: {
          ...plan,
          servicos: [{ id: '20', nome: 'Serviço dinâmico', valorBaseComissao: persistedBase }],
        },
      });
    if (config.url === '/admin/planos') return response(envelope([plan]));
    if (config.url === '/servicos')
      return response(envelope([{ id: '20', nome: 'Serviço dinâmico', ativo: true }]));
    if (config.url === '/barbeiros') return response(envelope([barber]));
    return response({});
  };
  renderPage(React.createElement(AdminPlansPage));
  await waitFor(() => screen.getByRole('button', { name: 'Editar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
  const dialog = await screen.findByRole('dialog');
  const input = within(dialog).getByLabelText('Valor-base para comissão — Serviço dinâmico');
  assert.equal(input.placeholder, 'Não configurado');
  fireEvent.change(input, { target: { value: '35,00' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar valor-base' }));
  await waitFor(() => assert.deepEqual(saved, { valorBase: '35.00' }));
  assert.ok(within(dialog).getByText('Valor-base de Serviço dinâmico salvo.'));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar diálogo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
  const reopened = await screen.findByRole('dialog');
  await waitFor(() =>
    assert.equal(
      within(reopened).getByLabelText('Valor-base para comissão — Serviço dinâmico').value,
      '35.00',
    ),
  );
});
