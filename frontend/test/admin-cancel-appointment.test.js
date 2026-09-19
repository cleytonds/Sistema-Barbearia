import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { api } from '../src/api/client.js';
import { adminService } from '../src/services/adminService.js';

const originalAdapter = api.defaults.adapter;

test.afterEach(() => {
  api.defaults.adapter = originalAdapter;
});

test('cancelamento administrativo envia motivo e responsabilidade', async () => {
  let config;
  api.defaults.adapter = async (request) => {
    config = request;
    return { data: { data: { id: '1030', status: 'cancelado' } }, status: 200, config: request };
  };

  await adminService.cancelAppointment('1030', 'não vem', 'cliente');

  assert.equal(config.url, '/admin/agendamentos/1030/cancelar');
  assert.deepEqual(JSON.parse(config.data), { motivo: 'não vem', responsabilidade: 'cliente' });
});

test('modal administrativo exige responsabilidade e mostra detalhes de validação', async () => {
  const source = await readFile(
    new URL('../src/pages/admin/AdminPages.jsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /Responsabilidade \*/);
  assert.match(source, /value="cliente"/);
  assert.match(source, /value="barbearia"/);
  assert.match(source, /fieldErrors\.motivo \?\? fieldErrors\.responsabilidade \?\? msg\(e\)/);
  assert.match(source, /value\.trim\(\)\.length < 3 \|\| !responsibility/);
});
