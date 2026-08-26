import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const appointment = {
  id: '90071992547409931234',
  servico: { nome: 'Corte e barba' },
  barbeiro: { nome: 'João', telefone: '81988982892' },
  data: '2026-08-15',
  horaInicio: '09:30',
  status: 'confirmado',
};

const {
  buildWhatsAppMessage,
  buildWhatsAppShareUrl,
  hasWhatsAppShareData,
  normalizeBrazilianWhatsApp,
} = await import('../src/utils/whatsappShare.js');

test('monta mensagem completa em pt-BR, preserva BIGINT string e codifica acentos', () => {
  const message = buildWhatsAppMessage(appointment, 'Barbearia São José');
  assert.match(message, /Barbearia São José/);
  assert.match(message, /Serviço: Corte e barba/);
  assert.match(message, /Profissional: João/);
  assert.match(message, /Data: 15 de agosto de 2026/);
  assert.match(message, /Horário: 09:30/);
  assert.match(message, /Código do agendamento: 90071992547409931234/);
  assert.match(message, /Status: Confirmado/);
  const url = buildWhatsAppShareUrl(appointment, 'Barbearia São José');
  assert.ok(url.startsWith('https://wa.me/5581988982892?text='));
  assert.equal(decodeURIComponent(url.split('?text=')[1]), message);
});

test('normaliza o WhatsApp do barbeiro associado sem misturar destinos', () => {
  const barberA = { ...appointment, barbeiro: { nome: 'Barbeiro A', telefone: '81988982892' } };
  const barberB = {
    ...appointment,
    barbeiro: { nome: 'Barbeiro B', telefone: '(81) 99268-0506' },
  };
  const urlA = buildWhatsAppShareUrl(barberA);
  const urlB = buildWhatsAppShareUrl(barberB);

  assert.ok(urlA.startsWith('https://wa.me/5581988982892?text='));
  assert.ok(urlB.startsWith('https://wa.me/5581992680506?text='));
  assert.equal(urlA.includes('5581992680506'), false);
  assert.equal(urlB.includes('5581988982892'), false);
  assert.equal(normalizeBrazilianWhatsApp('+55 81 99268-0506'), '5581992680506');
  assert.equal(normalizeBrazilianWhatsApp('telefone inválido'), null);
  assert.equal(buildWhatsAppShareUrl({ ...appointment, barbeiro: { nome: 'Sem telefone' } }), null);
});

test('não inclui dados sensíveis ou administrativos mesmo quando presentes no objeto', () => {
  const message = buildWhatsAppMessage({
    ...appointment,
    email: 'privado@example.com',
    telefone: '81999999999',
    token: 'segredo',
    observacoes: 'privada',
    motivoAdministrativo: 'interno',
  });
  for (const forbidden of ['privado@example.com', '81999999999', 'segredo', 'privada', 'interno'])
    assert.equal(message.includes(forbidden), false);
});

test('rejeita dados obrigatórios incompletos', () => {
  for (const key of ['id', 'data', 'horaInicio', 'status'])
    assert.equal(hasWhatsAppShareData({ ...appointment, [key]: '' }), false);
  assert.equal(hasWhatsAppShareData({ ...appointment, servico: null }), false);
  assert.equal(hasWhatsAppShareData({ ...appointment, barbeiro: null }), false);
});

test('permite WhatsApp apenas para agendamentos ativos', () => {
  for (const status of ['pendente', 'confirmado', 'em_atendimento']) {
    assert.equal(hasWhatsAppShareData({ ...appointment, status }), true);
  }
  for (const status of ['concluido', 'cancelado', 'ausente']) {
    assert.equal(hasWhatsAppShareData({ ...appointment, status }), false);
    assert.equal(buildWhatsAppShareUrl({ ...appointment, status }), null);
  }
});

test('botão abre nova aba com proteção de opener, funciona por teclado e não confirma envio', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
  });
  for (const key of ['window', 'document', 'HTMLElement', 'Node', 'CustomEvent'])
    globalThis[key] = dom.window[key];
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: dom.window.navigator,
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import('react');
  const { render, cleanup, screen } = await import('@testing-library/react');
  const userEvent = (await import('@testing-library/user-event')).default;
  const { ToastProvider } = await import('../src/contexts/ToastContext.jsx');
  const { WhatsAppShareButton } =
    await import('../src/components/appointments/WhatsAppShareButton.jsx');
  const opened = { opener: window };
  let call;
  window.open = (...args) => {
    call = args;
    return opened;
  };
  render(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(WhatsAppShareButton, {
        agendamento: appointment,
        nomeBarbearia: 'Elite Barbearia 081',
      }),
    ),
  );
  const button = screen.getByRole('button', { name: /Enviar pelo WhatsApp/ });
  button.focus();
  await userEvent.setup({ document }).keyboard('{Enter}');
  assert.equal(call[1], '_blank');
  assert.equal(call[2], 'noopener,noreferrer');
  assert.equal(opened.opener, null);
  assert.ok(screen.getByText('WhatsApp aberto com os dados do agendamento.'));
  assert.equal(screen.queryByText(/mensagem enviada/i), null);
  cleanup();

  render(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(WhatsAppShareButton, {
        agendamento: { ...appointment, data: '', barbeiro: { nome: appointment.barbeiro.nome } },
      }),
    ),
  );
  assert.equal(screen.getByRole('button', { name: /Enviar pelo WhatsApp/ }).disabled, true);
  assert.ok(screen.getByText('WhatsApp do profissional não cadastrado.'));
  cleanup();

  window.open = () => null;
  render(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(WhatsAppShareButton, {
        agendamento: appointment,
        nomeBarbearia: 'Elite Barbearia 081',
      }),
    ),
  );
  await userEvent
    .setup({ document })
    .click(screen.getByRole('button', { name: /Enviar pelo WhatsApp/ }));
  assert.ok(screen.getByRole('alert'));
  assert.match(screen.getByRole('alert').textContent, /tente novamente/i);
  assert.equal(screen.queryByText('WhatsApp aberto com os dados do agendamento.'), null);
  cleanup();
});

