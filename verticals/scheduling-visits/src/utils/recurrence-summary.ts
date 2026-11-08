import type { DayOfWeek, Frequency } from '../types/schedule.js';

const DAY_ABBR: Record<DayOfWeek, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
};

const DAY_ORDER: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

/**
 * Builds human-readable recurrence summary
 * e.g. "Weekly Mon/Wed/Fri 09:00–13:00"
 */
export function buildRecurrenceSummary(params: {
  frequency?: Frequency | string;
  dayOfWeek?: DayOfWeek[];
  startTime: string;
  duration: number; // in minutes
}): string {
  const freqStr = params.frequency
    ? params.frequency.charAt(0).toUpperCase() + params.frequency.slice(1).toLowerCase()
    : 'Weekly';

  const days = (params.dayOfWeek ?? [])
    .slice()
    .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
    .map((d) => DAY_ABBR[d] || d);

  const daysPart = days.length > 0 ? ` ${days.join('/')}` : '';

  // Calculate end time
  const [startH, startM] = (params.startTime || '00:00').split(':').map(Number);
  const totalMin = (startH ?? 0) * 60 + (startM ?? 0) + (params.duration ?? 0);
  const endH = Math.floor(totalMin / 60) % 24;
  const endM = totalMin % 60;
  const endTimeStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

  const timePart = ` ${params.startTime}–${endTimeStr}`;

  return `${freqStr}${daysPart}${timePart}`;
}
