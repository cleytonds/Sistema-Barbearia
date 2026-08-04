import assert from 'node:assert/strict';
import test from 'node:test';

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { api } from '../src/api/client.js';
import { useDisponibilidade } from '../src/hooks/useDisponibilidade.js';
import { getDisponibilidade } from '../src/services/disponibilidadeService.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const originalAdapter = api.defaults.adapter;
let renderer;
let latestState;

function response(config, data) {
  return { data, status: 200, statusText: 'OK', headers: {}, config };
}

function createDeferredAdapter() {
  const requests = [];
  const adapter = (config) =>
    new Promise((resolve, reject) => {
      requests.push({ config, resolve: (data) => resolve(response(config, data)), reject });
    });
  return { adapter, requests };
}

function Probe(props) {
  latestState = useDisponibilidade(props);
  return null;
}

async function renderHook(props) {
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Probe, props));
  });
}

async function updateHook(props) {
  await act(async () => {
    renderer.update(React.createElement(Probe, props));
  });
}

async function resolveRequest(request, data) {
  await act(async () => {
    request.resolve(data);
    await Promise.resolve();
  });
}

test.afterEach(async () => {
  api.defaults.adapter = originalAdapter;
  if (renderer) {
    await act(async () => renderer.unmount());
    renderer = null;
  }
  latestState = undefined;
});

test('service usa Axios existente, parâmetros e AbortSignal', async () => {
  let receivedConfig;
  api.defaults.adapter = async (config) => {
    receivedConfig = config;
    return response(config, { data: '2026-08-15', horarios: [] });
  };
  const controller = new AbortController();
  const result = await getDisponibilidade({
    barbeiroId: 2,
    servicoId: 4,
    data: '2026-08-15',
    signal: controller.signal,
  });

  assert.equal(receivedConfig.baseURL, api.defaults.baseURL);
  assert.equal(receivedConfig.url, '/disponibilidade');
  assert.deepEqual(receivedConfig.params, {
    barbeiroId: 2,
    servicoId: 4,
    data: '2026-08-15',
  });
  assert.equal(receivedConfig.signal, controller.signal);
  assert.equal(result.data, '2026-08-15');
  assert.equal('inicioUtc' in result, false);
});

test('hook inicia loading e preenche disponibilidade ao concluir', async () => {
  const mock = createDeferredAdapter();
  api.defaults.adapter = mock.adapter;
  await renderHook({ barbeiroId: 2, servicoId: 4, data: '2026-08-15' });

  assert.equal(latestState.loading, true);
  assert.equal(mock.requests.length, 1);
  await resolveRequest(mock.requests[0], { data: '2026-08-15', horarios: [] });
  assert.equal(latestState.loading, false);
  assert.equal(latestState.disponibilidade.data, '2026-08-15');
  assert.equal(latestState.error, null);
});

test('erro da API é normalizado para apresentação', async () => {
  api.defaults.adapter = async () =>
    Promise.reject({
      response: { data: { error: { code: 'VALIDATION_ERROR', message: 'Data inválida.' } } },
    });
  await renderHook({ barbeiroId: 2, servicoId: 4, data: '2026-08-15' });
  await act(async () => Promise.resolve());

  assert.equal(latestState.loading, false);
  assert.deepEqual(latestState.error, {
    code: 'VALIDATION_ERROR',
    message: 'Data inválida.',
    details: [],
    fieldErrors: {},
  });
});

test('service normaliza erro da API sem armazenar estado global', async () => {
  api.defaults.adapter = async () =>
    Promise.reject({
      response: { data: { error: { code: 'SERVICE_NOT_FOUND', message: 'Serviço ausente.' } } },
    });
  await assert.rejects(
    () =>
      getDisponibilidade({
        barbeiroId: 2,
        servicoId: 999,
        data: '2026-08-15',
        signal: new AbortController().signal,
      }),
    (error) =>
      error.code === 'SERVICE_NOT_FOUND' &&
      error.message === 'Serviço ausente.' &&
      Array.isArray(error.details),
  );
});

test('cancelamento não é apresentado como erro visual', async () => {
  const mock = createDeferredAdapter();
  api.defaults.adapter = mock.adapter;
  await renderHook({ barbeiroId: 2, servicoId: 4, data: '2026-08-15' });
  await updateHook({ barbeiroId: 2, servicoId: 4, data: '2026-08-16' });

  assert.equal(mock.requests[0].config.signal.aborted, true);
  assert.equal(latestState.error, null);
  await resolveRequest(mock.requests[1], { data: '2026-08-16', horarios: [] });
  assert.equal(latestState.error, null);
});

for (const field of ['data', 'barbeiroId', 'servicoId']) {
  test(`troca rápida de ${field} cancela a consulta anterior`, async () => {
    const mock = createDeferredAdapter();
    api.defaults.adapter = mock.adapter;
    const initial = { barbeiroId: 2, servicoId: 4, data: '2026-08-15' };
    const next = {
      ...initial,
      [field]: field === 'data' ? '2026-08-16' : initial[field] + 1,
    };
    await renderHook(initial);
    await updateHook(next);

    assert.equal(mock.requests.length, 2);
    assert.equal(mock.requests[0].config.signal.aborted, true);
    assert.equal(mock.requests[1].config.params[field], next[field]);
  });
}

test('resposta antiga não substitui a consulta mais recente', async () => {
  const mock = createDeferredAdapter();
  api.defaults.adapter = mock.adapter;
  await renderHook({ barbeiroId: 2, servicoId: 4, data: '2026-08-15' });
  await updateHook({ barbeiroId: 2, servicoId: 4, data: '2026-08-16' });

  await resolveRequest(mock.requests[1], { data: '2026-08-16', horarios: [] });
  mock.requests[0].resolve({ data: '2026-08-15', horarios: [{ inicioLocal: '09:00' }] });
  await act(async () => Promise.resolve());
  assert.equal(latestState.disponibilidade.data, '2026-08-16');
});

test('reload repete somente a consulta atual', async () => {
  const mock = createDeferredAdapter();
  api.defaults.adapter = mock.adapter;
  await renderHook({ barbeiroId: 3, servicoId: 5, data: '2026-08-17' });
  await resolveRequest(mock.requests[0], { data: '2026-08-17', horarios: [] });

  await act(async () => {
    void latestState.reload();
    await Promise.resolve();
  });
  assert.equal(mock.requests.length, 2);
  assert.deepEqual(mock.requests[1].config.params, {
    barbeiroId: 3,
    servicoId: 5,
    data: '2026-08-17',
  });
  await resolveRequest(mock.requests[1], { data: '2026-08-17', horarios: [] });
});

test('parâmetros obrigatórios ausentes não disparam consulta', async () => {
  let calls = 0;
  api.defaults.adapter = async (config) => {
    calls += 1;
    return response(config, {});
  };
  await renderHook({ barbeiroId: null, servicoId: 4, data: '2026-08-15' });
  assert.equal(calls, 0);
  assert.equal(latestState.loading, false);
  assert.equal(latestState.disponibilidade, null);
});

test('cleanup do hook aborta requisição pendente', async () => {
  const mock = createDeferredAdapter();
  api.defaults.adapter = mock.adapter;
  await renderHook({ barbeiroId: 2, servicoId: 4, data: '2026-08-15' });
  const signal = mock.requests[0].config.signal;
  await act(async () => renderer.unmount());
  renderer = null;
  assert.equal(signal.aborted, true);
});
