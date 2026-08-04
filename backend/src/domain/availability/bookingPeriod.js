/** Calcula o fim real do serviço e o fim técnico usado para conflitos. */
export function calculateBookingPeriod({ startUtc, durationMinutes, bufferMinutes }) {
  const serviceEndUtc = new Date(startUtc.getTime() + durationMinutes * 60_000);
  const occupiedUntilUtc = new Date(serviceEndUtc.getTime() + bufferMinutes * 60_000);
  return { startUtc, serviceEndUtc, occupiedUntilUtc, durationMinutes, bufferMinutes };
}
