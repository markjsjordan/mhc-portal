import { describe, it, expect } from 'vitest';
import { buildCreateCarePlanPayload } from './build-create-care-plan-payload.js';

const base = {
  clientId: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  name: 'Plan',
  planType: 'PERSONAL_CARE' as const,
  effectiveDate: '2025-01-01',
};

describe('buildCreateCarePlanPayload', () => {
  it('omits blank optional UUID/date/text fields that the backend rejects', () => {
    const payload = buildCreateCarePlanPayload({
      ...base,
      branchId: '',
      coordinatorId: '',
      expirationDate: '',
      notes: '  ',
    });
    expect(payload.branchId).toBeUndefined();
    expect(payload.coordinatorId).toBeUndefined();
    expect(payload.expirationDate).toBeUndefined();
    expect(payload.notes).toBeUndefined();
    expect(payload.interventions).toEqual([]);
    expect(payload.goals).toEqual([]);
  });

  it('keeps provided optional values', () => {
    const payload = buildCreateCarePlanPayload({
      ...base,
      branchId: '33333333-3333-4333-8333-333333333333',
      expirationDate: '2025-06-01',
    });
    expect(payload.branchId).toBe('33333333-3333-4333-8333-333333333333');
    expect(payload.expirationDate).toBe('2025-06-01');
  });

  it('defaults blank goal fields to valid enum values and non-empty description', () => {
    const payload = buildCreateCarePlanPayload({
      ...base,
      goals: [{ name: 'Walk daily', description: '', category: '', targetDate: '', status: '', priority: '' }],
    });
    expect(payload.goals).toEqual([
      {
        name: 'Walk daily',
        description: 'Walk daily',
        category: 'OTHER',
        targetDate: undefined,
        status: 'NOT_STARTED',
        priority: 'MEDIUM',
      },
    ]);
  });

  it('preserves explicit goal values', () => {
    const payload = buildCreateCarePlanPayload({
      ...base,
      goals: [{ name: 'G', description: 'D', category: 'MOBILITY', targetDate: '2025-03-01', status: 'IN_PROGRESS', priority: 'HIGH' }],
    });
    expect(payload.goals[0]).toMatchObject({ description: 'D', category: 'MOBILITY', targetDate: '2025-03-01', status: 'IN_PROGRESS', priority: 'HIGH' });
  });
});
