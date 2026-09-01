import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateBookingPeriod } from '../src/domain/availability/bookingPeriod.js';
import {
  buildDailyAvailability,
  localMinuteToUtc,
} from '../src/domain/availability/buildDailyAvailability.js';
import { generateCandidateSlots } from '../src/domain/availability/generateCandidateSlots.js';
import { overlaps } from '../src/domain/availability/overlap.js';
import {
  buildWorkingWindow,
  crossesPause,
  fitsWorkingWindow,
  timeToMinutes,
} from '../src/domain/availability/workingWindow.js';
import {
  assertClientNextDayBookingDate,
  parseBookingDate,
} from '../src/services/disponibilidadeService.js';

const activeDay = {
  ativo: true,
  hora_inicio: '09:00:00',
  hora_fim: '18:00:00',
  intervalo_inicio: '12:00:00',
  intervalo_fim: '13:00:00',
};

test('TIME é convertido para minutos', () => {
  assert.equal(timeToMinutes('09:30:00'), 570);
});

test('intervalos semiabertos detectam sobreposição sem conflitar bordas encostadas', () => {
  assert.equal(overlaps({ start: 10, end: 20 }, { start: 15, end: 25 }), true);
  assert.equal(overlaps({ start: 10, end: 30 }, { start: 15, end: 20 }), true);
  assert.equal(overlaps({ start: 10, end: 20 }, { start: 20, end: 30 }), false);
});

test('período calcula fim do serviço e fim técnico', () => {
  const startUtc = new Date('2026-08-15T12:00:00.000Z');
  const result = calculateBookingPeriod({ startUtc, durationMinutes: 40, bufferMinutes: 10 });
  assert.equal(result.serviceEndUtc.toISOString(), '2026-08-15T12:40:00.000Z');
  assert.equal(result.occupiedUntilUtc.toISOString(), '2026-08-15T12:50:00.000Z');
});

test('janela efetiva é a interseção das jornadas e considera pausas', () => {
  const window = buildWorkingWindow(activeDay, {
    ...activeDay,
    hora_inicio: '10:00:00',
    hora_fim: '17:00:00',
    intervalo_inicio: '15:00:00',
    intervalo_fim: '15:30:00',
  });
  assert.deepEqual([window.startMinute, window.endMinute], [600, 1020]);
  assert.equal(fitsWorkingWindow({ start: 600, end: 660 }, window), true);
  assert.equal(fitsWorkingWindow({ start: 990, end: 1030 }, window), false);
  assert.equal(crossesPause({ start: 710, end: 730 }, window.pauses), true);
  assert.equal(crossesPause({ start: 840, end: 910 }, window.pauses), true);
});

test('candidatos usam passos de 15 minutos sem duplicação', () => {
  const slots = generateCandidateSlots({ startMinute: 540, endMinute: 600 });
  assert.deepEqual(slots, [540, 555, 570, 585]);
  assert.equal(new Set(slots).size, slots.length);
});

test('conversão America/Recife produz UTC e pode mudar o dia UTC', () => {
  assert.equal(
    localMinuteToUtc('2026-08-15', 540, 'America/Recife').toISOString(),
    '2026-08-15T12:00:00.000Z',
  );
  assert.equal(
    localMinuteToUtc('2026-08-15', 1_380, 'America/Recife').toISOString(),
    '2026-08-16T02:00:00.000Z',
  );
});

test('disponibilidade aplica antecedência, pausa, bloqueio e retorna ordem local', () => {
  const result = buildDailyAvailability({
    date: '2026-08-15',
    timeZone: 'America/Recife',
    businessHours: { ...activeDay, intervalo_inicio: null, intervalo_fim: null },
    barberHours: { ...activeDay, intervalo_inicio: null, intervalo_fim: null },
    durationMinutes: 30,
    bufferMinutes: 0,
    nowUtc: new Date('2026-08-15T11:20:00.000Z'),
    blocks: [
      { start: new Date('2026-08-15T12:30:00.000Z'), end: new Date('2026-08-15T13:00:00.000Z') },
    ],
    appointments: [],
  });
  assert.deepEqual(result.slice(0, 2), [
    { inicioLocal: '09:00', fimLocal: '09:30' },
    { inicioLocal: '10:00', fimLocal: '10:30' },
  ]);
  assert.deepEqual(
    result,
    [...result].sort((a, b) => a.inicioLocal.localeCompare(b.inicioLocal)),
  );
});