test('páginas do cliente exibem o componente somente após os dados carregarem', async () => {
  const success = await readFile(
    new URL('../src/pages/ScheduleSuccessPage.jsx', import.meta.url),
    'utf8',
  );
  const detail = await readFile(
    new URL('../src/pages/AppointmentDetailsPage.jsx', import.meta.url),
    'utf8',
  );
  assert.match(success, /<WhatsAppShareButton agendamento=\{data\} \/>/);
  assert.ok(success.indexOf('<WhatsAppShareButton') > success.indexOf('loading ?'));
  assert.match(success, /hasWhatsAppShareData\(data\)/);
  assert.match(detail, /<WhatsAppShareButton agendamento=\{data\} \/>/);
});

test('sucesso mobile mostra WhatsApp no topo do card e erro da API não mostra', async () => {
  const React = await import('react');
  const { render, cleanup, screen, waitFor } = await import('@testing-library/react');
  const { MemoryRouter, Route, Routes } = await import('react-router-dom');
  const { ToastProvider } = await import('../src/contexts/ToastContext.jsx');
  const { api } = await import('../src/api/client.js');
  const ScheduleSuccessPage = (await import('../src/pages/ScheduleSuccessPage.jsx')).default;
  const originalAdapter = api.defaults.adapter;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });

  const renderPage = () =>
    render(
      React.createElement(
        ToastProvider,
        null,
        React.createElement(
          MemoryRouter,
          { initialEntries: ['/agendamento/sucesso/123'] },
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: '/agendamento/sucesso/:id',
              element: React.createElement(ScheduleSuccessPage),
            }),
          ),
        ),
      ),
    );

  try {
    api.defaults.adapter = async (config) => ({
      data:
        config.url === '/agendamentos/123'
          ? {
              data: {
                ...appointment,
                id: '123',
                horaFim: '10:00',
                preco: '40.00',
              },
            }
          : { data: { nomeBarbearia: 'Elite Barbearia 081' } },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    });
    renderPage();
    const button = await screen.findByRole('button', { name: /Enviar pelo WhatsApp/ });
    const share = button.closest('.schedule-success__share');
    assert.ok(share);
    assert.ok(
      share.compareDocumentPosition(screen.getByRole('heading', { name: 'Corte e barba' })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    );
    cleanup();

    api.defaults.adapter = async () => {
      throw new Error('Falha simulada');
    };
    renderPage();
    await waitFor(() => assert.ok(screen.getByRole('alert')));
    assert.equal(screen.queryByRole('button', { name: /Enviar pelo WhatsApp/ }), null);
  } finally {
    cleanup();
    api.defaults.adapter = originalAdapter;
  }
});

test('histórico oferece ocultação somente visual sem operação de exclusão', async () => {
  const historyPage = await readFile(
    new URL('../src/pages/MyAppointmentsPage.jsx', import.meta.url),
    'utf8',
  );
  const card = await readFile(
    new URL('../src/components/appointments/index.jsx', import.meta.url),
    'utf8',
  );
  assert.match(historyPage, /period === 'historico'/);
  assert.match(historyPage, /setHiddenHistoryIds/);
  assert.match(card, /Ocultar do meu histórico/);
  assert.doesNotMatch(historyPage, /delete|remove|\.destroy\(/i);
});

test('histórico continua renderizando e oculta o cartão apenas na tela', async () => {
  const React = await import('react');
  const { render, cleanup, fireEvent, screen, waitFor } = await import('@testing-library/react');
  const { MemoryRouter } = await import('react-router-dom');
  const { ToastProvider } = await import('../src/contexts/ToastContext.jsx');
  const { api } = await import('../src/api/client.js');
  const MyAppointmentsPage = (await import('../src/pages/MyAppointmentsPage.jsx')).default;
  const originalAdapter = api.defaults.adapter;
  const calls = [];
  api.defaults.adapter = async (config) => {
    calls.push(`${config.method} ${config.url}`);
    const historical = config.params?.periodo === 'historico';
    return {
      data: {
        data: historical
          ? [
              {
                id: '55',
                status: 'cancelado',
                data: '2026-08-10',
                horaInicio: '09:00',
                horaFim: '09:30',
                preco: '40.00',
                servico: { nome: 'Corte do histórico' },
                barbeiro: { nome: 'Profissional' },
                podeCancelar: false,
                podeReagendar: false,
              },
            ]
          : [],
        pagination: { page: 1, totalPages: 1 },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };

  try {
    render(
      React.createElement(
        ToastProvider,
        null,
        React.createElement(MemoryRouter, null, React.createElement(MyAppointmentsPage)),
      ),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Histórico' }));
    await waitFor(() => assert.ok(screen.getByText('Corte do histórico')));
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar do meu histórico' }));
    await waitFor(() => assert.equal(screen.queryByText('Corte do histórico'), null));
    assert.ok(screen.getByText('Nenhum agendamento no histórico'));
    assert.deepEqual([...new Set(calls)], ['get /agendamentos/meus']);
  } finally {
    cleanup();
    api.defaults.adapter = originalAdapter;
  }
});
