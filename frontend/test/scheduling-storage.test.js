import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import {
  SCHEDULING_DRAFT_TTL_MS,
  SCHEDULING_STORAGE_KEY,
  schedulingStorage,
} from '../src/utils/schedulingStorage.js';
const dom = new JSDOM('', { url: 'http://localhost/' });
globalThis.window = dom.window;
test.beforeEach(() => window.sessionStorage.clear());
test('rascunho salva e restaura somente o contrato versionado', () => {
  const data = {
    servicoId: '2',
    barbeiroId: '3',
    data: '2030-01-02',
    horaInicio: '10:00',
    observacoes: 'Teste',
  };
  assert.equal(schedulingStorage.save(data, 1000), true);
  assert.deepEqual(schedulingStorage.read(1001), data);
  const stored = JSON.parse(window.sessionStorage.getItem(SCHEDULING_STORAGE_KEY));
  assert.equal(stored.version, 1);
  assert.equal(stored.expiresAt, 1000 + SCHEDULING_DRAFT_TTL_MS);
});
test('rascunho expirado, corrompido ou de outra versão é removido', () => {
  schedulingStorage.save({ servicoId: '2' }, 1000);
  assert.equal(schedulingStorage.read(1000 + SCHEDULING_DRAFT_TTL_MS), null);
  window.sessionStorage.setItem(SCHEDULING_STORAGE_KEY, '{');
  assert.equal(schedulingStorage.read(), null);
  window.sessionStorage.setItem(
    SCHEDULING_STORAGE_KEY,
    JSON.stringify({ version: 2, expiresAt: Date.now() + 1000, data: {} }),
  );
  assert.equal(schedulingStorage.read(), null);
});
test('tipos, campos sensíveis e limpeza explícita são controlados', () => {
  assert.equal(schedulingStorage.save({ servicoId: 2 }), false);
  assert.equal(schedulingStorage.save({ servicoId: '2', token: 'segredo' }), false);
  assert.equal(window.sessionStorage.length, 0);
  schedulingStorage.save({ servicoId: '2' });
  schedulingStorage.clear();
  assert.equal(schedulingStorage.read(), null);
});
