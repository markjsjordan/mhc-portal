/**
 * Unit tests for CaregiverAvailabilityService
 *
 * Deterministic tests with injected Clock covering:
 * - Cutoff at exactly 24h, 24h minus 1 ms, 24h plus 1 ms
 * - DST-week timezone case
 * - Past-week rejection
 * - Block on partial coverage
 * - Exact fit allowed
 * - Cancelled visit does not block
 * - Version mismatch
 * - Slot validation
 * - EVV tables not written (compliance boundary assertion)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CaregiverAvailabilityService,
  Clock,
  AvailabilityCutoffError,
  AvailabilityConflictError,
  VersionMismatchError,
} from '../service/caregiver-availability-service.js';
import type { Database, UserContext } from '@folkcare/core';
import { ValidationError } from '@folkcare/core';
import type { WeeklyAvailability } from '../types/caregiver.js';

class MockClock implements Clock {
  constructor(private currentTime: Date) {}
  now(): Date {
    return this.currentTime;
  }
  setTime(time: Date): void {
    this.currentTime = time;
  }
}

describe('CaregiverAvailabilityService', () => {
  let mockDb: Database;
  let mockClock: MockClock;
  let service: CaregiverAvailabilityService;
  let context: UserContext;

  const validSchedule: WeeklyAvailability = {
    monday: {
      available: true,
      timeSlots: [{ startTime: '09:00', endTime: '17:00' }],
    },
    tuesday: {
      available: true,
      timeSlots: [{ startTime: '09:00', endTime: '17:00' }],
    },
    wednesday: { available: false },
    thursday: { available: false },
    friday: { available: false },
    saturday: { available: false },
    sunday: { available: false },
  };

  const TEST_CAREGIVER_ID = '11111111-1111-4111-8111-111111111123';

  const mockCaregiver = {
    id: TEST_CAREGIVER_ID,
    organization_id: 'org-456',
    user_id: 'user-789',
    timezone: 'America/New_York',
    version: 1,
    availability: {
      schedule: validSchedule,
      lastUpdated: new Date('2026-01-01T00:00:00Z'),
    },
    status: 'ACTIVE',
  };

  beforeEach(() => {
    mockClock = new MockClock(new Date('2026-11-01T00:00:00Z'));
    mockDb = {
      query: vi.fn(),
      transaction: vi.fn().mockImplementation(async (cb) => {
        return await cb(mockDb);
      }),
      healthCheck: vi.fn(),
      close: vi.fn(),
    } as unknown as Database;

    service = new CaregiverAvailabilityService(mockDb, mockClock);

    context = {
      userId: 'user-789',
      organizationId: 'org-456',
      branchIds: ['branch-1'],
      roles: ['CAREGIVER'],
      permissions: ['availability:update-own', 'availability:read-own'],
    };
  });

  describe('Slot Validation', () => {
    it('rejects invalid HH:MM format', () => {
      const invalid = {
        ...validSchedule,
        monday: {
          available: true,
          timeSlots: [{ startTime: '9:00', endTime: '17:00' }],
        },
      };
      expect(() => service.validateSchedule(invalid)).toThrow(ValidationError);
    });

    it('rejects when startTime >= endTime', () => {
      const invalid = {
        ...validSchedule,
        monday: {
          available: true,
          timeSlots: [{ startTime: '17:00', endTime: '09:00' }],
        },
      };
      expect(() => service.validateSchedule(invalid)).toThrow(ValidationError);
    });

    it('rejects overlapping slots on the same day', () => {
      const invalid = {
        ...validSchedule,
        monday: {
          available: true,
          timeSlots: [
            { startTime: '08:00', endTime: '12:00' },
            { startTime: '11:30', endTime: '15:00' },
          ],
        },
      };
      expect(() => service.validateSchedule(invalid)).toThrow(ValidationError);
    });

    it('rejects available: false with defined timeSlots', () => {
      const invalid = {
        ...validSchedule,
        monday: {
          available: false,
          timeSlots: [{ startTime: '09:00', endTime: '17:00' }],
        },
      };
      expect(() => service.validateSchedule(invalid)).toThrow(ValidationError);
    });

    it('rejects non-Monday weekStart', () => {
      // 2026-11-03 is Tuesday
      expect(() => service.validateWeekStart('2026-11-03')).toThrow(ValidationError);
      // 2026-11-02 is Monday
      expect(() => service.validateWeekStart('2026-11-02')).not.toThrow();
    });
  });

  describe('Cutoff Logic', () => {
    // For weekStart 2026-11-02 in America/New_York (UTC-5):
    // 00:00:00 local is 2026-11-02T05:00:00.000Z.
    // 24 hours prior is 2026-11-01T05:00:00.000Z.
    const cutoffMs = new Date('2026-11-01T05:00:00.000Z').getTime();

    it('rejects save when now is exactly at 24h cutoff', async () => {
      mockClock.setTime(new Date(cutoffMs));

      vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
        if (sql.includes('FROM caregivers WHERE id = $1')) {
          return { rows: [mockCaregiver] } as any;
        }
        return { rows: [] } as any;
      });

      await expect(
        service.saveAvailabilityOverride(
          TEST_CAREGIVER_ID,
          { weekStart: '2026-11-02', schedule: validSchedule, expectedVersion: 1 },
          context
        )
      ).rejects.toThrow(AvailabilityCutoffError);
    });

    it('rejects save when now is 24h plus 1 ms (after cutoff)', async () => {
      mockClock.setTime(new Date(cutoffMs + 1));

      vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
        if (sql.includes('FROM caregivers WHERE id = $1')) {
          return { rows: [mockCaregiver] } as any;
        }
        return { rows: [] } as any;
      });

      await expect(
        service.saveAvailabilityOverride(
          TEST_CAREGIVER_ID,
          { weekStart: '2026-11-02', schedule: validSchedule, expectedVersion: 1 },
          context
        )
      ).rejects.toThrow(AvailabilityCutoffError);
    });

    it('allows save when now is 24h minus 1 ms (before cutoff)', async () => {
      mockClock.setTime(new Date(cutoffMs - 1));

      vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
        if (sql.includes('FROM caregivers WHERE id = $1')) {
          return { rows: [mockCaregiver] } as any;
        }
        if (sql.includes('FROM visits')) {
          return { rows: [] } as any; // No booked visits
        }
        if (sql.includes('FROM caregiver_availability_overrides')) {
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      const res = await service.saveAvailabilityOverride(
        TEST_CAREGIVER_ID,
        { weekStart: '2026-11-02', schedule: validSchedule, expectedVersion: 1 },
        context
      );

      expect(res.version).toBe(2);
      expect(res.schedule).toEqual(validSchedule);
    });

    it('rejects past weeks as cutoff passed', async () => {
      // Current time is in 2026-11-15, weekStart is 2026-10-05
      mockClock.setTime(new Date('2026-11-15T00:00:00Z'));

      vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
        if (sql.includes('FROM caregivers WHERE id = $1')) {
          return { rows: [mockCaregiver] } as any;
        }
        return { rows: [] } as any;
      });

      await expect(
        service.saveAvailabilityOverride(
          TEST_CAREGIVER_ID,
          { weekStart: '2026-10-05', schedule: validSchedule, expectedVersion: 1 },
          context
        )
      ).rejects.toThrow(AvailabilityCutoffError);
    });
  });

  describe('DST-Week Timezone Case', () => {
    it('properly calculates cutoff across DST transition', () => {
      // In the US, DST ended on Sunday Nov 1, 2026.
      // Monday Nov 2, 2026 is standard time (UTC-5 in NY).
      const instantNY = service.getWeekStartInstant('2026-11-02', 'America/New_York');
      expect(instantNY.toISOString()).toBe('2026-11-02T05:00:00.000Z');

      // Spring forward week: March 9, 2026 (DST began March 8, 2026)
      // Monday March 9 is UTC-4 in NY.
      const instantSpringNY = service.getWeekStartInstant('2026-03-09', 'America/New_York');
      expect(instantSpringNY.toISOString()).toBe('2026-03-09T04:00:00.000Z');
    });
  });

  describe('Conflict Detection with Booked Visits', () => {
    beforeEach(() => {
      // Set clock well before cutoff
      mockClock.setTime(new Date('2026-10-01T00:00:00Z'));
    });

    it('allows save when visit is an exact fit within proposed slot', async () => {
      const mockVisit = {
        id: 'visit-1',
        scheduled_date: '2026-11-02',
        scheduled_start_time: '09:00:00',
        scheduled_end_time: '17:00:00',
        timezone: 'America/New_York',
        status: 'SCHEDULED',
      };

      vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
        if (sql.includes('FROM caregivers WHERE id = $1')) {
          return { rows: [mockCaregiver] } as any;
        }
        if (sql.includes('FROM visits')) {
          return { rows: [mockVisit] } as any;
        }
        if (sql.includes('FROM caregiver_availability_overrides')) {
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      const res = await service.saveAvailabilityOverride(
        TEST_CAREGIVER_ID,
        { weekStart: '2026-11-02', schedule: validSchedule, expectedVersion: 1 },
        context
      );
      expect(res.version).toBe(2);
    });

    it('blocks save (409 AVAILABILITY_CONFLICT_BOOKED_VISITS) on partial coverage', async () => {
      // Visit runs 08:30 to 12:00, but caregiver slot starts at 09:00
      const mockVisit = {
        id: 'visit-conflict',
        scheduled_date: '2026-11-02',
        scheduled_start_time: '08:30:00',
        scheduled_end_time: '12:00:00',
        timezone: 'America/New_York',
        status: 'SCHEDULED',
      };

      vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
        if (sql.includes('FROM caregivers WHERE id = $1')) {
          return { rows: [mockCaregiver] } as any;
        }
        if (sql.includes('FROM visits')) {
          return { rows: [mockVisit] } as any;
        }
        return { rows: [] } as any;
      });

      try {
        await service.saveAvailabilityOverride(
          TEST_CAREGIVER_ID,
          { weekStart: '2026-11-02', schedule: validSchedule, expectedVersion: 1 },
          context
        );
        expect.unreachable('Should have thrown AvailabilityConflictError');
      } catch (err) {
        expect(err).toBeInstanceOf(AvailabilityConflictError);
        const conflictErr = err as AvailabilityConflictError;
        expect(conflictErr.code).toBe('AVAILABILITY_CONFLICT_BOOKED_VISITS');
        expect(conflictErr.conflicts).toHaveLength(1);
        expect(conflictErr.conflicts[0]!.visitId).toBe('visit-conflict');
        expect(conflictErr.conflicts[0]!.start).toBe('08:30');
        expect(conflictErr.conflicts[0]!.end).toBe('12:00');
        // Ensure no client names in conflict
        expect((conflictErr.conflicts[0] as any).clientName).toBeUndefined();
      }
    });

    it('does NOT block when conflicting visit is CANCELLED', async () => {
      // Cancelled visits are filtered out
      vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
        if (sql.includes('FROM caregivers WHERE id = $1')) {
          return { rows: [mockCaregiver] } as any;
        }
        if (sql.includes('FROM visits')) {
          expect(sql).toContain("NOT IN ('CANCELLED'");
          return { rows: [] } as any; // Query excludes cancelled visits
        }
        if (sql.includes('FROM caregiver_availability_overrides')) {
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      const res = await service.saveAvailabilityOverride(
        TEST_CAREGIVER_ID,
        { weekStart: '2026-11-02', schedule: validSchedule, expectedVersion: 1 },
        context
      );
      expect(res.version).toBe(2);
    });
  });

  describe('Optimistic Lock and Version Mismatch', () => {
    it('throws VersionMismatchError on stale write', async () => {
      mockClock.setTime(new Date('2026-10-01T00:00:00Z'));

      vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
        if (sql.includes('FROM caregivers WHERE id = $1')) {
          return { rows: [{ ...mockCaregiver, version: 3 }] } as any;
        }
        if (sql.includes('FROM visits')) {
          return { rows: [] } as any;
        }
        if (sql.includes('FROM caregiver_availability_overrides')) {
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      await expect(
        service.saveAvailabilityOverride(
          TEST_CAREGIVER_ID,
          { weekStart: '2026-11-02', schedule: validSchedule, expectedVersion: 1 },
          context
        )
      ).rejects.toThrow(VersionMismatchError);
    });
  });

  describe('Compliance Boundary Assertions', () => {
    it('asserts no writes to evv_*, visits.actual_*, or timesheet tables', async () => {
      mockClock.setTime(new Date('2026-10-01T00:00:00Z'));

      const executedQueries: string[] = [];
      vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
        executedQueries.push(sql);
        if (sql.includes('FROM caregivers WHERE id = $1')) {
          return { rows: [mockCaregiver] } as any;
        }
        if (sql.includes('FROM visits')) {
          return { rows: [] } as any;
        }
        if (sql.includes('FROM caregiver_availability_overrides')) {
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      await service.saveAvailabilityOverride(
        TEST_CAREGIVER_ID,
        { weekStart: '2026-11-02', schedule: validSchedule, expectedVersion: 1 },
        context
      );

      for (const query of executedQueries) {
        const lower = query.toLowerCase();
        expect(lower).not.toContain('evv_');
        expect(lower).not.toContain('actual_');
        expect(lower).not.toContain('timesheet');
      }
    });
  });
});
