import { MIN_BOOKING_NOTICE_MINUTES } from './constants.js';
import { overlapsAny } from './overlap.js';
import { crossesPause, fitsWorkingWindow } from './workingWindow.js';

/** Remove candidatos que não permanecem livres durante toda a ocupação técnica. */
export function filterUnavailableSlots({
  slots,
  workingWindow,
  blocks,
  appointments,
  nowUtc,
  minimumNoticeMinutes = MIN_BOOKING_NOTICE_MINUTES,
}) {
  const earliestStart = new Date(nowUtc.getTime() + minimumNoticeMinutes * 60_000);

  return slots.filter((slot) => {
    const localOccupation = { start: slot.startMinute, end: slot.occupiedUntilMinute };
    const utcOccupation = { start: slot.startUtc, end: slot.occupiedUntilUtc };
    return (
      slot.startUtc >= earliestStart &&
      fitsWorkingWindow(localOccupation, workingWindow) &&
      !crossesPause(localOccupation, workingWindow.pauses) &&
      !overlapsAny(utcOccupation, blocks) &&
      !overlapsAny(utcOccupation, appointments)
    );
  });
}
