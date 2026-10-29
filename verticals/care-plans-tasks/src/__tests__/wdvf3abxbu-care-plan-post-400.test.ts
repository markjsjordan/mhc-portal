/**
 * Specific test for the wdvf3abxbu ticket: POST /api/care-plans 400 error
 * Testing the exact scenario from the frontend form submission
 */
import { describe, it, expect } from 'vitest';
import { CarePlanValidator } from '../validation/care-plan-validator.js';

describe('wdvf3abxbu: POST /api/care-plans 400 error reproduction', () => {
  it('should accept minimal care plan with empty goals and interventions arrays', () => {
    // This is the exact payload the frontend sends when creating a basic care plan
    const payload = {
      clientId: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      name: 'Basic Care Plan',
      planType: 'PERSONAL_CARE',
      effectiveDate: '2025-01-15',
      goals: [],        // Empty array - default from schema
      interventions: [], // Empty array - default from schema
    };

    const result = CarePlanValidator.validateCreateCarePlan(payload);
    
    // Verify it validates successfully
    expect(result.clientId).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.goals).toEqual([]);
    expect(result.interventions).toEqual([]);
  });

  it('should handle when goals/interventions are NOT provided (relies on schema .default([]))', () => {
    // Frontend might not send these fields at all
    const payload = {
      clientId: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      name: 'Basic Care Plan',
      planType: 'PERSONAL_CARE',
      effectiveDate: '2025-01-15',
      // goals: [],        // NOT provided
      // interventions: [], // NOT provided
    };

    const result = CarePlanValidator.validateCreateCarePlan(payload);
    
    // Schema should default these to empty arrays
    expect(result.goals).toEqual([]);
    expect(result.interventions).toEqual([]);
  });

  it('should fail if effectiveDate is not a valid date string', () => {
    const payload = {
      clientId: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      name: 'Basic Care Plan',
      planType: 'PERSONAL_CARE',
      effectiveDate: 'invalid-date', // Invalid date
      goals: [],
      interventions: [],
    };

    expect(() => CarePlanValidator.validateCreateCarePlan(payload)).toThrow();
  });

  it('should fail if expiration date is before effective date', () => {
    const payload = {
      clientId: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      name: 'Basic Care Plan',
      planType: 'PERSONAL_CARE',
      effectiveDate: '2025-06-01',
      expirationDate: '2025-01-01', // Before effectiveDate!
      goals: [],
      interventions: [],
    };

    expect(() => CarePlanValidator.validateCreateCarePlan(payload)).toThrow();
  });
});
