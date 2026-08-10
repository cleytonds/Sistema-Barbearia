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
dom.window.HTMLDialogElement.prototype.showModal = function showModal() {
  this.open = true;
};
dom.window.HTMLDialogElement.prototype.close = function close() {
  this.open = false;
};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import('react');
const { render, cleanup, fireEvent, screen, waitFor, within } =
  await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { AuthContext } = await import('../src/contexts/AuthContext.jsx');
const { ToastProvider } = await import('../src/contexts/ToastContext.jsx');
const { api } = await import('../src/api/client.js');
const { AdminPlansPage, AdminSubscriptionsPage } =
  await import('../src/pages/admin/AdminPages.jsx');
const PlanosPage = (await import('../src/pages/PlanosPage.jsx')).default;
const MeuPlanoPage = (await import('../src/pages/MeuPlanoPage.jsx')).default;
const { AppRoutes } = await import('../src/routes/AppRoutes.jsx');
const { normalizePlan } = await import('../src/services/planoService.js');

const originalAdapter = api.defaults.adapter;

test.afterEach(() => {
  cleanup();
  api.defaults.adapter = originalAdapter;
});

const response = (data, status = 200) => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
  config: {},
});

const ok = (data) => async () => response(data);

/**
 * Wraps a page in the providers it needs (Router, Auth, Toast). The api adapter
 * returns empty, safe payloads so the four pages render without throwing.
 */
function renderPage(element) {
  return render(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(
        AuthContext.Provider,
        {
          value: {
            loading: false,
            isAuthenticated: true,
            logout: async () => {},
            hasRole: () => true,
            hasAnyRole: () => true,
            onLogin: async () => {},
          },
        },
        React.createElement(MemoryRouter, null, element),
      ),
    ),
  );
}

function renderRoute(path) {
  return render(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(
        AuthContext.Provider,
        {
          value: {
            loading: false,
            isAuthenticated: true,
            usuario: { id: '1', perfil: 'cliente', papeis: ['cliente'] },
            logout: async () => {},
            hasRole: (role) => role === 'cliente',
            hasAnyRole: (roles) => roles.includes('cliente'),
            onLogin: async () => {},
          },
        },
        React.createElement(
          MemoryRouter,
          { initialEntries: [path] },
          React.createElement(AppRoutes),
        ),
      ),
    ),
  );
}

// ===========================================================================
// Exportação das páginas admin (causa raiz da tela preta)
// ===========================================================================
test('AdminPages exporta AdminPlansPage e AdminSubscriptionsPage', () => {
  assert.equal(typeof AdminPlansPage, 'function');
  assert.equal(typeof AdminSubscriptionsPage, 'function');
});

// ===========================================================================
// /admin/planos e /admin/assinaturas renderizam sem componente undefined
// ===========================================================================
test('AdminPlansPage renderiza com resposta vazia sem exceção', async () => {
  api.defaults.adapter = ok({ data: [], pagination: { page: 1, totalPages: 1 } });
  renderPage(React.createElement(AdminPlansPage));
  await waitFor(() => assert.ok(screen.getByText('Planos')));
});

test('AdminPlansPage carrega todas as páginas de serviços ativos sem nomes fixos', async () => {
  api.defaults.adapter = async (config) => {
    if (config.url === '/servicos') {
      const page = Number(config.params?.page ?? 1);
      return response(
        page === 1
          ? {
              data: [
                { id: '101', nome: 'Serviço dinâmico A', ativo: true },
                { id: '102', nome: 'Serviço inativo da API', ativo: false },
              ],
              pagination: { page: 1, totalPages: 2 },
            }
          : {
              data: [{ id: '103', nome: 'Serviço dinâmico B', ativo: true }],
              pagination: { page: 2, totalPages: 2 },
            },
      );
    }
    if (config.url === '/barbeiros') {
      return response({ data: [{ id: '201', nome: 'Profissional da API', ativo: true }] });
    }
    return response({ data: [], pagination: { page: 1, totalPages: 1 } });
  };

  renderPage(React.createElement(AdminPlansPage));
  await waitFor(() => assert.ok(screen.getByRole('heading', { name: 'Planos' })));
  fireEvent.click(screen.getByRole('button', { name: 'Novo plano' }));
  await waitFor(() => assert.ok(screen.getByText('Serviço dinâmico A')));
  assert.ok(screen.getByText('Serviço dinâmico B'));
  assert.equal(screen.queryByText('Serviço inativo da API'), null);

  const first = screen.getByLabelText('Serviço dinâmico A');
  const second = screen.getByLabelText('Serviço dinâmico B');
  fireEvent.click(first);
  fireEvent.click(second);
  assert.equal(first.checked, true);
  assert.equal(second.checked, true);
});

