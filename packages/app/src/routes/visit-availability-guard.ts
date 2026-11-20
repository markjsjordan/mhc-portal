/**
 * Visit assignment availability guard helpers.
 *
 * Validates that a caregiver's resolved weekly availability overlaps the
 * visit's scheduled time window before an assignment is accepted.
 */

import type { UserContext } from '@folkcare/core';
import { CaregiverAvailabilityService } from '@folkcare/caregiver-staff';
import type { Database } from '@folkcare/core';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

type DayKey = (typeof DAY_KEYS)[number];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Normalize a pg DATE value (Date or string) to YYYY-MM-DD.
 */
export function toDateString(value: Date | string): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  // pg parses DATE columns as local midnight; fall back to UTC for UTC-midnight values
  if (value.getHours() === 0 && value.getMinutes() === 0) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  return value.toISOString().slice(0, 10);
}

/**
 * Day-of-week key (matching WeeklyAvailability) for a YYYY-MM-DD date.
 */
export function getDayKey(date: string): DayKey {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return DAY_KEYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]!;
}

/**
 * ISO Monday (YYYY-MM-DD) of the week containing the given YYYY-MM-DD date.
 */
export function getWeekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  const offset = (dt.getUTCDay() + 6) % 7; // Monday=0 ... Sunday=6
  dt.setUTCDate(dt.getUTCDate() - offset);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/**
 * HH:MM[:SS] strings compare lexicographically; true when windows overlap.
 */
export function isTimeInSlot(startTime: string, endTime: string, slotStart: string, slotEnd: string): boolean {
  return startTime < slotEnd && endTime > slotStart;
}

/**
 * Returns false only when the caregiver has a schedule configured for the week
 * and no slot on the visit's day overlaps the visit window. Caregivers with no
 * schedule at all are treated as unrestricted (fail-open).
 */
export async function isCaregiverAvailableForVisit(
  database: Database,
  caregiverId: string,
  visit: { scheduled_date: Date | string; scheduled_start_time: string; scheduled_end_time: string },
  context: UserContext
): Promise<boolean> {
  const visitDate = toDateString(visit.scheduled_date);
  const resolved = await new CaregiverAvailabilityService(database).getAvailability(
    caregiverId,
    getWeekStart(visitDate),
    context
  );

  const schedule = (resolved?.schedule ?? {}) as Record<string, { available?: boolean; timeSlots?: { startTime: string; endTime: string }[] } | undefined>;
  const hasAnySchedule = Object.values(schedule).some(
    (day) => day?.available === true && (day.timeSlots?.length ?? 0) > 0
  );
  if (!hasAnySchedule) {
    return true;
  }

  const day = schedule[getDayKey(visitDate)];
  if (day?.available !== true) {
    return false;
  }
  const start = visit.scheduled_start_time.slice(0, 5);
  const end = visit.scheduled_end_time.slice(0, 5);
  return (day.timeSlots ?? []).some((slot) => isTimeInSlot(start, end, slot.startTime, slot.endTime));
}
