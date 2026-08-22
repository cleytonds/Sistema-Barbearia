import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateCommission,
  assertCommissionPercentage,
} from '../src/domain/commissions/rules.js';

test('calcula comissão monetária sem ponto flutuante e arredonda em duas casas', () => {
  assert.equal(calculateCommission('40.00', '50.00'), '20.00');
  assert.equal(calculateCommission('0.05', '50.00'), '0.03');
  assert.equal(calculateCommission('99.99', '33.33'), '33.33');
});

test('percentual aceita limites e rejeita valores inválidos', () => {
  assert.doesNotThrow(() => assertCommissionPercentage('0.00'));
  assert.doesNotThrow(() => assertCommissionPercentage('100.00'));
  assert.throws(() => assertCommissionPercentage('100.01'), {
    code: 'INVALID_COMMISSION_PERCENTAGE',
  });
  for (const value of ['-1', '10.123', 'abc'])
    assert.throws(() => assertCommissionPercentage(value), { code: 'INVALID_COMMISSION_VALUE' });
});