test('AdminPlansPage preserva serviços selecionados e mantém os demais disponíveis na edição', async () => {
  api.defaults.adapter = async (config) => {
    if (config.url === '/servicos') {
      return response({
        data: [
          { id: '301', nome: 'Serviço já incluído', ativo: true },
          { id: '302', nome: 'Serviço disponível', ativo: true },
        ],
        pagination: { page: 1, totalPages: 1 },
      });
    }
    if (config.url === '/barbeiros') {
      return response({ data: [{ id: '401', nome: 'Profissional da API', ativo: true }] });
    }
    if (config.url === '/admin/planos') {
      return response({
        data: [
          {
            id: '501',
            nome: 'Plano editável',
            preco: '80.00',
            ativo: true,
            adesoesAbertas: true,
            usoStatus: 'permitido',
            servicos: [{ id: '301', nome: 'Serviço já incluído' }],
            barbeiros: [{ id: '401', nome: 'Profissional da API' }],
          },
        ],
        pagination: { page: 1, totalPages: 1 },
      });
    }
    return response({ data: [] });
  };

  renderPage(React.createElement(AdminPlansPage));
  await waitFor(() => assert.ok(screen.getByText('Plano editável')));
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
  const dialog = screen.getByRole('dialog');
  await waitFor(() => assert.ok(within(dialog).getByLabelText('Serviço já incluído')));
  assert.equal(within(dialog).getByLabelText('Serviço já incluído').checked, true);
  assert.equal(within(dialog).getByLabelText('Serviço disponível').checked, false);
});

test('AdminPlansPage desativa e reativa plano com contrato booleano e atualiza a lista', async () => {
  let active = true;
  const statusRequests = [];
  api.defaults.adapter = async (config) => {
    if (config.url === '/servicos' || config.url === '/barbeiros') {
      return response({ data: [], pagination: { page: 1, totalPages: 1 } });
    }
    if (config.url === '/admin/planos' && config.method === 'get') {
      return response({
        data: [
          {
            id: '601',
            nome: 'Plano com status',
            preco: '90.00',
            ativo: active,
            adesoesAbertas: true,
            usoStatus: 'permitido',
            servicos: [],
            barbeiros: [],
          },
        ],
        pagination: { page: 1, totalPages: 1 },
      });
    }
    if (config.url === '/admin/planos/601/status' && config.method === 'patch') {
      const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
      statusRequests.push(payload);
      active = payload.ativo;
      return response({ data: { id: '601', ativo: active } });
    }
    return response({ data: [] });
  };

  renderPage(React.createElement(AdminPlansPage));
  await screen.findByText('Plano com status');
  fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));
  assert.ok(
    screen.getByText(
      'Deseja desativar este plano? Isso impede novas adesões, mas preserva o histórico e as assinaturas existentes.',
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Ativar' })));
  assert.deepEqual(statusRequests[0], { ativo: false });
  assert.equal(screen.queryByRole('dialog'), null);

  fireEvent.click(screen.getByRole('button', { name: 'Ativar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Desativar' })));
  assert.deepEqual(statusRequests[1], { ativo: true });
});

test('AdminSubscriptionsPage renderiza com resposta vazia sem exceção', async () => {
  api.defaults.adapter = ok({ data: [], pagination: { page: 1, totalPages: 1 } });
  renderPage(React.createElement(AdminSubscriptionsPage));
  await waitFor(() => assert.ok(screen.getByText('Assinaturas')));
});

// ===========================================================================
// /planos (pública) — resposta vazia e campos opcionais nulos
// ===========================================================================
test('PlanosPage renderiza estado vazio sem exceção', async () => {
  api.defaults.adapter = ok({ data: [], pagination: { page: 1, totalPages: 1 } });
  renderPage(React.createElement(PlanosPage));
  await waitFor(() => assert.ok(screen.getByRole('heading', { name: 'Planos' })));
  assert.ok(screen.getByText('Nenhum plano disponível no momento'));
});

test('rota /planos renderiza a página pública', async () => {
  api.defaults.adapter = ok({ data: [], pagination: { page: 1, totalPages: 1 } });
  renderRoute('/planos');
  await waitFor(() => assert.ok(screen.getByRole('heading', { name: 'Planos' })));
});

