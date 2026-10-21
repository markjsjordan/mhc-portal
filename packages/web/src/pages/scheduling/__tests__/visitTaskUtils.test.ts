import { describe, it, expect } from 'vitest';
import { deriveVisitTasks, formatTimeString } from '../visitTaskUtils';
import type { Visit } from '../../../verticals/scheduling-visits/types';

describe('visitTaskUtils', () => {
  describe('formatTimeString', () => {
    it('returns null for null, undefined, or empty values', () => {
      expect(formatTimeString(null)).toBeNull();
      expect(formatTimeString(undefined)).toBeNull();
      expect(formatTimeString('')).toBeNull();
    });

    it('preserves clean 12-hour and 24-hour time strings', () => {
      expect(formatTimeString('08:30 AM')).toBe('08:30 AM');
      expect(formatTimeString('14:45')).toBe('14:45');
    });

    it('formats ISO date strings and Date instances deterministically', () => {
      const date = new Date('2026-10-10T12:30:00.000Z');
      const formatted = formatTimeString(date);
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });
  });

  describe('deriveVisitTasks', () => {
    const baseVisit: Visit = {
      id: 'vis-1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      clientId: 'client-1',
      visitNumber: 'VST-1',
      visitType: 'REGULAR',
      serviceTypeId: 'svc-personal-care',
      serviceTypeName: 'Personal Care & Assistance',
      scheduledDate: '2026-10-25',
      scheduledStartTime: '08:30 AM',
      scheduledEndTime: '11:30 AM',
      scheduledDuration: 180,
      timezone: 'America/New_York',
      status: 'SCHEDULED',
      isUrgent: false,
      isPriority: false,
      requiresSupervision: false,
      address: {
        line1: '123 Main St',
        city: 'Portland',
        state: 'OR',
        postalCode: '97201',
        country: 'US',
      },
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    };

    it('derives Skilled Nursing tasks when service name contains nursing', () => {
      const nursingVisit: Visit = {
        ...baseVisit,
        serviceTypeId: 'svc-nursing',
        serviceTypeName: 'Skilled Nursing Assessment & Care',
        visitType: 'REGULAR',
      };

      const tasks = deriveVisitTasks(nursingVisit);
      expect(tasks.length).toBe(4);
      expect(tasks.some((t) => t.title.includes('vital signs'))).toBe(true);
      expect(tasks.some((t) => t.category === 'Clinical')).toBe(true);
      expect(tasks.every((t) => !t.completed)).toBe(true);
    });

    it('derives Initial Assessment tasks for INITIAL visit type', () => {
      const initialVisit: Visit = {
        ...baseVisit,
        visitType: 'INITIAL',
        serviceTypeName: 'Initial Intake',
      };

      const tasks = deriveVisitTasks(initialVisit);
      expect(tasks.length).toBe(4);
      expect(tasks.some((t) => t.title.includes('ADL & IADL'))).toBe(true);
      expect(tasks.some((t) => t.category === 'Assessment')).toBe(true);
    });

    it('derives Respite / Companion tasks for RESPITE visit type', () => {
      const respiteVisit: Visit = {
        ...baseVisit,
        visitType: 'RESPITE',
        serviceTypeName: 'Respite Care Support',
      };

      const tasks = deriveVisitTasks(respiteVisit);
      expect(tasks.length).toBe(4);
      expect(tasks.some((t) => t.category === 'Companionship')).toBe(true);
    });

    it('derives Personal Care tasks for default / Personal Care service', () => {
      const tasks = deriveVisitTasks(baseVisit);
      expect(tasks.length).toBe(4);
      expect(tasks[0]?.category).toBe('Personal Care');
      expect(tasks[0]?.title).toContain('morning shower');
    });

    it('marks all tasks completed when visit status is COMPLETED', () => {
      const completedVisit: Visit = {
        ...baseVisit,
        status: 'COMPLETED',
        actualEndTime: '11:28 AM',
      };

      const tasks = deriveVisitTasks(completedVisit);
      expect(tasks.every((t) => t.completed)).toBe(true);
      expect(tasks[0]?.completedAt).toBe('11:28 AM');
    });

    it('partially marks tasks completed based on tasksCompleted for IN_PROGRESS visit', () => {
      const inProgressVisit: Visit = {
        ...baseVisit,
        status: 'IN_PROGRESS',
        actualStartTime: '08:28 AM',
        tasksCompleted: 2,
      };

      const tasks = deriveVisitTasks(inProgressVisit);
      expect(tasks[0]?.completed).toBe(true);
      expect(tasks[1]?.completed).toBe(true);
      expect(tasks[2]?.completed).toBe(false);
      expect(tasks[3]?.completed).toBe(false);
    });

    it('uses embedded tasks when present on visit', () => {
      const visitWithTasks: any = {
        ...baseVisit,
        tasks: [
          { id: 'custom-1', title: 'Special physical therapy stretch', category: 'Therapy', completed: true, required: true },
          { id: 'custom-2', title: 'Hydration log check', category: 'Nutrition', completed: false, required: false },
        ],
      };

      const tasks = deriveVisitTasks(visitWithTasks);
      expect(tasks.length).toBe(2);
      expect(tasks[0]?.title).toBe('Special physical therapy stretch');
      expect(tasks[0]?.completed).toBe(true);
      expect(tasks[1]?.title).toBe('Hydration log check');
      expect(tasks[1]?.completed).toBe(false);
    });

    it('uses external task instances when provided', () => {
      const externalTasks = [
        { id: 'ext-1', name: 'External Care Plan Task', category: 'General', status: 'COMPLETED', requiredSignature: true },
      ];

      const tasks = deriveVisitTasks(baseVisit, externalTasks);
      expect(tasks.length).toBe(1);
      expect(tasks[0]?.title).toBe('External Care Plan Task');
      expect(tasks[0]?.completed).toBe(true);
      expect(tasks[0]?.required).toBe(true);
    });
  });
});
