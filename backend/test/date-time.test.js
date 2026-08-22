import assert from 'node:assert/strict';
import test from 'node:test';
import { DateTime } from 'luxon';
import { isBeforeCurrentLocalMinute, localToUtc } from '../src/utils/dateTime.js';

test('localToUtc aceita datetime-local com minutos sem deslocar o horário civil', () => {
  const value = '2026-08-14T11:58';
  const utc = localToUtc(value, 'America/Recife');

  assert.equal(utc.toISOString(), '2026-08-14T14:58:00.000Z');
  assert.equal(
    DateTime.fromJSDate(utc, { zone: 'America/Recife' }).toFormat("yyyy-MM-dd'T'HH:mm"),
    value,
  );
});

test('localToUtc preserva o contrato existente com segundos', () => {
  assert.equal(
    localToUtc('2026-08-14T11:58:00', 'America/Recife').toISOString(),
    '2026-08-14T14:58:00.000Z',
  );
});

test('localToUtc rejeita texto formatado para exibição local', () => {
  assert.throws(
    () => localToUtc('14/08/2026, 11:58', 'America/Recife'),
    (error) => error.statusCode === 422 && error.code === 'VALIDATION_ERROR',
  );
});

test('comparação temporal aceita o minuto local atual apesar dos segundos', () => {
  const start = localToUtc('2026-08-14T12:13', 'America/Recife');
  const now = new Date('2026-08-14T15:13:59.999Z');

  assert.equal(isBeforeCurrentLocalMinute(start, 'America/Recife', now), false);
});

test('comparação temporal rejeita um minuto local realmente passado', () => {
  const start = localToUtc('2026-08-14T12:12', 'America/Recife');
  const now = new Date('2026-08-14T15:13:00.000Z');

  assert.equal(isBeforeCurrentLocalMinute(start, 'America/Recife', now), true);
});
