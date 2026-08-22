import assert from 'node:assert/strict';
import test from 'node:test';
import { BLOCK_INTERVAL_MINUTES, createInitialBlockPeriod } from '../src/utils/blockDateTime.js';

test('novo bloqueio inicia no próximo intervalo futuro já usado pela agenda', () => {
  const period = createInitialBlockPeriod(new Date(2026, 7, 14, 12, 13, 40));

  assert.equal(BLOCK_INTERVAL_MINUTES, 15);
  assert.deepEqual(period, {
    inicioLocal: '2026-08-14T12:15',
    fimLocal: '2026-08-14T12:30',
  });
});

test('novo bloqueio avança para outro intervalo quando aberto no limite exato', () => {
  assert.deepEqual(createInitialBlockPeriod(new Date(2026, 7, 14, 12, 15, 0)), {
    inicioLocal: '2026-08-14T12:30',
    fimLocal: '2026-08-14T12:45',
  });
});

test('novo bloqueio preserva data e hora locais ao atravessar o dia', () => {
  assert.deepEqual(createInitialBlockPeriod(new Date(2026, 7, 14, 23, 59, 30)), {
    inicioLocal: '2026-08-15T00:00',
    fimLocal: '2026-08-15T00:15',
  });
});
