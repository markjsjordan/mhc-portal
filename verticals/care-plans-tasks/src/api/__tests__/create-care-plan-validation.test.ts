/**
 * Integration test to reproduce the POST /api/care-plans 400 error
 */
import { describe, it, expect } from 'vitest';
import { CarePlanValidator } from '../../validation/care-plan-validator.js';
import { ValidationError } from '@folkcare/core';

describe('POST /api/care-plans validation', () => {
  it('should accept valid minimal payload from frontend', () => {
    const validPayload = {
      clientId: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      name: 'Test Care Plan',
      planType: 'PERSONAL_CARE',
      effectiveDate: '2025-01-15',
      goals: [],
      interventions: [],
    };

    const result = CarePlanValidator.validateCreateCarePlan(validPayload);
    expect(result.clientId).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.organizationId).toBe('22222222-2222-4222-8222-222222222222');
    expect(result.name).toBe('Test Care Plan');
    expect(result.planType).toBe('PERSONAL_CARE');
  });

  it('should reject payload with missing clientId', () => {
    const invalidPayload = {
      // Missing clientId
      organizationId: '22222222-2222-4222-8222-222222222222',
      name: 'Test Care Plan',
      planType: 'PERSONAL_CARE',
      effectiveDate: '2025-01-15',
    };

    expect(() => CarePlanValidator.validateCreateCarePlan(invalidPayload)).toThrow(ValidationError);
  });

  it('should accept payload with goals containing all required fields', () => {
    const payloadWithGoals = {
      clientId: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      name: 'Test Care Plan',
      planType: 'PERSONAL_CARE',
      effectiveDate: '2025-01-15',
      goals: [
        {
          name: 'Improve mobility',
          description: 'Walk 10 minutes daily',
          category: 'MOBILITY',
          status: 'NOT_STARTED',
          priority: 'HIGH',
        },
      ],
      interventions: [],
    };

    const result = CarePlanValidator.validateCreateCarePlan(payloadWithGoals);
    expect(result.goals).toHaveLength(1);
    expect(result.goals[0]?.name).toBe('Improve mobility');
  });

  it('should reject goal with missing description', () => {
    const payloadWithInvalidGoal = {
      clientId: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      name: 'Test Care Plan',
      planType: 'PERSONAL_CARE',
      effectiveDate: '2025-01-15',
      goals: [
        {
          name: 'Improve mobility',
          // Missing description - REQUIRED
          category: 'MOBILITY',
          status: 'NOT_STARTED',
          priority: 'HIGH',
        },
      ],
      interventions: [],
    };

    expect(() => CarePlanValidator.validateCreateCarePlan(payloadWithInvalidGoal)).toThrow(ValidationError);
  });

  it('should accept optional fields as undefined', () => {
    const payloadWithOptionals = {
      clientId: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      branchId: undefined,
      name: 'Test Care Plan',
      planType: 'PERSONAL_CARE',
      effectiveDate: '2025-01-15',
      expirationDate: undefined,
      coordinatorId: undefined,
      notes: undefined,
      goals: [],
      interventions: [],
    };

    const result = CarePlanValidator.validateCreateCarePlan(payloadWithOptionals);
    expect(result.branchId).toBeUndefined();
    expect(result.expirationDate).toBeUndefined();
    expect(result.coordinatorId).toBeUndefined();
    expect(result.notes).toBeUndefined();
  });

  it('should accept payload matching frontend CreateCarePlanInput type', () => {
    // This mimics what buildCreateCarePlanPayload() returns
    const frontendPayload = {
      clientId: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      branchId: undefined,
      name: 'Test Care Plan',
      planType: 'PERSONAL_CARE' as const,
      effectiveDate: '2025-01-15',
      expirationDate: undefined,
      coordinatorId: undefined,
      notes: undefined,
      goals: [
        {
          name: 'Walk daily',
          description: 'Walk 10 minutes',
          category: 'MOBILITY' as const,
          targetDate: undefined,
          status: 'NOT_STARTED' as const,
          priority: 'MEDIUM' as const,
        },
      ],
      interventions: [],
    };

    const result = CarePlanValidator.validateCreateCarePlan(frontendPayload);
    expect(result.goals).toHaveLength(1);
    expect(result.interventions).toHaveLength(0);
  });
});
