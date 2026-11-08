/**
 * Week Load and Overtime Calculation Utilities
 *
 * Computes scheduled hours and overtime status for caregivers across a week.
 * Client-side aggregation matching backend overtime rules.
 */

import type { Visit } from '../types/index.js';

export type WeekStartsOn = 0 | 1;

/** Default week start is Sunday (0), matching FLSA/backend overtime workweeks */
export const DEFAULT_WEEK_START: WeekStartsOn = 0;

export interface OvertimeThresholdConfig {
  weeklyThreshold: number;
  warningThreshold: number;
}

/** Default overtime config: 40h weekly overtime threshold, 35h warning threshold */
export const DEFAULT_OVERTIME_CONFIG: OvertimeThresholdConfig = {
  weeklyThreshold: 40,
  warningThreshold: 35,
};

export type OvertimeStatus = 'NORMAL' | 'WARNING' | 'OVERTIME';

export interface CaregiverInfo {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  skills?: string[];
  color?: string;
}

export interface CaregiverWeekLoad {
  caregiverId: string;
  caregiverName: string;
  totalHours: number;
  dailyHours: Record<string, number>;
  status: OvertimeStatus;
  thresholdConfig: OvertimeThresholdConfig;
}

/**
 * Pure date string parsing and formatting (avoiding toISOString() timezone bugs).
 * Parses "YYYY-MM-DD" into year, month (0-indexed), date numbers.
 */
export function parseISODateParts(dateStr: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) return null;
  return {
    year: parseInt(match[1]!, 10),
    month: parseInt(match[2]!, 10) - 1,
    day: parseInt(match[3]!, 10),
  };
}