test('rota /meu-plano renderiza estado vazio seguro', async () => {
  api.defaults.adapter = ok({ data: null });
  renderRoute('/meu-plano');
  await waitFor(() => assert.ok(screen.getByRole('heading', { name: 'Meu plano' })));
  await waitFor(() => assert.ok(screen.getByText('Você não possui um plano ativo')));
});

test('PlanosPage renderiza resposta válida em camelCase', async () => {
  api.defaults.adapter = ok({
    data: [
      {
        id: 1,
        nome: 'Plano Corte',
        preco: '99.90',
        adesaoInicio: '2026-08-01T00:00:00.000Z',
        adesaoFim: '2026-12-31T00:00:00.000Z',
        utilizacaoInicio: '2026-08-01T00:00:00.000Z',
        utilizacaoFim: '2026-12-31T00:00:00.000Z',
        possuiLimiteSemanal: false,
        limiteSemanal: null,
        possuiLimiteTotal: true,
        limiteTotal: 8,
        servicos: [],
        barbeiros: [],
        descricao: 'Descrição disponível somente no detalhe',
      },
    ],
    pagination: { page: 1, totalPages: 1 },
  });
  renderPage(React.createElement(PlanosPage));
  await waitFor(() => assert.ok(screen.getByText('Plano Corte')));
  assert.ok(screen.getByText((text) => text.replace(/\s/g, ' ') === 'R$ 99,90'));
  assert.ok(screen.getByText('Disponível'));
  assert.ok(screen.getByText('Utilizações por semana'));
  assert.ok(screen.getByText('Utilizações no total'));
  assert.ok(screen.getByText('Ilimitado'));
  assert.equal(screen.queryByText('Descrição disponível somente no detalhe'), null);
  assert.ok(screen.getByRole('button', { name: 'Assinar' }));
  assert.ok(screen.getByRole('button', { name: 'Ver detalhes do plano' }));
});

test('PlanosPage carrega detalhe público e renderiza vários vínculos vindos da API', async () => {
  api.defaults.adapter = async (config) => {
    if (config.url === '/planos/52') {
      return response({
        data: {
          id: '52',
          nome: 'Plano Gold',
          preco: '90.00',
          adesaoInicio: '2026-08-08T00:00:00.000Z',
          adesaoFim: '2026-11-30T00:00:00.000Z',
          utilizacaoInicio: '2026-08-08T00:00:00.000Z',
          utilizacaoFim: '2026-11-30T00:00:00.000Z',
          possuiLimiteSemanal: true,
          limiteSemanal: 1,
          possuiLimiteTotal: false,
          limiteTotal: null,
          usoStatus: 'suspenso',
          criadoEm: '2026-08-01T10:00:00.000Z',
          descricao: 'Benefícios completos do plano',
          servicos: [
            { id: '1', nome: 'Serviço API A' },
            { id: '2', nome: 'Serviço API B' },
          ],
          barbeiros: [
            { id: '158', nome: 'Profissional API A' },
            { id: '159', nome: 'Profissional API B' },
          ],
        },
      });
    }
    return response({
      data: [{ id: '52', nome: 'Plano Gold', preco: '90.00' }],
      pagination: { page: 1, totalPages: 1 },
    });
  };

  renderPage(React.createElement(PlanosPage));
  await waitFor(() => assert.ok(screen.getByText('Plano Gold')));
  assert.equal(screen.queryByText('Serviço API A'), null);
  assert.equal(screen.queryByText('Profissional API A'), null);
  assert.equal(screen.queryByText('Benefícios completos do plano'), null);
  fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes do plano' }));
  await waitFor(() => assert.ok(screen.getByText('Serviço API A')));
  assert.ok(screen.getByText('Serviço API B'));
  assert.ok(screen.getByText('Profissional API A'));
  assert.ok(screen.getByText('Profissional API B'));
  assert.equal(screen.queryByText('Benefícios completos do plano'), null);
  assert.equal(screen.queryByText(/Adesão/i), null);
  assert.equal(screen.queryByRole('heading', { name: 'Sobre o plano' }), null);
  assert.ok(screen.getByRole('heading', { name: 'Período do plano' }));
  assert.equal(screen.queryByText('Agosto a Novembro de 2026'), null);
  assert.equal(screen.getAllByText(/8 de agosto de 2026.*30 de novembro de 2026/).length, 1);
  assert.ok(screen.getByRole('heading', { name: 'Utilizações por semana' }));
  assert.equal(screen.queryByRole('heading', { name: 'Utilizações no total' }), null);
  assert.equal(screen.queryByText('suspenso'), null);
  assert.equal(screen.queryByText('2026-08-01T10:00:00.000Z'), null);
  assert.ok(screen.getByRole('button', { name: 'Confirmar assinatura' }));
});

