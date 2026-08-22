import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/barbeiro/agenda',
});
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'CustomEvent']) {
  globalThis[key] = dom.window[key];
}
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import('react');
const { cleanup, render, screen, waitFor } = await import('@testing-library/react');
const userEvent = (await import('@testing-library/user-event')).default;
const { MemoryRouter } = await import('react-router-dom');
const BarberAgendaPage = (await import('../src/pages/barber/BarberAgendaPage.jsx')).default;
const { operacionalService } = await import('../src/services/operacionalService.js');

test.afterEach(cleanup);

test('agenda arquiva encerrado e alterna para a visualização persistida', async () => {
  const originalList = operacionalService.barberAppointments;
  const originalArchive = operacionalService.archiveAppointment;
  const calls = [];
  let archived = false;
  operacionalService.barberAppointments = async (params) => {
    calls.push(params);
    return {
      data: archived
        ? []
        : [
            {
              id: '10',
              horaInicio: '10:00',
              horaFim: '10:30',
              status: 'concluido',
              cliente: { nome: 'Cliente Teste' },
              servico: { nome: 'Serviço Teste' },
            },
          ],
      pagination: { page: 1, totalPages: 1 },
    };
  };
  operacionalService.archiveAppointment = async (id) => {
    assert.equal(id, '10');
    archived = true;
  };

  try {
    const user = userEvent.setup({ document });
    render(React.createElement(MemoryRouter, null, React.createElement(BarberAgendaPage)));
    await screen.findByRole('button', { name: 'Arquivar' });
    await user.click(screen.getByRole('button', { name: 'Arquivar' }));
    await waitFor(() => assert.equal(screen.queryByText('Cliente Teste'), null));
    await user.click(screen.getByRole('checkbox', { name: 'Ver arquivados' }));
    await waitFor(() => assert.equal(calls.at(-1).arquivados, true));
  } finally {
    operacionalService.barberAppointments = originalList;
    operacionalService.archiveAppointment = originalArchive;
  }
});
