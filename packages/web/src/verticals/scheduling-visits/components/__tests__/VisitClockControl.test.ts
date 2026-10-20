/**
 * Tests for VisitClockControl grace-period logic.
 *
 * Uses deterministic fixed timestamps per the project's test conventions
 * (no new Date() in test code — all time references are constants).
 */

import { describe, it, expect } from 'vitest';
import { isWithinClockInWindow } from '../../utils/clockWindowUtils.js';

// ---------------------------------------------------------------------------
// Fixed reference timestamps — 2027-06-15T10:00:00 UTC (avoid stale-date issues)
// ---------------------------------------------------------------------------

/** A Monday morning: scheduled start at 10:00 local */
const SCHEDULED_DATE = '2027-06-15';
const SCHEDULED_START = '10:00';

/** The exact scheduled start time as UTC-ish epoch (assumes local ≈ UTC for these tests) */
function makeEpochAt(dateStr: string, timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime();
}

const SCHEDULED_START_MS = makeEpochAt(SCHEDULED_DATE, SCHEDULED_START);

describe('isWithinClockInWindow', () => {
  // ---- Default grace period (15 min) ----

  it('returns true at exactly the scheduled start time', () => {
    expect(
      isWithinClockInWindow(SCHEDULED_DATE, SCHEDULED_START, 15, SCHEDULED_START_MS)
    ).toBe(true);
  });

  it('returns true 14 minutes before scheduled start (within 15-min window)', () => {
    const fourteenMinBefore = SCHEDULED_START_MS - 14 * 60 * 1000;
    expect(
      isWithinClockInWindow(SCHEDULED_DATE, SCHEDULED_START, 15, fourteenMinBefore)
    ).toBe(true);
  });

  it('returns true 15 minutes before scheduled start (edge of window)', () => {
    const fifteenMinBefore = SCHEDULED_START_MS - 15 * 60 * 1000;
    expect(
      isWithinClockInWindow(SCHEDULED_DATE, SCHEDULED_START, 15, fifteenMinBefore)
    ).toBe(true);
  });

  it('returns false 16 minutes before scheduled start (outside window)', () => {
    const sixteenMinBefore = SCHEDULED_START_MS - 16 * 60 * 1000;
    expect(
      isWithinClockInWindow(SCHEDULED_DATE, SCHEDULED_START, 15, sixteenMinBefore)
    ).toBe(false);
  });

  it('returns true 15 minutes after scheduled start (within grace)', () => {
    const fifteenMinAfter = SCHEDULED_START_MS + 15 * 60 * 1000;
    expect(
      isWithinClockInWindow(SCHEDULED_DATE, SCHEDULED_START, 15, fifteenMinAfter)
    ).toBe(true);
  });

  it('returns false 16 minutes after scheduled start (outside grace)', () => {
    const sixteenMinAfter = SCHEDULED_START_MS + 16 * 60 * 1000;
    expect(
      isWithinClockInWindow(SCHEDULED_DATE, SCHEDULED_START, 15, sixteenMinAfter)
    ).toBe(false);
  });

  // ---- TX: 10-minute grace period ----

  it('TX: returns true 10 minutes before scheduled start', () => {
    const tenMinBefore = SCHEDULED_START_MS - 10 * 60 * 1000;
    expect(
      isWithinClockInWindow(SCHEDULED_DATE, SCHEDULED_START, 10, tenMinBefore)
    ).toBe(true);
  });

  it('TX: returns false 11 minutes before scheduled start', () => {
    const elevenMinBefore = SCHEDULED_START_MS - 11 * 60 * 1000;
    expect(
      isWithinClockInWindow(SCHEDULED_DATE, SCHEDULED_START, 10, elevenMinBefore)
    ).toBe(false);
  });

  // ---- Date object as scheduledDate (not just string) ----

  it('accepts a Date object as scheduledDate', () => {
    const dateObj = new Date(`${SCHEDULED_DATE}T00:00:00`);
    expect(
      isWithinClockInWindow(dateObj, SCHEDULED_START, 15, SCHEDULED_START_MS)
    ).toBe(true);
  });

  // ---- Edge cases ----

  it('returns false for malformed start time', () => {
    expect(
      isWithinClockInWindow(SCHEDULED_DATE, 'not-a-time', 15, SCHEDULED_START_MS)
    ).toBe(false);
  });

  it('returns false for zero grace period when not at exact start', () => {
    const oneMinAfter = SCHEDULED_START_MS + 60 * 1000;
    expect(
      isWithinClockInWindow(SCHEDULED_DATE, SCHEDULED_START, 0, oneMinAfter)
    ).toBe(false);
  });

  it('returns true for zero grace period at exactly the scheduled start', () => {
    expect(
      isWithinClockInWindow(SCHEDULED_DATE, SCHEDULED_START, 0, SCHEDULED_START_MS)
    ).toBe(true);
  });
});