test('PlanosPage renderiza um serviço e um profissional no detalhe', async () => {
  api.defaults.adapter = async (config) =>
    config.url === '/planos/7'
      ? response({
          data: {
            id: '7',
            nome: 'Plano individual',
            preco: '50.00',
            utilizacaoInicio: '2026-08-08T00:00:00.000Z',
            utilizacaoFim: '2026-08-15T00:00:00.000Z',
            possuiLimiteSemanal: true,
            limiteSemanal: 1,
            possuiLimiteTotal: true,
            limiteTotal: 4,
            servicos: [{ id: '3', nome: 'Serviço único da API' }],
            barbeiros: [{ id: '8', nome: 'Profissional único da API' }],
          },
        })
      : response({ data: [{ id: '7', nome: 'Plano individual', preco: '50.00' }] });

  renderPage(React.createElement(PlanosPage));
  await waitFor(() => assert.ok(screen.getByText('Plano individual')));
  assert.equal(screen.queryByText('Serviço único da API'), null);
  fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes do plano' }));
  await waitFor(() => assert.ok(screen.getByText('Serviço único da API')));
  assert.ok(screen.getByText('Profissional único da API'));
  assert.equal(screen.queryByText('Agosto de 2026'), null);
  assert.equal(screen.queryByRole('heading', { name: 'Utilizações no total' }), null);
});

test('PlanosPage informa claramente quando o detalhe não possui vínculos', async () => {
  api.defaults.adapter = async (config) =>
    config.url === '/planos/8'
      ? response({ data: { id: '8', nome: 'Plano vazio', preco: '40.00' } })
      : response({ data: [{ id: '8', nome: 'Plano vazio', preco: '40.00' }] });

  renderPage(React.createElement(PlanosPage));
  await waitFor(() => assert.ok(screen.getByText('Plano vazio')));
  assert.equal(screen.queryByText('Nenhum serviço informado.'), null);
  fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes do plano' }));
  await waitFor(() => assert.ok(screen.getByText('Nenhum serviço informado.')));
  assert.ok(screen.getByText('Nenhum profissional informado.'));
  assert.equal(screen.queryByRole('heading', { name: 'Sobre o plano' }), null);
  assert.ok(within(screen.getByRole('dialog')).getByText(/Data não informada.*Data não informada/));
});

test('adapter de plano normaliza vínculos ausentes como listas vazias', () => {
  const normalized = normalizePlan({ id: '1', nome: 'Plano' });
  assert.deepEqual(normalized.servicos, []);
  assert.deepEqual(normalized.barbeiros, []);
});

test('PlanosPage não lança RangeError com datas ausentes ou inválidas', async () => {
  api.defaults.adapter = ok({
    data: [
      {
        id: 'datas-invalidas',
        nome: 'Plano com datas opcionais',
        preco: '79.90',
        adesaoInicio: undefined,
        adesaoFim: null,
        utilizacaoInicio: '',
        utilizacaoFim: 'data-invalida',
        servicos: [],
        barbeiros: [],
      },
    ],
    pagination: { page: 1, totalPages: 1 },
  });

  assert.doesNotThrow(() => renderPage(React.createElement(PlanosPage)));
  await waitFor(() => assert.ok(screen.getByText('Plano com datas opcionais')));
  assert.equal(screen.getAllByText(/Data não informada/).length, 1);
});

// ===========================================================================
// /meu-plano — contrato real em snake_case e campos opcionais nulos
// ===========================================================================
test('MeuPlanoPage renderiza plano válido em camelCase', async () => {
  api.defaults.adapter = async (config) => {
    if (config.url === '/meu-plano') {
      return response({
        data: {
          id: 1,
          status: 'ativa',
          inicioEm: '2026-08-01',
          fimEm: '2026-08-31',
          valorContratado: '99.90',
          planoNomeSnapshot: 'Plano Corte',
          possuiLimiteTotalSnapshot: true,
          limiteTotalSnapshot: 8,
          possuiLimiteSemanalSnapshot: true,
          limiteSemanalSnapshot: 2,
          motivoStatus: null,
        },
      });
    }
    if (config.url === '/meu-plano/usos') {
      return response({ data: [] });
    }
    return response({ data: [] });
  };
  renderPage(React.createElement(MeuPlanoPage));
  await waitFor(() => assert.ok(screen.getByText('Plano Corte')));
  assert.ok(screen.getByText('Ativa'));
  assert.ok(screen.getByText('8'));
});