/** Formats year, month (0-indexed), day into YYYY-MM-DD */
export function formatISODate(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Adds `days` to a "YYYY-MM-DD" string using pure calendar date math in local time.
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const parts = parseISODateParts(dateStr);
  if (!parts) {
    throw new Error(`Invalid date string: ${dateStr}`);
  }
  const date = new Date(parts.year, parts.month, parts.day);
  date.setDate(date.getDate() + days);
  return formatISODate(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Returns today's date formatted as YYYY-MM-DD in the target timezone (or local if none).
 */
export function getTodayDateString(timezone?: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone ?? undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(now);
  } catch {
    const now = new Date();
    return formatISODate(now.getFullYear(), now.getMonth(), now.getDate());
  }
}

/**
 * Given an anchor date (Date object or YYYY-MM-DD string), returns an array of 7 consecutive
 * YYYY-MM-DD strings starting from the week start day (0 = Sunday, 1 = Monday).
 */
export function getWeekRange(
  anchor: Date | string,
  weekStartsOn: WeekStartsOn = DEFAULT_WEEK_START
): string[] {
  let anchorDateStr: string;
  let year: number;
  let month: number;
  let day: number;

  if (typeof anchor === 'string') {
    const parts = parseISODateParts(anchor);
    if (!parts) {
      throw new Error(`Invalid date string: ${anchor}`);
    }
    anchorDateStr = anchor.slice(0, 10);
    year = parts.year;
    month = parts.month;
    day = parts.day;
  } else {
    year = anchor.getFullYear();
    month = anchor.getMonth();
    day = anchor.getDate();
    anchorDateStr = formatISODate(year, month, day);
  }

  // Create a Date object for finding day of week (0 = Sunday ... 6 = Saturday)
  const tempDate = new Date(year, month, day);
  const currentDayOfWeek = tempDate.getDay();

  // Calculate distance to start of week
  // If weekStartsOn === 0 (Sunday): diff = currentDayOfWeek - 0
  // If weekStartsOn === 1 (Monday): diff = (currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1)
  let diffDays: number;
  if (weekStartsOn === 0) {
    diffDays = currentDayOfWeek;
  } else {
    diffDays = (currentDayOfWeek + 6) % 7;
  }

  const startDateStr = addDaysToDateString(anchorDateStr, -diffDays);

  const week: string[] = [];
  for (let i = 0; i < 7; i++) {
    week.push(addDaysToDateString(startDateStr, i));
  }
  return week;
}

/**
 * Computes overtime status based on total scheduled hours and threshold config.
 * - OVERTIME: hours > weeklyThreshold
 * - WARNING: hours >= warningThreshold && hours <= weeklyThreshold
 * - NORMAL: hours < warningThreshold
 */
export function getOvertimeStatus(
  hours: number,
  config: OvertimeThresholdConfig = DEFAULT_OVERTIME_CONFIG
): OvertimeStatus {
  // Using a tiny epsilon for float comparisons
  if (hours > config.weeklyThreshold) {
    return 'OVERTIME';
  }
  if (hours >= config.warningThreshold) {
    return 'WARNING';
  }
  return 'NORMAL';
}

/**
 * Extracts "YYYY-MM-DD" from a visit's scheduledDate.
 */
function extractVisitDate(scheduledDate: Date | string): string {
  if (typeof scheduledDate === 'string') {
    return scheduledDate.slice(0, 10);
  }
  return formatISODate(
    scheduledDate.getFullYear(),
    scheduledDate.getMonth(),
    scheduledDate.getDate()
  );
}

/**
 * Pure aggregation computing weekly hours and overtime status for caregivers.
 *
 * Rules:
 * - Excludes CANCELLED and NO_SHOW_CLIENT visits.
 * - Only includes visits with assignedCaregiverId set.
 * - Hours are scheduledDuration / 60.
 * - Rounds totals to 2 decimal places.
 * - Includes all provided caregivers, even those with 0 hours.
 */
export function computeCaregiverWeekLoad(
  visits: Visit[],
  caregivers: CaregiverInfo[],
  weekDays: string[],
  thresholds: OvertimeThresholdConfig = DEFAULT_OVERTIME_CONFIG
): CaregiverWeekLoad[] {
  const weekSet = new Set(weekDays);

  // Map caregiverId -> daily hours { [date]: hours }
  const caregiverHours = new Map<string, Record<string, number>>();
  const caregiverTotal = new Map<string, number>();

  for (const cg of caregivers) {
    const daily: Record<string, number> = {};
    for (const d of weekDays) {
      daily[d] = 0;
    }
    caregiverHours.set(cg.id, daily);
    caregiverTotal.set(cg.id, 0);
  }

  for (const visit of visits) {
    if (!visit.assignedCaregiverId) continue;
    if (visit.status === 'CANCELLED' || visit.status === 'NO_SHOW_CLIENT') continue;

    const dateStr = extractVisitDate(visit.scheduledDate);
    if (!weekSet.has(dateStr)) continue;

    const cgId = visit.assignedCaregiverId;
    let daily = caregiverHours.get(cgId);
    if (!daily) {
      daily = {};
      for (const d of weekDays) daily[d] = 0;
      caregiverHours.set(cgId, daily);
      caregiverTotal.set(cgId, 0);
    }

    const durationMinutes = visit.scheduledDuration || 0;
    const hours = durationMinutes / 60;

    daily[dateStr] = (daily[dateStr] ?? 0) + hours;
    caregiverTotal.set(cgId, (caregiverTotal.get(cgId) ?? 0) + hours);
  }

  const results: CaregiverWeekLoad[] = [];

  for (const cg of caregivers) {
    const dailyRaw = caregiverHours.get(cg.id) ?? {};
    const totalRaw = caregiverTotal.get(cg.id) ?? 0;

    const dailyRounded: Record<string, number> = {};
    for (const d of weekDays) {
      dailyRounded[d] = Math.round((dailyRaw[d] ?? 0) * 100) / 100;
    }
    const totalRounded = Math.round(totalRaw * 100) / 100;

    results.push({
      caregiverId: cg.id,
      caregiverName: cg.name || `${cg.firstName ?? ''} ${cg.lastName ?? ''}`.trim() || 'Caregiver',
      totalHours: totalRounded,
      dailyHours: dailyRounded,
      status: getOvertimeStatus(totalRounded, thresholds),
      thresholdConfig: thresholds,
    });
  }

  return results;
}
