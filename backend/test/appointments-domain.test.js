import assert from 'node:assert/strict';
import test from 'node:test';
import { clientAppointmentPermissions } from '../src/domain/appointments/clientPermissions.js';

test('permissões do cliente cobrem prazo e estados terminais', () => {
  const now = new Date('2030-01-01T10:00:00.000Z');
  const settings = { tempo_minimo_cancelamento_horas: 2 };
  for (const status of ['pendente', 'confirmado']) {
    assert.deepEqual(
      clientAppointmentPermissions(
        { status, inicio_em: new Date('2030-01-01T13:00:00.000Z') },
        settings,
        now,
      ),
      { podeCancelar: true, podeReagendar: true },
    );
  }
  assert.deepEqual(
    clientAppointmentPermissions(
      { status: 'pendente', inicio_em: new Date('2030-01-01T11:00:00.000Z') },
      settings,
      now,
    ),
    { podeCancelar: false, podeReagendar: false },
  );
  for (const status of ['cancelado', 'concluido', 'ausente', 'em_atendimento']) {
    assert.deepEqual(
      clientAppointmentPermissions(
        { status, inicio_em: new Date('2030-01-02T13:00:00.000Z') },
        settings,
        now,
      ),
      { podeCancelar: false, podeReagendar: false },
    );
  }
});

import {
  buildIdempotency,
  sameHash,
  validateIdempotencyKey,
} from '../src/domain/appointments/idempotency.js';
import { assertStatusTransition } from '../src/domain/appointments/statusMachine.js';
import { buildBookingSnapshot } from '../src/domain/appointments/snapshots.js';
import { assertClientCancellation } from '../src/domain/appointments/cancellationRules.js';
import { assertReschedule } from '../src/domain/appointments/rescheduleRules.js';

test('idempotência é determinística e sensível ao payload', () => {
  const base = {
    key: '12345678-1234-4234-9234-123456789012',
    operation: 'create-appointment',
    actorId: 1,
    clientId: 1,
    payload: { barbeiroId: 2, servicoId: 3, data: '2030-01-01', horaInicio: '10:00' },
  };
  const first = buildIdempotency(base);
  const repeated = buildIdempotency(base);
  const changed = buildIdempotency({ ...base, payload: { ...base.payload, barbeiroId: 4 } });
  assert.equal(sameHash(first.keyHash, repeated.keyHash), true);
  assert.equal(sameHash(first.payloadHash, repeated.payloadHash), true);
  assert.equal(sameHash(first.payloadHash, changed.payloadHash), false);
  assert.throws(() => validateIdempotencyKey('curta'), { code: 'IDEMPOTENCY_KEY_REQUIRED' });
});

test('snapshot preserva duração e buffer no fim real e técnico', () => {
  const startAt = new Date('2030-01-01T13:00:00.000Z');
  const snapshot = buildBookingSnapshot({
    startUtc: startAt,
    price: '40.00',
    durationMinutes: 40,
    bufferMinutes: 10,
  });
  assert.equal(snapshot.endAt.toISOString(), '2030-01-01T13:40:00.000Z');
  assert.equal(snapshot.occupiedUntilAt.toISOString(), '2030-01-01T13:50:00.000Z');
  assert.equal(snapshot.price, '40.00');
});

test('máquina de estados aplica estados terminais e regras temporais', () => {
  const startAt = new Date('2030-01-01T13:00:00.000Z');
  const before = new Date('2030-01-01T12:59:59.000Z');
  const atStart = new Date('2030-01-01T13:00:00.000Z');
  assert.throws(
    () =>
      assertStatusTransition({
        currentStatus: 'confirmado',
        nextStatus: 'em_atendimento',
        startAt,
        nowUtc: before,
      }),
    { code: 'BUSINESS_RULE_VIOLATION' },
  );
  assert.equal(
    assertStatusTransition({
      currentStatus: 'confirmado',
      nextStatus: 'em_atendimento',
      startAt,
      nowUtc: atStart,
    }),
    true,
  );
  assert.throws(
    () =>
      assertStatusTransition({
        currentStatus: 'concluido',
        nextStatus: 'confirmado',
        startAt,
        nowUtc: atStart,
      }),
    { code: 'INVALID_STATUS_TRANSITION' },
  );
  assert.throws(
    () =>
      assertStatusTransition({
        currentStatus: 'pendente',
        nextStatus: 'ausente',
        startAt,
        nowUtc: before,
      }),
    { code: 'BUSINESS_RULE_VIOLATION' },
  );
});

test('cancelamento aceita o limite exato e rejeita depois dele', () => {
  const appointment = { status: 'confirmado', inicio_em: new Date('2030-01-01T15:00:00Z') };
  assert.doesNotThrow(() =>
    assertClientCancellation({
      appointment,
      minimumHours: 2,
      nowUtc: new Date('2030-01-01T13:00:00Z'),
    }),
  );
  assert.throws(
    () =>
      assertClientCancellation({
        appointment,
        minimumHours: 2,
        nowUtc: new Date('2030-01-01T13:00:00.001Z'),
      }),
    { code: 'CANCELLATION_DEADLINE_PASSED' },
  );
});

test('reagendamento rejeita mesmo horário, prazo encerrado e estado inválido', () => {
  const appointment = { status: 'pendente', inicio_em: new Date('2030-01-01T15:00:00Z') };
  assert.throws(
    () =>
      assertReschedule({
        appointment,
        newStartAt: new Date('2030-01-01T15:00:00Z'),
        minimumHours: 2,
        nowUtc: new Date('2030-01-01T12:00:00Z'),
        isAdmin: false,
      }),
    { code: 'BUSINESS_RULE_VIOLATION' },
  );
  assert.throws(
    () =>
      assertReschedule({
        appointment,
        newStartAt: new Date('2030-01-01T16:00:00Z'),
        minimumHours: 2,
        nowUtc: new Date('2030-01-01T13:00:00.001Z'),
        isAdmin: false,
      }),
    { code: 'RESCHEDULE_DEADLINE_PASSED' },
  );
});
