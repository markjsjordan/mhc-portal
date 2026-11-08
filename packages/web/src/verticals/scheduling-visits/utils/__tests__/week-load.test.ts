import { describe, test, expect } from 'vitest';
import {
  getWeekRange,
  computeCaregiverWeekLoad,
  getOvertimeStatus,
  addDaysToDateString,
  getTodayDateString,
  DEFAULT_WEEK_START,
  DEFAULT_OVERTIME_CONFIG,
  type CaregiverInfo,
} from '../week-load.js';
import type { Visit } from '../../types/index.js';

describe('week-load utilities', () => {
  describe('getWeekRange', () => {
    test('computes Sunday-start week by default for a Wednesday anchor', () => {
      // 2026-11-11 is a Wednesday
      const range = getWeekRange('2026-11-11');
      expect(range).toEqual([
        '2026-11-08', // Sunday
        '2026-11-09', // Monday
        '2026-11-10', // Tuesday
        '2026-11-11', // Wednesday
        '2026-11-12', // Thursday
        '2026-11-13', // Friday
        '2026-11-14', // Saturday
      ]);
    });

    test('computes Sunday-start week when anchor is already Sunday', () => {
      // 2026-11-08 is a Sunday
      const range = getWeekRange('2026-11-08', DEFAULT_WEEK_START);
      expect(range[0]).toBe('2026-11-08');
      expect(range[6]).toBe('2026-11-14');
    });

    test('computes Sunday-start week when anchor is Saturday', () => {
      // 2026-11-14 is a Saturday
      const range = getWeekRange('2026-11-14', 0);
      expect(range[0]).toBe('2026-11-08');
      expect(range[6]).toBe('2026-11-14');
    });

    test('computes Monday-start week when requested', () => {
      // 2026-11-11 is a Wednesday
      const range = getWeekRange('2026-11-11', 1);
      expect(range).toEqual([
        '2026-11-09', // Monday
        '2026-11-10', // Tuesday
        '2026-11-11', // Wednesday
        '2026-11-12', // Thursday
        '2026-11-13', // Friday
        '2026-11-14', // Saturday
        '2026-11-15', // Sunday
      ]);
    });

    test('works with Date object input using fixed date', () => {
      const fixedDate = new Date(2026, 10, 11); // Month 10 = November in 0-indexed JS Date
      const range = getWeekRange(fixedDate);
      expect(range[0]).toBe('2026-11-08');
      expect(range[6]).toBe('2026-11-14');
    });
  });

  describe('addDaysToDateString', () => {
    test('adds days across month and year boundaries correctly', () => {
      expect(addDaysToDateString('2026-11-30', 1)).toBe('2026-12-01');
      expect(addDaysToDateString('2026-12-31', 1)).toBe('2027-01-01');
      expect(addDaysToDateString('2026-03-01', -1)).toBe('2026-02-28');
    });
  });

  describe('getOvertimeStatus', () => {
    test('returns NORMAL below warning threshold', () => {
      expect(getOvertimeStatus(0)).toBe('NORMAL');
      expect(getOvertimeStatus(34.9)).toBe('NORMAL');
    });

    test('returns WARNING at or above warning threshold (35h) and below or equal to weekly (40h)', () => {
      expect(getOvertimeStatus(35)).toBe('WARNING');
      expect(getOvertimeStatus(38.5)).toBe('WARNING');
      expect(getOvertimeStatus(40)).toBe('WARNING');
    });

    test('returns OVERTIME strictly above weekly threshold (40h)', () => {
      expect(getOvertimeStatus(40.1)).toBe('OVERTIME');
      expect(getOvertimeStatus(48)).toBe('OVERTIME');
    });

    test('respects custom threshold config', () => {
      const customConfig = { weeklyThreshold: 30, warningThreshold: 25 };
      expect(getOvertimeStatus(24, customConfig)).toBe('NORMAL');
      expect(getOvertimeStatus(25, customConfig)).toBe('WARNING');
      expect(getOvertimeStatus(30, customConfig)).toBe('WARNING');
      expect(getOvertimeStatus(30.5, customConfig)).toBe('OVERTIME');
    });
  });

  describe('computeCaregiverWeekLoad', () => {
    const weekDays = [
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
    ];

    const caregivers: CaregiverInfo[] = [
      { id: 'cg-1', name: 'Alice Walker' },
      { id: 'cg-2', name: 'Bob Stone' },
      { id: 'cg-3', name: 'Charlie Day' },
    ];

    const createVisit = (
      id: string,
      caregiverId: string | undefined,
      scheduledDate: string,
      durationMinutes: number,
      status: Visit['status'] = 'ASSIGNED'
    ): Visit =>
      ({
        id,
        organizationId: 'org-1',
        branchId: 'branch-1',
        clientId: 'client-1',
        visitNumber: `V-${id}`,
        visitType: 'REGULAR',
        serviceTypeId: 'svc-1',
        serviceTypeName: 'Personal Care',
        scheduledDate,
        scheduledStartTime: '09:00',
        scheduledEndTime: '17:00',
        scheduledDuration: durationMinutes,
        timezone: 'America/New_York',
        assignedCaregiverId: caregiverId,
        status,
        address: {
          line1: '123 Main St',
          city: 'Austin',
          state: 'TX',
          postalCode: '78701',
          country: 'USA',
        },
        isUrgent: false,
        isPriority: false,
        requiresSupervision: false,
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-01T00:00:00Z',
      } as Visit);

    test('includes caregivers with 0 hours', () => {
      const result = computeCaregiverWeekLoad([], caregivers, weekDays);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        caregiverId: 'cg-1',
        caregiverName: 'Alice Walker',
        totalHours: 0,
        dailyHours: {
          '2026-11-08': 0,
          '2026-11-09': 0,
          '2026-11-10': 0,
          '2026-11-11': 0,
          '2026-11-12': 0,
          '2026-11-13': 0,
          '2026-11-14': 0,
        },
        status: 'NORMAL',
        thresholdConfig: DEFAULT_OVERTIME_CONFIG,
      });
    });

    test('aggregates daily hours and calculates overtime correctly', () => {
      const visits: Visit[] = [
        // cg-1: 5 days * 8 hours = 40 hours -> WARNING
        createVisit('v1', 'cg-1', '2026-11-09', 480),
        createVisit('v2', 'cg-1', '2026-11-10', 480),
        createVisit('v3', 'cg-1', '2026-11-11', 480),
        createVisit('v4', 'cg-1', '2026-11-12', 480),
        createVisit('v5', 'cg-1', '2026-11-13', 480),

        // cg-2: 42 hours -> OVERTIME
        createVisit('v6', 'cg-2', '2026-11-09', 600), // 10h
        createVisit('v7', 'cg-2', '2026-11-10', 600), // 10h
        createVisit('v8', 'cg-2', '2026-11-11', 600), // 10h
        createVisit('v9', 'cg-2', '2026-11-12', 600), // 10h
        createVisit('v10', 'cg-2', '2026-11-13', 120), // 2h

        // cg-3: 15 hours -> NORMAL
        createVisit('v11', 'cg-3', '2026-11-09', 900), // 15h
      ];

      const result = computeCaregiverWeekLoad(visits, caregivers, weekDays);
      const cg1Load = result.find(r => r.caregiverId === 'cg-1')!;
      const cg2Load = result.find(r => r.caregiverId === 'cg-2')!;
      const cg3Load = result.find(r => r.caregiverId === 'cg-3')!;

      expect(cg1Load.totalHours).toBe(40);
      expect(cg1Load.status).toBe('WARNING');
      expect(cg1Load.dailyHours['2026-11-09']).toBe(8);

      expect(cg2Load.totalHours).toBe(42);
      expect(cg2Load.status).toBe('OVERTIME');

      expect(cg3Load.totalHours).toBe(15);
      expect(cg3Load.status).toBe('NORMAL');
    });

    test('excludes CANCELLED and NO_SHOW_CLIENT visits', () => {
      const visits: Visit[] = [
        createVisit('v1', 'cg-1', '2026-11-09', 480, 'CANCELLED'),
        createVisit('v2', 'cg-1', '2026-11-10', 480, 'NO_SHOW_CLIENT'),
        createVisit('v3', 'cg-1', '2026-11-11', 120, 'ASSIGNED'),
      ];

      const result = computeCaregiverWeekLoad(visits, caregivers, weekDays);
      const cg1Load = result.find(r => r.caregiverId === 'cg-1')!;
      expect(cg1Load.totalHours).toBe(2);
      expect(cg1Load.dailyHours['2026-11-09']).toBe(0);
      expect(cg1Load.dailyHours['2026-11-10']).toBe(0);
      expect(cg1Load.dailyHours['2026-11-11']).toBe(2);
    });

    test('ignores visits outside the requested week range', () => {
      const visits: Visit[] = [
        createVisit('v1', 'cg-1', '2026-11-01', 480, 'ASSIGNED'), // previous week
        createVisit('v2', 'cg-1', '2026-11-09', 240, 'ASSIGNED'), // in week
      ];

      const result = computeCaregiverWeekLoad(visits, caregivers, weekDays);
      const cg1Load = result.find(r => r.caregiverId === 'cg-1')!;
      expect(cg1Load.totalHours).toBe(4);
    });

    test('ignores visits with unassigned caregiver', () => {
      const visits: Visit[] = [
        createVisit('v1', undefined, '2026-11-09', 480, 'UNASSIGNED'),
      ];

      const result = computeCaregiverWeekLoad(visits, caregivers, weekDays);
      expect(result.every(r => r.totalHours === 0)).toBe(true);
    });
  });
});
