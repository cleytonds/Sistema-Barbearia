export const BLOCK_INTERVAL_MINUTES = 15;

function toLocalDateTimeValue(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function createInitialBlockPeriod(now = new Date()) {
  const start = new Date(now);
  start.setSeconds(0, 0);
  start.setMinutes(
    start.getMinutes() + (BLOCK_INTERVAL_MINUTES - (start.getMinutes() % BLOCK_INTERVAL_MINUTES)),
  );
  const end = new Date(start.getTime() + BLOCK_INTERVAL_MINUTES * 60_000);

  return {
    inicioLocal: toLocalDateTimeValue(start),
    fimLocal: toLocalDateTimeValue(end),
  };
}
