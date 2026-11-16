import { describe, it, expect } from 'vitest';
import { formatCalendarDate, formatDate, parseDateOnly, toDateKey } from '../formatters';

describe('date-only formatters', () => {
  it('parseDateOnly constructs local calendar Date without UTC day-shift', () => {
    const fromPlain = parseDateOnly('2026-12-03');
    expect(fromPlain.getFullYear()).toBe(2026);
    expect(fromPlain.getMonth()).toBe(11);
    expect(fromPlain.getDate()).toBe(3);

    const fromIso = parseDateOnly('2026-12-03T00:00:00.000Z');
    expect(fromIso.getFullYear()).toBe(2026);
    expect(fromIso.getMonth()).toBe(11);
    expect(fromIso.getDate()).toBe(3);

    const fromDate = parseDateOnly(new Date('2026-12-03T00:00:00.000Z'));
    expect(fromDate.getFullYear()).toBe(2026);
    expect(fromDate.getMonth()).toBe(11);
    expect(fromDate.getDate()).toBe(3);
  });

  it('formatCalendarDate formats YYYY-MM-DD, ISO midnight UTC, and Date identically', () => {
    expect(formatCalendarDate('2026-12-03')).toBe('Dec 3, 2026');
    expect(formatCalendarDate('2026-12-03T00:00:00.000Z')).toBe('Dec 3, 2026');
    expect(formatCalendarDate(new Date('2026-12-03T00:00:00.000Z'))).toBe('Dec 3, 2026');

    const longOpts: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    };
    expect(formatCalendarDate('2026-12-03', longOpts)).toBe('Thursday, Dec 3, 2026');
    expect(formatCalendarDate('2026-12-03T00:00:00.000Z', longOpts)).toBe('Thursday, Dec 3, 2026');
    expect(formatCalendarDate(null)).toBe('—');
    expect(formatCalendarDate(undefined)).toBe('—');
  });

  it('toDateKey extracts YYYY-MM-DD from string or Date', () => {
    expect(toDateKey('2026-12-03')).toBe('2026-12-03');
    expect(toDateKey('2026-12-03T00:00:00.000Z')).toBe('2026-12-03');
    expect(toDateKey(new Date('2026-12-03T00:00:00.000Z'))).toBe('2026-12-03');
  });

  it('formatDate handles plain YYYY-MM-DD without UTC day-shift', () => {
    expect(formatDate('2026-12-03')).toBe('Dec 3, 2026');
  });
});
