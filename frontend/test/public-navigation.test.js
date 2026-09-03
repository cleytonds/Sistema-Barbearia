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
const { fireEvent, render, cleanup, screen, waitFor } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { AuthContext } = await import('../src/contexts/AuthContext.jsx');
const { ToastProvider } = await import('../src/contexts/ToastContext.jsx');
const { api } = await import('../src/api/client.js');
const { schedulingStorage } = await import('../src/utils/schedulingStorage.js');
const HomePage = (await import('../src/pages/HomePage.jsx')).default;
const SchedulePage = (await import('../src/pages/SchedulePage.jsx')).default;

const originalAdapter = api.defaults.adapter;
const response = (data) => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {},
});
const auth = {
  loading: false,
  isAuthenticated: false,
  usuario: null,
  logout() {},
};

function renderPublic(element, initialEntry) {
  return render(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(
        AuthContext.Provider,
        { value: auth },
        React.createElement(MemoryRouter, { initialEntries: [initialEntry] }, element),
      ),
    ),
  );
}

test.afterEach(() => {
  cleanup();
  api.defaults.adapter = originalAdapter;
  window.localStorage.clear();
});

test('hash público rola até a seção real de serviços', async () => {
  let scrolled = false;
  HTMLElement.prototype.scrollIntoView = () => {
    scrolled = true;
  };
  api.defaults.adapter = async (config) => {
    if (config.url === '/servicos' || config.url === '/barbeiros')
      return response({ data: [], pagination: { page: 1, totalPages: 1 } });
    if (config.url === '/configuracoes/horarios') return response({ data: [] });
    return response({ data: {} });
  };

  renderPublic(React.createElement(HomePage), '/#servicos');

  await waitFor(() => assert.equal(scrolled, true));
  assert.ok(document.getElementById('servicos'));
});

test('link de serviço abre o agendamento com o serviço selecionado', async () => {
  api.defaults.adapter = async (config) => {
    if (config.url === '/servicos')
      return response({
        data: [{ id: '7', nome: 'Serviço escolhido', preco: '30.00', duracao_minutos: 30 }],
      });
    if (config.url === '/configuracoes/publicas')
      return response({
        data: {
          agora: '2026-09-01T02:50:00.000Z',
          fusoHorario: 'America/Recife',
          antecedenciaMaximaDias: 30,
        },
      });
    if (config.url === '/barbeiros') {
      return response({ data: [{ id: '2', nome: 'Profissional disponível' }] });
    }
    return response({ data: null });
  };

  renderPublic(React.createElement(SchedulePage), '/agendar?servicoId=7');

  const service = await screen.findByRole('radio', { name: /Serviço escolhido/ });
  await waitFor(() => assert.equal(service.checked, true));
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.click(await screen.findByRole('radio', { name: /Profissional disponível/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  const date = await screen.findByLabelText('Data');
  assert.equal(date.min, '2026-08-31');
  assert.equal(date.max, '2026-09-01');
});

test('schedule review shows the punctuality notice before observations', async () => {
  schedulingStorage.save({
    servicoId: '7',
    barbeiroId: '2',
    data: '2026-09-01',
    horaInicio: '10:00',
    observacoes: '',
  });
  api.defaults.adapter = async (config) => {
    if (config.url === '/servicos')
      return response({ data: [{ id: '7', nome: 'Servico escolhido', preco: '30.00' }] });
    if (config.url === '/configuracoes/publicas')
      return response({
        data: { agora: '2026-09-01T02:50:00.000Z', fusoHorario: 'America/Recife' },
      });
    if (config.url === '/barbeiros')
      return response({ data: [{ id: '2', nome: 'Profissional disponivel' }] });
    if (config.url === '/disponibilidade')
      return response({ horarios: [{ inicioLocal: '10:00', fimLocal: '10:30' }] });
    return response({ data: null });
  };

  renderPublic(React.createElement(SchedulePage), '/agendar');

  const notice = await screen.findByRole('status');
  assert.match(
    notice.textContent,
    /Importante: Chegue com 5 minutos de antecedência ao seu horário\. Isso ajuda a manter os atendimentos organizados e evita atrasos nos próximos agendamentos\./,
  );
  assert.ok(
    notice.compareDocumentPosition(screen.getByLabelText('Observações (opcional)')) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  );
});
