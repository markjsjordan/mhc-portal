import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import type { Database } from '@folkcare/core';
import { VisitProvider } from './visit-provider.js';

const getVisitById = vi.hoisted(() => vi.fn());

vi.mock('../repository/schedule-repository', () => ({
  ScheduleRepository: class {
    getVisitById = getVisitById;
  },
}));

vi.mock('@folkcare/time-tracking-evv', () => ({
  createClientProvider: vi.fn().mockReturnValue({}),
}));

const FIXED_NOW = new Date('2026-03-10T15:00:00.000Z');

const makeVisit = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'visit-1',
  assignedCaregiverId: 'cg-1',
  status: 'ASSIGNED',
  scheduledDate: new Date('2026-03-10T00:00:00.000Z'),
  ...overrides,
});

describe('VisitProvider.canClockIn', () => {
  let provider: VisitProvider;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    getVisitById.mockReset();
    provider = new VisitProvider({} as Pool, {} as Database);
  });

  it.each(['SCHEDULED', 'ASSIGNED', 'CONFIRMED', 'EN_ROUTE', 'ARRIVED'])(
    'allows clock-in from %s',
    async (status) => {
      getVisitById.mockResolvedValue(makeVisit({ status }));
      await expect(provider.canClockIn('visit-1', 'cg-1')).resolves.toBe(true);
    }
  );

  it('rejects completed visits', async () => {
    getVisitById.mockResolvedValue(makeVisit({ status: 'COMPLETED' }));
    await expect(provider.canClockIn('visit-1', 'cg-1')).rejects.toThrow(/visit status is COMPLETED/);
  });

  it('rejects future-dated visits without supervisor override', async () => {
    getVisitById.mockResolvedValue(
      makeVisit({ scheduledDate: new Date('2026-03-20T00:00:00.000Z') })
    );
    await expect(provider.canClockIn('visit-1', 'cg-1')).rejects.toThrow(/future date/);
  });

  it('allows future-dated visits with supervisor override', async () => {
    getVisitById.mockResolvedValue(
      makeVisit({ scheduledDate: new Date('2026-03-20T00:00:00.000Z') })
    );
    await expect(
      provider.canClockIn('visit-1', 'cg-1', { supervisorOverride: true })
    ).resolves.toBe(true);
  });

  it('still requires the caregiver to match the assignment', async () => {
    getVisitById.mockResolvedValue(makeVisit());
    await expect(
      provider.canClockIn('visit-1', 'other', { supervisorOverride: true })
    ).rejects.toThrow(/not assigned to this caregiver/);
  });
});
