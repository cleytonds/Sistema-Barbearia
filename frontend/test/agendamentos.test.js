import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { api } from '../src/api/client.js';
import { useCriarAgendamento } from '../src/hooks/useCriarAgendamento.js';
import { agendamentoService } from '../src/services/agendamentoService.js';
import { createIdempotencyKey } from '../src/utils/idempotencyKey.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const originalAdapter = api.defaults.adapter;
let renderer;
let state;
function Probe() {
  state = useCriarAgendamento();
  return null;
}
const response = (config, data, headers = {}) => ({
  data,
  status: 200,
  statusText: 'OK',
  headers,
  config,
});

test.afterEach(async () => {
  api.defaults.adapter = originalAdapter;
  if (renderer) await act(async () => renderer.unmount());
  renderer = null;
  state = null;
});

test('gera chaves seguras e distintas', () => {
  const first = createIdempotencyKey();
  const second = createIdempotencyKey();
  assert.ok(first.length >= 16);
  assert.notEqual(first, second);
});

test('service envia chave, reconhece replay e normaliza conflito', async () => {
  let config;
  api.defaults.adapter = async (received) => {
    config = received;
    return response(received, { data: { id: '1' } }, { 'idempotent-replayed': 'true' });
  };
  const result = await agendamentoService.criar({
    data: { barbeiroId: '2' },
    idempotencyKey: '12345678-1234-4234-9234-123456789012',
  });
  assert.equal(config.url, '/agendamentos');
  assert.equal(config.headers['Idempotency-Key'], '12345678-1234-4234-9234-123456789012');
  assert.equal(result.replayed, true);
  api.defaults.adapter = async () =>
    Promise.reject({
      response: {
        data: {
          error: {
            code: 'AVAILABILITY_CHANGED',
            message: 'Este horário não está mais disponível.',
          },
        },
      },
    });
  await assert.rejects(
    () =>
      agendamentoService.criar({
        data: {},
        idempotencyKey: '12345678-1234-4234-9234-123456789012',
      }),
    { code: 'AVAILABILITY_CHANGED' },
  );
});

test('hook bloqueia clique duplo e apresenta loading e success', async () => {
  let resolveRequest;
  let calls = 0;
  api.defaults.adapter = (config) => {
    calls += 1;
    return new Promise((resolve) => {
      resolveRequest = () => resolve(response(config, { data: { id: '1' } }));
    });
  };
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Probe));
  });
  let first;
  let second;
  await act(async () => {
    first = state.criar({});
    second = state.criar({});
    await Promise.resolve();
  });
  assert.equal(calls, 1);
  assert.equal(await second, null);
  assert.equal(state.loading, true);
  await act(async () => {
    resolveRequest();
    await first;
  });
  assert.equal(state.loading, false);
  assert.equal(state.success.data.id, '1');
});

test('retry da mesma tentativa reutiliza a chave e nova tentativa gera outra', async () => {
  const keys = [];
  let calls = 0;
  api.defaults.adapter = async (config) => {
    keys.push(config.headers['Idempotency-Key']);
    calls += 1;
    if (calls === 1)
      throw { response: { data: { error: { code: 'NETWORK_ERROR', message: 'Falha' } } } };
    return response(config, { data: { id: String(calls) } });
  };
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Probe));
  });
  await act(async () => {
    await assert.rejects(() => state.criar({ barbeiroId: 1 }));
  });
  await act(async () => {
    await state.criar({ barbeiroId: 1 });
  });
  assert.equal(keys[0], keys[1]);
  await act(async () => {
    state.novaTentativa();
    await state.criar({ barbeiroId: 1 });
  });
  assert.notEqual(keys[1], keys[2]);
});
