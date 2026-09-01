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
const { MemoryRouter, Route, Routes } = await import('react-router-dom');
const { api } = await import('../src/api/client.js');
const { AdminBarberDetailsPage, AdminServicesPage } =
  await import('../src/pages/admin/AdminPages.jsx');

const originalAdapter = api.defaults.adapter;
const response = (data, status = 200) => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
  config: {},
});

test('AdminServicesPage keeps an edited duration unpadded and reloads the persisted value', async () => {
  let updatedPayload;
  const service = {
    id: '78',
    nome: 'Serviço com duração editável',
    descricao: null,
    preco: 25,
    duracao_minutos: 15,
    ativo: true,
  };
  api.defaults.adapter = async (config) => {
    if (config.method === 'put' && config.url === '/admin/servicos/78') {
      updatedPayload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
      service.duracao_minutos = updatedPayload.duracao_minutos;
      return response({ data: service });
    }
    return response({ data: [service], pagination: { page: 1, totalPages: 1 } });
  };

  render(React.createElement(MemoryRouter, null, React.createElement(AdminServicesPage)));
  await screen.findByText('Serviço com duração editável');
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
  let dialog = screen.getByRole('dialog');
  const duration = within(dialog).getByLabelText('Duração em minutos');
  assert.equal(duration.value, '15');
  fireEvent.change(duration, { target: { value: '' } });
  fireEvent.change(duration, { target: { value: '20' } });
  assert.equal(duration.value, '20');
  fireEvent.change(within(dialog).getByLabelText(/Descri/), {
    target: { value: 'Corte masculino tradicional ou moderno.' },
  });
  fireEvent.submit(within(dialog).getByRole('button', { name: 'Salvar' }).closest('form'));

  await waitFor(() => assert.equal(updatedPayload?.duracao_minutos, 20));
  assert.equal(updatedPayload.preco, '25');
  assert.equal(updatedPayload.descricao, 'Corte masculino tradicional ou moderno.');
  await waitFor(() => assert.equal(screen.queryByRole('dialog'), null));
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
  dialog = screen.getByRole('dialog');
  assert.equal(within(dialog).getByLabelText('Duração em minutos').value, '20');
});

test.afterEach(() => {
  cleanup();
  api.defaults.adapter = originalAdapter;
});

test('AdminServicesPage abre formulário vazio e cria serviço com os valores informados', async () => {
  let createdPayload;
  api.defaults.adapter = async (config) => {
    if (config.method === 'post' && config.url === '/admin/servicos') {
      createdPayload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
      return response({ data: { id: '99', ...createdPayload, ativo: true } }, 201);
    }
    return response({ data: [], pagination: { page: 1, totalPages: 1 } });
  };

  render(React.createElement(MemoryRouter, null, React.createElement(AdminServicesPage)));
  await waitFor(() => assert.ok(screen.getByRole('heading', { name: 'Serviços' })));
  fireEvent.click(screen.getByRole('button', { name: 'Novo serviço' }));

  const dialog = screen.getByRole('dialog');
  const duration = within(dialog).getByLabelText('Duração em minutos');
  assert.equal(duration.value, '');
  fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: 'Serviço da API' } });
  fireEvent.change(within(dialog).getByLabelText('Descrição'), {
    target: { value: 'Descrição opcional' },
  });
  fireEvent.change(within(dialog).getByLabelText('Preço'), { target: { value: '52.50' } });
  fireEvent.change(duration, { target: { value: '45' } });
  fireEvent.submit(within(dialog).getByRole('button', { name: 'Salvar' }).closest('form'));

  await waitFor(() => assert.ok(createdPayload));
  assert.deepEqual(createdPayload, {
    nome: 'Serviço da API',
    descricao: 'Descrição opcional',
    preco: '52.50',
    duracao_minutos: 45,
  });
});

test('AdminServicesPage edita e desativa serviço existente sem nomes fixos', async () => {
  let updatedPayload;
  let statusPayload;
  const service = {
    id: '77',
    nome: 'Serviço dinâmico',
    descricao: null,
    preco: 40,
    duracao_minutos: 30,
    ativo: true,
  };
  dom.window.confirm = () => true;
  api.defaults.adapter = async (config) => {
    if (config.method === 'put') {
      updatedPayload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
      return response({ data: { ...service, ...updatedPayload } });
    }
    if (config.method === 'patch') {
      statusPayload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
      return response({ data: { ...service, ...statusPayload } });
    }
    return response({ data: [service], pagination: { page: 1, totalPages: 1 } });
  };

  render(React.createElement(MemoryRouter, null, React.createElement(AdminServicesPage)));
  await waitFor(() => assert.ok(screen.getByText('Serviço dinâmico')));
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Preço'), { target: { value: '45.00' } });
  fireEvent.submit(within(dialog).getByRole('button', { name: 'Salvar' }).closest('form'));
  await waitFor(() => assert.equal(updatedPayload.preco, '45.00'));

  fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));
  await waitFor(() => assert.deepEqual(statusPayload, { ativo: false }));
});

test('AdminBarberDetailsPage carrega serviços da API e salva vínculos por IDs reais', async () => {
  let linkedIds;
  api.defaults.adapter = async (config) => {
    if (config.method === 'put' && config.url === '/admin/barbeiros/158/servicos') {
      const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
      linkedIds = payload.servicoIds;
      return response({ data: [] });
    }
    if (config.url === '/admin/barbeiros/158') {
      return response({
        data: {
          id: '158',
          nome: 'Profissional da API',
          email: 'profissional@example.test',
          telefone: '81999999999',
          ativo: true,
        },
      });
    }
    if (config.url === '/admin/barbeiros/158/servicos') {
      return response({ data: [{ id: '90', nome: 'Serviço antigo', ativo: false }] });
    }
    if (config.url === '/servicos') {
      return response({
        data: [{ id: '91', nome: 'Serviço novo da API', ativo: true }],
        pagination: { page: 1, totalPages: 1 },
      });
    }
    return response({ data: [] });
  };

  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/admin/barbeiros/158'] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, {
          path: '/admin/barbeiros/:id',
          element: React.createElement(AdminBarberDetailsPage),
        }),
      ),
    ),
  );
  const checkbox = await screen.findByLabelText('Serviço novo da API');
  fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole('button', { name: 'Salvar vínculos' }));
  await waitFor(() => assert.deepEqual(linkedIds, [91]));
});
