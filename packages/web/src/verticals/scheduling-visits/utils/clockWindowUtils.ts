/**
 * Clock-window utilities for the Visit Clock In/Out feature.
 *
 * State-specific grace periods (TX: 10 min, FL: 15 min, default: 15 min)
 * are per EVV compliance requirements for the 21st Century Cures Act mandate.
 */

/** Grace period in minutes before/after scheduled start during which Clock In is allowed */
const GRACE_PERIOD_MINUTES: Record<string, number> = {
  TX: 10,
  FL: 15,
};
const DEFAULT_GRACE_PERIOD_MINUTES = 15;

export function getGracePeriodMinutes(state: string | undefined): number {
  if (!state) return DEFAULT_GRACE_PERIOD_MINUTES;
  return GRACE_PERIOD_MINUTES[state.toUpperCase()] ?? DEFAULT_GRACE_PERIOD_MINUTES;
}

/**
 * Returns true if the current wall-clock time falls within the allowed
 * clock-in window:
 *   [scheduledStart - gracePeriod, scheduledStart + gracePeriod]
 *
 * We accept clock-in up to gracePeriod before AND after the scheduled start
 * so that slightly-late arrivals are still within the EVV-compliant window.
 *
 * @param scheduledDate - Date string (YYYY-MM-DD) or Date object
 * @param scheduledStartTime - 24-hour HH:MM string
 * @param gracePeriodMinutes - Grace period in minutes (state-specific)
 * @param nowMs - Current epoch milliseconds (injectable for testing)
 */
export function isWithinClockInWindow(
  scheduledDate: Date | string,
  scheduledStartTime: string,
  gracePeriodMinutes: number,
  nowMs: number = Date.now()
): boolean {
  const dateStr =
    scheduledDate instanceof Date
      ? scheduledDate.toISOString().slice(0, 10)
      : String(scheduledDate).slice(0, 10);

  const parts = scheduledStartTime.split(':').map(Number);
  if (parts.length < 2 || parts.some((p) => Number.isNaN(p))) return false;
  const [hours, minutes] = parts;

  const scheduledStartMs = new Date(
    `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
  ).getTime();

  if (Number.isNaN(scheduledStartMs)) return false;

  const windowMs = gracePeriodMinutes * 60 * 1000;
  return nowMs >= scheduledStartMs - windowMs && nowMs <= scheduledStartMs + windowMs;
}
