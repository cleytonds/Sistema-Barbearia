import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { api } from '../src/api/client.js';
import { useAssinarPlano } from '../src/hooks/useAssinarPlano.js';
import { useCancelarPlano } from '../src/hooks/useCancelarPlano.js';
import { adminPlanoService, planoService } from '../src/services/planoService.js';
import {
  remainingUsage,
  remainingWeekly,
  subscriptionStatus,
  usageCount,
  usageStatus,
  usoStatus,
} from '../src/utils/planStatus.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const originalAdapter = api.defaults.adapter;
let renderer;
let state;
function SignProbe() {
  state = useAssinarPlano();
  return null;
}
function CancelProbe() {
  state = useCancelarPlano();
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

// ===========================================================================
// planoService — rotas e cabeçalhos
// ===========================================================================
test('planoService expõe as rotas públicas e admin esperadas', async () => {
  const calls = [];
  api.defaults.adapter = async (config) => {
    calls.push(`${config.method.toUpperCase()} ${config.url}`);
    if (config.url.startsWith('/planos/')) return response(config, { id: '1' });
    if (config.url === '/meu-plano') return response(config, { status: 'ativa' });
    if (config.url === '/meu-plano/usos') return response(config, { data: [] });
    if (config.url === '/meu-plano/cancelar') return response(config, { ok: true });
    if (config.url === '/admin/planos') return response(config, { data: [] });
    if (config.url === '/admin/assinaturas') return response(config, { data: [] });
    return response(config, { data: [{ id: 1 }] });
  };

  await planoService.listPublic({ sort: 'preco' });
  await planoService.getPublic(7);
  await planoService.myPlan();
  await planoService.myUsages();
  await planoService.cancelOwn('motivo');
  await adminPlanoService.listPlanos({});
  await adminPlanoService.listAssinaturas({});

  assert.ok(calls.includes('GET /planos'));
  assert.ok(calls.includes('GET /planos/7'));
  assert.ok(calls.includes('GET /meu-plano'));
  assert.ok(calls.includes('GET /meu-plano/usos'));
  assert.ok(calls.includes('POST /meu-plano/cancelar'));
  assert.ok(calls.includes('GET /admin/planos'));
  assert.ok(calls.includes('GET /admin/assinaturas'));
});

test('planoService.assinar envia Idempotency-Key e trata replay', async () => {
  let config;
  api.defaults.adapter = async (received) => {
    config = received;
    return response(
      received,
      { status: 'aguardando_pagamento' },
      { 'idempotent-replayed': 'true' },
    );
  };
  const result = await planoService.sign(3, { clienteId: 1 }, 'mine-key');
  assert.equal(config.url, '/planos/3/assinar');
  assert.equal(config.headers['Idempotency-Key'], 'mine-key');
  assert.equal(result.status, 'aguardando_pagamento');
});

test('planoService propaga erro de assinatura', async () => {
  api.defaults.adapter = async () =>
    Promise.reject({
      response: { data: { error: { code: 'PLANO_INDISPONIVEL', message: 'Plano indisponível.' } } },
    });
  await assert.rejects(
    () => planoService.sign(3, {}, 'k'),
    (err) => err.response?.data?.error?.code === 'PLANO_INDISPONIVEL',
  );
});

// ===========================================================================
// useAssinarPlano — idempotência e loading
// ===========================================================================
test('useAssinarPlano gera chave própria quando não informada', async () => {
  let sentKey;
  api.defaults.adapter = async (config) => {
    sentKey = config.headers['Idempotency-Key'];
    return response(config, { status: 'ativa' });
  };
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(SignProbe));
  });
  await act(async () => {
    await state.assinar(1, {});
  });
  assert.ok(sentKey.length >= 16);
  assert.equal(state.success.status, 'ativa');
  assert.equal(state.loading, false);
});

test('useAssinarPlano bloqueia clique duplo durante a execução', async () => {
  let calls = 0;
  let resolveRequest;
  api.defaults.adapter = (config) => {
    calls += 1;
    return new Promise((resolve) => {
      resolveRequest = () => resolve(response(config, { ok: true }));
    });
  };
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(SignProbe));
  });
  let first;
  let second;
  await act(async () => {
    first = state.assinar(1, {});
    second = state.assinar(1, {});
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
});

