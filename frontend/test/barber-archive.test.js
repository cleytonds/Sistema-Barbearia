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
const { default: BarberAgendaPage, barberAgendaToday } =
  await import('../src/pages/barber/BarberAgendaPage.jsx');
const { operacionalService } = await import('../src/services/operacionalService.js');

test('agenda uses Recife civil date instead of UTC date', () => {
  assert.equal(barberAgendaToday(new Date('2026-08-26T02:30:00.000Z')), '2026-08-25');
});

test('agenda mostra hoje e próximos do próprio barbeiro', async () => {
  const originalList = operacionalService.barberAppointments;
  const RealDate = globalThis.Date;
  const calls = [];
  class FixedDate extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : ['2026-08-26T12:00:00.000Z']));
    }
    static now() {
      return new RealDate('2026-08-26T12:00:00.000Z').getTime();
    }
  }
  globalThis.Date = FixedDate;
  operacionalService.barberAppointments = async (params) => {
    calls.push(params);
    return {
      data:
        params.periodo === 'inicio'
          ? [
              {
                id: 'agenda-a-amanha',
                data: '2026-08-27',
                horaInicio: '09:00',
                horaFim: '09:30',
                status: 'confirmado',
                cliente: { nome: 'Cliente do Barbeiro A' },
                servico: { nome: 'Serviço A amanhã' },
              },
            ]
          : [
              {
                id: 'agenda-a-hoje',
                data: '2026-08-26',
                horaInicio: '18:00',
                horaFim: '18:30',
                status: 'confirmado',
                cliente: { nome: 'Cliente do Barbeiro A' },
                servico: { nome: 'Serviço A hoje' },
              },
            ],
      pagination: { page: 1, totalPages: 1 },
    };
  };

  try {
    const user = userEvent.setup({ document });
    render(React.createElement(MemoryRouter, null, React.createElement(BarberAgendaPage)));
    await screen.findByText('Serviço A hoje');
    assert.equal(calls.at(-1).data, '2026-08-26');
    await user.click(screen.getByRole('button', { name: 'Próximos' }));
    await screen.findByText('Serviço A amanhã');
    assert.ok(screen.getByText('2026-08-27 · 09:00–09:30'));
    assert.equal(calls.at(-1).periodo, 'inicio');
    assert.equal(calls.at(-1).data, undefined);
    assert.equal(calls.at(-1).sort, 'inicio');
    assert.equal(calls.at(-1).order, 'asc');
    assert.equal(screen.queryByText('Serviço do Barbeiro B'), null);
  } finally {
    operacionalService.barberAppointments = originalList;
    globalThis.Date = RealDate;
  }
});

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
