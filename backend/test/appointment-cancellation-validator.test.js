import assert from 'node:assert/strict';
import test from 'node:test';
import { validationResult } from 'express-validator';

import { cancelAppointmentValidator } from '../src/validators/agendamentoValidators.js';

async function validate(body) {
  const request = { body, params: { id: '1' } };
  for (const validator of cancelAppointmentValidator) await validator.run(request);
  return validationResult(request);
}

test('cancelamento do cliente aceita motivo ausente, vazio, nulo ou preenchido', async () => {
  for (const body of [{}, { motivo: '' }, { motivo: null }, { motivo: 'Mudança de planos' }]) {
    assert.equal((await validate(body)).isEmpty(), true);
  }
});

test('cancelamento do cliente mantém validação do ID e do contrato', async () => {
  const invalidIdRequest = { body: {}, params: { id: 'invalido' } };
  for (const validator of cancelAppointmentValidator) await validator.run(invalidIdRequest);
  assert.equal(validationResult(invalidIdRequest).isEmpty(), false);
  assert.equal((await validate({ responsabilidade: 'barbearia' })).isEmpty(), false);
});
