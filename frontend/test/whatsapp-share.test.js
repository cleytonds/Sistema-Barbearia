import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const appointment = {
  id: '90071992547409931234',
  servico: { nome: 'Corte e barba' },
  barbeiro: { nome: 'João' },
  data: '2026-08-15',
  horaInicio: '09:30',
  status: 'confirmado',
};

const { buildWhatsAppMessage, buildWhatsAppShareUrl, hasWhatsAppShareData } =
  await import('../src/utils/whatsappShare.js');

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
  assert.ok(url.startsWith('https://wa.me/?text='));
  assert.equal(url.includes('phone='), false);
  assert.equal(decodeURIComponent(url.split('?text=')[1]), message);
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
      React.createElement(WhatsAppShareButton, { agendamento: { ...appointment, data: '' } }),
    ),
  );
  assert.equal(screen.getByRole('button', { name: /Enviar pelo WhatsApp/ }).disabled, true);
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
  for (const source of [success, detail]) {
    assert.match(source, /<WhatsAppShareButton agendamento=\{data\} \/>/);
    assert.ok(source.indexOf('<WhatsAppShareButton') > source.indexOf('loading ?'));
    assert.match(source, /hasWhatsAppShareData\(data\)/);
  }
});
