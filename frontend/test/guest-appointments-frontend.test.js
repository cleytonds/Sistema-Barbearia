import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { api } from '../src/api/client.js';
import { adminService } from '../src/services/adminService.js';
import { operacionalService } from '../src/services/operacionalService.js';

const originalAdapter = api.defaults.adapter;
const response = (config) => ({ data: { data: { id: '1' } }, status: 201, config, headers: {} });

test.afterEach(() => {
  api.defaults.adapter = originalAdapter;
});

test('admin envia visitante ao endpoint correto com profissional', async () => {
  let config;
  api.defaults.adapter = async (request) => {
    config = request;
    return response(request);
  };
  const data = {
    clienteNome: 'Visitante',
    barbeiroId: 2,
    servicoId: 3,
    data: '2026-09-20',
    horaInicio: '10:00',
  };
  await adminService.createGuestAppointment(data, '12345678-1234-4234-9234-123456789012');
  assert.equal(config.url, '/admin/agendamentos/sem-cadastro');
  assert.deepEqual(config.data, JSON.stringify(data));
});

test('barbeiro envia visitante sem barbeiroId ao endpoint correto', async () => {
  let config;
  api.defaults.adapter = async (request) => {
    config = request;
    return response(request);
  };
  const data = { clienteNome: 'Visitante', servicoId: 3, data: '2026-09-20', horaInicio: '10:00' };
  await operacionalService.createGuestAppointment(data, '12345678-1234-4234-9234-123456789012');
  assert.equal(config.url, '/barbeiro/agendamentos/sem-cadastro');
  assert.equal(config.data.includes('barbeiroId'), false);
});

test('ações e rotas visitante ficam restritas às áreas admin e barbeiro', async () => {
  const [admin, barber, routes, form] = await Promise.all([
    readFile(new URL('../src/pages/admin/AdminPages.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/barber/BarberAgendaPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/routes/AppRoutes.jsx', import.meta.url), 'utf8'),
    readFile(
      new URL('../src/components/appointments/GuestAppointmentForm.jsx', import.meta.url),
      'utf8',
    ),
  ]);
  assert.match(admin, /Agendamento com cadastro/);
  assert.match(admin, /Agendamento sem cadastro/);
  assert.match(barber, /Agendamento sem cadastro/);
  assert.match(routes, /RoleRoute roles=\{\['barbeiro'\]\}/);
  assert.match(routes, /RoleRoute roles=\{\['admin'\]\}/);
  assert.equal(form.includes('isAdmin ? { barbeiroId:'), true);
  assert.equal(form.includes('role="cliente"'), false);
});