test('MeuPlanoPage renderiza assinatura com campos opcionais nulos', async () => {
  api.defaults.adapter = async (config) => {
    if (config.url === '/meu-plano') {
      return response({
        data: {
          id: 1,
          status: 'suspensa',
          inicio_em: '2026-08-01',
          fim_em: '2026-08-31',
          valor_contratado: '99.90',
          plano_nome_snapshot: 'Plano Corte',
          possui_limite_total_snapshot: false,
          limite_total_snapshot: null,
          possui_limite_semanal_snapshot: false,
          limite_semanal_snapshot: null,
          motivo_status: 'Inadimplência',
        },
      });
    }
    if (config.url === '/meu-plano/usos') {
      return response({ data: [] });
    }
    return response({ data: [] });
  };
  renderPage(React.createElement(MeuPlanoPage));
  await waitFor(() => assert.ok(screen.getByText('Plano Corte')));
  assert.ok(screen.getByText('Ilimitado'));
  assert.ok(screen.getByText((content) => content.includes('Inadimplência')));
});

// ===========================================================================
// Todos os quatro carregam sem exceção com dados reais
// ===========================================================================
test('as quatro páginas de planos renderizam sem exceção', async () => {
  api.defaults.adapter = ok({ data: [], pagination: { page: 1, totalPages: 1 } });
  renderPage(React.createElement(AdminPlansPage));
  await waitFor(() => assert.ok(screen.getByText('Planos')));
  cleanup();

  renderPage(React.createElement(AdminSubscriptionsPage));
  await waitFor(() => assert.ok(screen.getByText('Assinaturas')));
  cleanup();

  renderPage(React.createElement(PlanosPage));
  await waitFor(() => assert.ok(screen.getByRole('heading', { name: 'Planos' })));
  cleanup();

  api.defaults.adapter = ok({ data: null });
  renderPage(React.createElement(MeuPlanoPage));
  await waitFor(() => assert.ok(screen.getByText('Você não possui um plano ativo')));
});

// ===========================================================================
// Erros 401, 403 e 500
// ===========================================================================
test('PlanosPage trata erro 500 com mensagem de falha', async () => {
  api.defaults.adapter = async () =>
    Promise.reject({
      response: {
        status: 500,
        data: { error: { message: 'Erro interno.' } },
        config: { url: '/planos' },
      },
    });
  renderPage(React.createElement(PlanosPage));
  await waitFor(() => assert.ok(screen.getByText('Não foi possível carregar os planos.')));
});

test('PlanosPage aceita campos opcionais ausentes sem erro de renderização', async () => {
  api.defaults.adapter = ok({
    data: [{ id: '9', nome: 'Plano essencial', preco: '59.90' }],
    pagination: { page: 1, totalPages: 1 },
  });
  renderPage(React.createElement(PlanosPage));
  await waitFor(() => assert.ok(screen.getByText('Plano essencial')));
  assert.ok(screen.getByText((text) => text.includes('Data não informada')));
});

test('AdminPlansPage renderiza dados camelCase válidos', async () => {
  api.defaults.adapter = ok({
    data: [
      {
        id: '10',
        nome: 'Plano administrativo',
        preco: '89.90',
        ativo: true,
        adesoesAbertas: true,
        usoStatus: 'permitido',
      },
    ],
    pagination: { page: 1, totalPages: 1 },
  });
  renderPage(React.createElement(AdminPlansPage));
  await waitFor(() => assert.ok(screen.getAllByText('Plano administrativo').length >= 1));
});

test('MeuPlanoPage trata erro 401 sem renderizar conteúdo', async () => {
  api.defaults.adapter = async () =>
    Promise.reject({ response: { status: 401, data: {}, config: { url: '/meu-plano' } } });
  renderPage(React.createElement(MeuPlanoPage));
  await waitFor(() => assert.ok(screen.getByText('Não foi possível carregar seu plano.')));
});

test('AdminPlansPage trata erro 403 sem exceção', async () => {
  api.defaults.adapter = async () =>
    Promise.reject({
      response: {
        status: 403,
        data: { error: { message: 'Proibido.' } },
        config: { url: '/admin/planos' },
      },
    });
  renderPage(React.createElement(AdminPlansPage));
  await waitFor(() => assert.ok(screen.getByRole('heading', { name: 'Planos' })));
});