test('antecedência máxima é inclusiva quando comparada como datas civis', () => {
  const nowUtc = new Date('2026-08-01T12:00:00.000Z');
  assert.equal(
    parseBookingDate('2026-08-31', 'America/Recife', nowUtc, 30).toFormat('yyyy-MM-dd'),
    '2026-08-31',
  );
  assert.throws(
    () => parseBookingDate('2026-09-01', 'America/Recife', nowUtc, 30),
    (error) => error.code === 'BOOKING_DATE_OUT_OF_RANGE',
  );
});

test('cliente só agenda no próximo dia civil em America/Recife', () => {
  const nowUtc = new Date('2026-09-01T02:50:00.000Z');
  const zone = 'America/Recife';
  assert.equal(
    assertClientNextDayBookingDate('2026-09-01', zone, nowUtc).toFormat('yyyy-MM-dd'),
    '2026-09-01',
  );
  for (const date of ['2026-08-31', '2026-09-02', '2026-09-05']) {
    assert.throws(
      () => assertClientNextDayBookingDate(date, zone, nowUtc),
      (error) =>
        error.code === 'CLIENT_BOOKING_DATE_NOT_ALLOWED' ||
        error.code === 'BOOKING_DATE_OUT_OF_RANGE',
    );
  }
});

function availabilityAt({
  durationMinutes = 30,
  bufferMinutes = 0,
  blocks = [],
  appointments = [],
  nowUtc = new Date('2026-08-15T10:00:00.000Z'),
} = {}) {
  return buildDailyAvailability({
    date: '2026-08-15',
    timeZone: 'America/Recife',
    businessHours: activeDay,
    barberHours: activeDay,
    durationMinutes,
    bufferMinutes,
    blocks,
    appointments,
    nowUtc,
  });
}

test('slots podem terminar na pausa e começar quando a pausa termina', () => {
  const slots = availabilityAt();
  assert.equal(
    slots.some((slot) => slot.inicioLocal === '11:30'),
    true,
  );
  assert.equal(
    slots.some((slot) => slot.inicioLocal === '13:00'),
    true,
  );
});

test('serviço pode terminar no fechamento, mas fim técnico não pode ultrapassá-lo', () => {
  assert.equal(
    availabilityAt().some((slot) => slot.inicioLocal === '17:30'),
    true,
  );
  assert.equal(
    availabilityAt({ bufferMinutes: 10 }).some((slot) => slot.inicioLocal === '17:30'),
    false,
  );
});

test('buffers apenas encostados em agendamentos não conflitam', () => {
  const previousBuffer = {
    start: new Date('2026-08-15T12:00:00.000Z'),
    end: new Date('2026-08-15T13:00:00.000Z'),
  };
  const nextAppointment = {
    start: new Date('2026-08-15T13:40:00.000Z'),
    end: new Date('2026-08-15T14:10:00.000Z'),
  };
  const slots = availabilityAt({
    durationMinutes: 30,
    bufferMinutes: 10,
    appointments: [previousBuffer, nextAppointment],
  });
  assert.equal(
    slots.some((slot) => slot.inicioLocal === '10:00'),
    true,
  );
});

test('bloqueios apenas encostados antes ou depois do slot não conflitam', () => {
  const slots = availabilityAt({
    blocks: [
      {
        start: new Date('2026-08-15T12:30:00.000Z'),
        end: new Date('2026-08-15T13:00:00.000Z'),
      },
      {
        start: new Date('2026-08-15T13:30:00.000Z'),
        end: new Date('2026-08-15T14:00:00.000Z'),
      },
    ],
  });
  assert.equal(
    slots.some((slot) => slot.inicioLocal === '10:00'),
    true,
  );
});

test('horário exatamente no limite de 30 minutos é permitido', () => {
  const slots = availabilityAt({ nowUtc: new Date('2026-08-15T11:30:00.000Z') });
  assert.equal(
    slots.some((slot) => slot.inicioLocal === '09:00'),
    true,
  );
});
