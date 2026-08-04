import { calculateBookingPeriod } from '../availability/bookingPeriod.js';

/** Calcula os três instantes persistidos a partir dos valores efetivamente validados. */
export function buildBookingSnapshot({ startUtc, price, durationMinutes, bufferMinutes }) {
  const period = calculateBookingPeriod({ startUtc, durationMinutes, bufferMinutes });
  return {
    price: Number(price).toFixed(2),
    durationMinutes: Number(durationMinutes),
    bufferMinutes: Number(bufferMinutes),
    startAt: new Date(startUtc),
    endAt: period.serviceEndUtc,
    occupiedUntilAt: period.occupiedUntilUtc,
  };
}