test('useAssinarPlano expõe erro sem reutilizar a chave entre tentativas distintas', async () => {
  const keys = [];
  let calls = 0;
  api.defaults.adapter = async (config) => {
    keys.push(config.headers['Idempotency-Key']);
    calls += 1;
    if (calls === 1)
      throw { response: { data: { error: { code: 'NETWORK_ERROR', message: 'Falha' } } } };
    return response(config, { ok: true });
  };
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(SignProbe));
  });
  await act(async () => {
    await assert.rejects(() => state.assinar(1, {}));
  });
  assert.ok(state.error);
  await act(async () => {
    await state.assinar(1, {});
  });
  assert.equal(state.error, null);
  assert.notEqual(keys[0], keys[1]);
});

// ===========================================================================
// useCancelarPlano
// ===========================================================================
test('useCancelarPlano envia motivo e expõe sucesso', async () => {
  let sent;
  api.defaults.adapter = async (config) => {
    sent = JSON.parse(config.data);
    return response(config, { ok: true });
  };
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(CancelProbe));
  });
  await act(async () => {
    await state.cancelar('Motivo do cancelamento');
  });
  assert.equal(sent.motivo, 'Motivo do cancelamento');
  assert.equal(state.success.ok, true);
  assert.equal(state.loading, false);
});

test('useCancelarPlano bloqueia duplo clique', async () => {
  let calls = 0;
  let resolveRequest;
  api.defaults.adapter = (config) => {
    calls += 1;
    return new Promise((resolve) => {
      resolveRequest = () => resolve(response(config, { ok: true }));
    });
  };
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(CancelProbe));
  });
  let first;
  let second;
  await act(async () => {
    first = state.cancelar('motivo');
    second = state.cancelar('motivo');
    await Promise.resolve();
  });
  assert.equal(calls, 1);
  assert.equal(await second, null);
  await act(async () => {
    resolveRequest();
    await first;
  });
  assert.equal(state.loading, false);
});

// ===========================================================================
// planStatus — estados, cobertura e saldos
// ===========================================================================
test('planStatus mapeia estados de assinatura, uso e cobrança', () => {
  assert.equal(subscriptionStatus('ativa').label, 'Ativa');
  assert.equal(subscriptionStatus('cancelada').label, 'Cancelada');
  assert.equal(subscriptionStatus('desconhecido').label, 'desconhecido');
  assert.equal(usageStatus('consumido').label, 'Consumido');
  assert.equal(usageStatus('reservado').label, 'Reservado');
  assert.equal(usoStatus('suspenso').label, 'Suspenso');
  assert.equal(usoStatus('permitido').label, 'Permitido');
});

test('usageCount conta apenas reservado/consumido', () => {
  assert.equal(
    usageCount([{ status: 'reservado' }, { status: 'consumido' }, { status: 'liberado' }]),
    2,
  );
  assert.equal(usageCount([]), 0);
});

test('remainingUsage respeita limite total ou retorna nulo', () => {
  const usos = [{ status: 'reservado' }, { status: 'consumido' }, { status: 'liberado' }];
  assert.equal(remainingUsage({ possuiLimiteTotal: true, limiteTotal: 8, usos }), 6);
  assert.equal(remainingUsage({ possuiLimiteTotal: false, limiteTotal: null, usos }), null);
});

test('remainingWeekly conta apenas a semana informada', () => {
  const usos = [
    { semana_inicio: '2026-08-03', status: 'reservado' },
    { semana_inicio: '2026-08-03', status: 'consumido' },
    { semana_inicio: '2026-08-03', status: 'liberado' },
    { semana_inicio: '2026-08-10', status: 'consumido' },
  ];
  assert.equal(
    remainingWeekly({
      possuiLimiteSemanal: true,
      limiteSemanal: 2,
      usos,
      semanaInicio: '2026-08-03',
    }),
    0,
  );
  assert.equal(
    remainingWeekly({
      possuiLimiteSemanal: false,
      limiteSemanal: null,
      usos,
      semanaInicio: '2026-08-03',
    }),
    null,
  );
});
