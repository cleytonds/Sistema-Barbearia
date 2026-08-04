import { DateTime } from 'luxon';

import { calculateBookingPeriod } from './bookingPeriod.js';
import { generateCandidateSlots } from './generateCandidateSlots.js';
import { filterUnavailableSlots } from './filterUnavailableSlots.js';
import { buildWorkingWindow } from './workingWindow.js';

function localMinuteToUtc(date, minute, timeZone) {
  const hour = Math.floor(minute / 60);
  const minutes = minute % 60;
  return DateTime.fromISO(date, { zone: timeZone })
    .set({ hour, minute: minutes, second: 0, millisecond: 0 })
    .toUTC()
    .toJSDate();
}

function formatLocalMinute(minute) {
  const hours = String(Math.floor(minute / 60)).padStart(2, '0');
  const minutes = String(minute % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Coordena as regras puras e produz horários públicos em tempo local. */
export function buildDailyAvailability({
  date,
  timeZone,
  businessHours,
  barberHours,
  durationMinutes,
  bufferMinutes,
  blocks,
  appointments,
  nowUtc,
}) {
  const workingWindow = buildWorkingWindow(businessHours, barberHours);
  if (!workingWindow) return [];

  const slots = generateCandidateSlots(workingWindow).map((startMinute) => {
    const startUtc = localMinuteToUtc(date, startMinute, timeZone);
    const bookingPeriod = calculateBookingPeriod({ startUtc, durationMinutes, bufferMinutes });
    return {
      ...bookingPeriod,
      startMinute,
      serviceEndMinute: startMinute + durationMinutes,
      occupiedUntilMinute: startMinute + durationMinutes + bufferMinutes,
    };
  });

  return filterUnavailableSlots({
    slots,
    workingWindow,
    blocks,
    appointments,
    nowUtc,
  }).map((slot) => ({
    inicioLocal: formatLocalMinute(slot.startMinute),
    fimLocal: formatLocalMinute(slot.serviceEndMinute),
  }));
}

export { formatLocalMinute, localMinuteToUtc };
