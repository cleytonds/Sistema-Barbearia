import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isCoveredByCurrentPlan,
  planCancellationMessage,
  PLAN_CANCELLATION_NOTICE,
} from '../src/utils/appointmentPlanPolicy.js';

const subscription = {
  status: 'ativa',
  usoStatus: 'permitido',
  inicioEm: '2026-08-01',
  fimEm: '2026-08-31',
  servicos: [{ id: '10' }],
  barbeiros: [{ id: '20' }],
};

test('aviso prévio aparece somente quando a seleção é coberta pelo plano', () => {
  assert.equal(
    isCoveredByCurrentPlan(subscription, {
      data: '2026-08-11',
      servicoId: '10',
      barbeiroId: '20',
    }),
    true,
  );
  assert.equal(
    isCoveredByCurrentPlan(subscription, {
      data: '2026-08-11',
      servicoId: '99',
      barbeiroId: '20',
    }),
    false,
  );
  assert.match(PLAN_CANCELLATION_NOTICE, /pelo menos 2 horas/);
});

test('mensagem de cancelamento usa o prazo absoluto e ignora agendamento avulso', () => {
  const appointment = {
    tipoCobranca: 'plano',
    cancelamentoPlano: { prazoEm: '2026-08-11T15:00:00.000Z' },
  };
  assert.equal(
    planCancellationMessage(appointment, new Date('2026-08-11T15:00:00.000Z')),
    'Sua utilização será devolvida',
  );
  assert.equal(
    planCancellationMessage(appointment, new Date('2026-08-11T15:00:00.001Z')),
    'Este cancelamento será contabilizado como utilização',
  );
  assert.equal(planCancellationMessage({ ...appointment, tipoCobranca: 'avulso' }), null);
});
