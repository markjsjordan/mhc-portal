import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateVisitType,
  validateCaregiverEligibility,
  validateVisitDuration,
  validateVisitTypeChangeAfterAssignment,
  validateVisitCreation,
  getEligibleVisitTypesForCaregiver,
} from '../visitTypeValidation';
import type { VisitType } from '../../types';

describe('visitTypeValidation', () => {
  describe('validateVisitType', () => {
    test('accepts all valid visit types', () => {
      const validTypes = [
        'REGULAR',
        'INITIAL',
        'ASSESSMENT',
        'RESPITE',
        'SUPERVISION',
        'EMERGENCY',
        'DISCHARGE',
        'MAKEUP',
        'CONCIERGE',
        'ONGOING_SUPPORT',
      ];

      validTypes.forEach(type => {
        const result = validateVisitType(type);
        expect(result).toBeUndefined();
      });
    });

    test('is case-insensitive', () => {
      expect(validateVisitType('regular')).toBeUndefined();
      expect(validateVisitType('REGULAR')).toBeUndefined();
      expect(validateVisitType('Regular')).toBeUndefined();
    });

    test('rejects invalid visit types', () => {
      const result = validateVisitType('INVALID');
      expect(result).toBeDefined();
      expect(result?.message).toContain('Invalid visit type');
    });

    test('requires a visit type', () => {
      expect(validateVisitType(null)).toBeDefined();
      expect(validateVisitType(undefined)).toBeDefined();
      expect(validateVisitType('')).toBeDefined();
    });

    test('requires string type', () => {
      const result = validateVisitType(123);
      expect(result).toBeDefined();
      expect(result?.message).toContain('must be a string');
    });

    test('error message includes valid types', () => {
      const result = validateVisitType('FAKE');
      expect(result?.message).toContain('REGULAR');
      expect(result?.message).toContain('INITIAL');
    });
  });

  describe('validateCaregiverEligibility', () => {
    test('allows types with no required certifications', () => {
      const result = validateCaregiverEligibility([], 'REGULAR');
      expect(result).toBeUndefined();
    });

    test('allows caregiver with all required certifications', () => {
      const result = validateCaregiverEligibility(['RN', 'LPN'], 'INITIAL');
      expect(result).toBeUndefined();
    });

    test('rejects caregiver missing required RN certification', () => {
      const result = validateCaregiverEligibility(['LPN'], 'SUPERVISION');
      expect(result).toBeDefined();
      expect(result?.message).toContain('Requires: RN');
    });

    test('rejects caregiver with no certifications for nurse type', () => {
      const result = validateCaregiverEligibility([], 'INITIAL');
      expect(result).toBeDefined();
      expect(result?.message).toContain('no certifications');
    });

    test('allows caregiver with extra certifications', () => {
      const result = validateCaregiverEligibility(['RN', 'LPN', 'CPR', 'BLS'], 'INITIAL');
      expect(result).toBeUndefined();
    });

    test('handles undefined certifications', () => {
      const result = validateCaregiverEligibility(undefined, 'REGULAR');
      expect(result).toBeUndefined(); // REGULAR has no required certs
    });

    test('rejects undefined certs for nurse type', () => {
      const result = validateCaregiverEligibility(undefined, 'INITIAL');
      expect(result).toBeDefined();
    });
  });

  describe('validateVisitDuration', () => {
    test('rejects zero or negative duration', () => {
      expect(validateVisitDuration(0, 'REGULAR')).toBeDefined();
      expect(validateVisitDuration(-30, 'REGULAR')).toBeDefined();
    });

    test('rejects duration less than 15 minutes', () => {
      const result = validateVisitDuration(10, 'REGULAR');
      expect(result).toBeDefined();
      expect(result?.message).toContain('at least 15 minutes');
    });

    test('rejects duration greater than 1440 minutes (24 hours)', () => {
      const result = validateVisitDuration(1441, 'REGULAR');
      expect(result).toBeDefined();
      expect(result?.message).toContain('exceed 24 hours');
    });

    test('accepts reasonable durations', () => {
      expect(validateVisitDuration(30, 'REGULAR')).toBeUndefined();
      expect(validateVisitDuration(60, 'REGULAR')).toBeUndefined();
      expect(validateVisitDuration(120, 'REGULAR')).toBeUndefined();
    });

    test('accepts long durations for respite care', () => {
      expect(validateVisitDuration(480, 'RESPITE')).toBeUndefined(); // 8 hours
      expect(validateVisitDuration(720, 'RESPITE')).toBeUndefined(); // 12 hours
    });

    test('handles undefined duration', () => {
      const result = validateVisitDuration(undefined, 'REGULAR');
      expect(result).toBeDefined();
    });
  });

  describe('validateVisitTypeChangeAfterAssignment', () => {
    test('allows change when caregiver not assigned', () => {
      const result = validateVisitTypeChangeAfterAssignment(undefined);
      expect(result).toBeUndefined();
    });

    test('allows change when no assigned caregiver ID', () => {
      const result = validateVisitTypeChangeAfterAssignment('');
      expect(result).toBeUndefined();
    });

    test('rejects change when caregiver assigned', () => {
      const result = validateVisitTypeChangeAfterAssignment('caregiver-123');
      expect(result).toBeDefined();
      expect(result?.message).toContain('Cannot change visit type');
    });
  });

  describe('validateVisitCreation', () => {
    test('validates complete valid payload', () => {
      const errors = validateVisitCreation({
        visitType: 'REGULAR',
        duration: 60,
        caregiverCertifications: [],
      });
      expect(errors).toHaveLength(0);
    });

    test('validates missing visit type', () => {
      const errors = validateVisitCreation({
        duration: 60,
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('required');
    });

    test('stops validation early if visit type invalid', () => {
      const errors = validateVisitCreation({
        visitType: 'INVALID',
        duration: 5, // Also invalid
      });
      // Should only report visit type error
      expect(errors).toHaveLength(1);
    });

    test('validates multiple errors', () => {
      const errors = validateVisitCreation({
        visitType: 'INITIAL',
        duration: 5, // Too short
        caregiverCertifications: ['CNA'], // Missing RN/LPN
      });
      expect(errors.length).toBeGreaterThan(1);
    });

    test('validates caregiver eligibility when certs provided', () => {
      const errors = validateVisitCreation({
        visitType: 'SUPERVISION',
        duration: 60,
        caregiverCertifications: [], // No RN
      });
      expect(errors.some(e => e.field === 'caregiver')).toBe(true);
    });
  });

  describe('getEligibleVisitTypesForCaregiver', () => {
    test('returns non-nurse types when caregiver has no certifications', () => {
      const eligible = getEligibleVisitTypesForCaregiver([]);
      expect(eligible).toContain('REGULAR');
      expect(eligible).toContain('RESPITE');
      expect(eligible).toContain('EMERGENCY');
      expect(eligible).not.toContain('INITIAL');
      expect(eligible).not.toContain('SUPERVISION');
    });

    // Contract: INITIAL and ASSESSMENT require BOTH RN and LPN (see visitTypeConfig);
    // RN alone unlocks only SUPERVISION among the nurse-gated types.
    test('returns RN-gated types when caregiver has RN only', () => {
      const eligible = getEligibleVisitTypesForCaregiver(['RN']);
      expect(eligible).toContain('SUPERVISION');
      expect(eligible).toContain('REGULAR');
      expect(eligible).not.toContain('INITIAL');
      expect(eligible).not.toContain('ASSESSMENT');
    });

    test('returns appropriate types for RN + other certs', () => {
      const eligible = getEligibleVisitTypesForCaregiver(['RN', 'CPR', 'BLS']);
      expect(eligible).toContain('SUPERVISION');
      expect(eligible).not.toContain('INITIAL');
    });

    test('returns nurse types when caregiver has RN and LPN', () => {
      const eligible = getEligibleVisitTypesForCaregiver(['RN', 'LPN']);
      expect(eligible).toContain('INITIAL');
      expect(eligible).toContain('ASSESSMENT');
    });

    test('returns appropriate count of types', () => {
      const noCerts = getEligibleVisitTypesForCaregiver([]);
      const withRN = getEligibleVisitTypesForCaregiver(['RN']);
      // With RN should have more options
      expect(withRN.length).toBeGreaterThan(noCerts.length);
    });

    test('handles undefined certifications', () => {
      const eligible = getEligibleVisitTypesForCaregiver(undefined);
      // Should return non-nurse types
      expect(eligible).toContain('REGULAR');
      expect(eligible).not.toContain('SUPERVISION');
    });

    test('all returned types are valid', () => {
      const eligible = getEligibleVisitTypesForCaregiver(['RN']);
      const validTypes = [
        'REGULAR',
        'INITIAL',
        'ASSESSMENT',
        'RESPITE',
        'SUPERVISION',
        'EMERGENCY',
        'DISCHARGE',
        'MAKEUP',
        'CONCIERGE',
        'ONGOING_SUPPORT',
      ];
      eligible.forEach(type => {
        expect(validTypes).toContain(type);
      });
    });

    test('RN-only caregiver gets the 8 types whose requirements RN satisfies', () => {
      // INITIAL/ASSESSMENT need RN+LPN, so they are excluded for RN-only.
      // Remaining: 7 no-cert types + SUPERVISION (RN) = 8.
      const eligible = getEligibleVisitTypesForCaregiver(['RN']);
      const expectedWithRN = [
        'REGULAR',
        'RESPITE',
        'SUPERVISION',
        'EMERGENCY',
        'DISCHARGE',
        'MAKEUP',
        'CONCIERGE',
        'ONGOING_SUPPORT',
      ];
      expect([...eligible].sort((a, b) => a.localeCompare(b))).toEqual([...expectedWithRN].sort((a, b) => a.localeCompare(b)));
    });

    test('exactly 7 types available without certification', () => {
      const eligible = getEligibleVisitTypesForCaregiver([]);
      expect(eligible).toEqual(
        expect.arrayContaining([
          'REGULAR',
          'RESPITE',
          'EMERGENCY',
          'DISCHARGE',
          'MAKEUP',
          'CONCIERGE',
          'ONGOING_SUPPORT',
        ])
      );
      expect(eligible.length).toBe(7);
    });
  });

  describe('warning logs for unusual durations', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    test('warns when duration is much less than typical', () => {
      validateVisitDuration(20, 'RESPITE'); // Typical is 240
      expect(warnSpy).toHaveBeenCalled();
    });

    test('warns when duration is much more than typical', () => {
      validateVisitDuration(1200, 'REGULAR'); // Typical is 60
      expect(warnSpy).toHaveBeenCalled();
    });

    test('does not warn for reasonable durations', () => {
      warnSpy.mockClear();
      validateVisitDuration(60, 'REGULAR');
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
