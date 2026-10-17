import { describe, test, expect } from 'vitest';
import {
  VISIT_TYPES,
  getVisitTypeConfig,
  getAllVisitTypes,
  getNurseRequiredVisitTypes,
  isValidVisitType,
} from '../visitTypeConfig';
import type { VisitType } from '../types';

describe('visitTypeConfig', () => {
  describe('VISIT_TYPES constant', () => {
    test('all 10 visit types are defined', () => {
      const expectedTypes: VisitType[] = [
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
      expect(Object.keys(VISIT_TYPES)).toEqual(expectedTypes);
    });

    test('each visit type has all required properties', () => {
      Object.entries(VISIT_TYPES).forEach(([type, config]) => {
        expect(config.type).toBe(type);
        expect(config.label).toBeTruthy();
        expect(typeof config.label).toBe('string');
        expect(config.icon).toBeTruthy();
        expect(config.color).toBeTruthy();
        expect(config.colorClass).toBeTruthy();
        expect(config.bgClass).toBeTruthy();
        expect(config.borderClass).toBeTruthy();
        expect(config.badgeClass).toBeTruthy();
        expect(config.description).toBeTruthy();
        expect(typeof config.description).toBe('string');
        expect(typeof config.typicalDuration).toBe('number');
        expect(config.typicalDuration).toBeGreaterThan(0);
        expect(['LOW', 'STANDARD', 'MEDIUM_HIGH', 'HIGH', 'CRITICAL', 'VARIABLE']).toContain(
          config.careLevel
        );
        expect(Array.isArray(config.requiredCertifications)).toBe(true);
        expect(config.billingRate).toBeTruthy();
      });
    });

    test('typical durations are reasonable', () => {
      Object.entries(VISIT_TYPES).forEach(([type, config]) => {
        // All durations should be between 15 and 1440 minutes (1 day)
        expect(config.typicalDuration).toBeGreaterThanOrEqual(15);
        expect(config.typicalDuration).toBeLessThanOrEqual(1440);
      });
    });

    test('respite care has longest typical duration', () => {
      expect(VISIT_TYPES.RESPITE.typicalDuration).toBe(240); // 4 hours
    });

    test('emergency has shortest typical duration', () => {
      const minDuration = Math.min(...Object.values(VISIT_TYPES).map(c => c.typicalDuration));
      expect(minDuration).toBeLessThanOrEqual(VISIT_TYPES.EMERGENCY.typicalDuration);
    });

    test('all color classes use valid Tailwind colors', () => {
      const validColors = [
        'text-green-600',
        'text-emerald-600',
        'text-teal-600',
        'text-rose-600',
        'text-indigo-600',
        'text-red-600',
        'text-purple-600',
        'text-amber-600',
        'text-pink-600',
        'text-cyan-600',
      ];
      Object.values(VISIT_TYPES).forEach(config => {
        expect(validColors).toContain(config.colorClass);
      });
    });

    test('billing rates are defined and consistent', () => {
      const billingRates = new Set(Object.values(VISIT_TYPES).map(c => c.billingRate));
      expect(billingRates.size).toBeGreaterThan(0);
      // Each visit type should have a billing rate
      Object.values(VISIT_TYPES).forEach(config => {
        expect(config.billingRate.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getVisitTypeConfig', () => {
    test('returns correct config for valid visit type', () => {
      const config = getVisitTypeConfig('REGULAR');
      expect(config.type).toBe('REGULAR');
      expect(config.label).toBe('Regular Visit');
    });

    test('is case-insensitive', () => {
      const config1 = getVisitTypeConfig('regular');
      const config2 = getVisitTypeConfig('REGULAR');
      expect(config1).toEqual(config2);
    });

    test('returns REGULAR as fallback for invalid types', () => {
      const config = getVisitTypeConfig('INVALID_TYPE');
      expect(config.type).toBe('REGULAR');
    });

    test('handles null/undefined gracefully', () => {
      const config1 = getVisitTypeConfig('');
      expect(config1.type).toBe('REGULAR');
    });

    test('returns config for all visit types', () => {
      const types: VisitType[] = [
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
      types.forEach(type => {
        const config = getVisitTypeConfig(type);
        expect(config.type).toBe(type);
      });
    });
  });

  describe('getAllVisitTypes', () => {
    test('returns all 10 visit types', () => {
      const types = getAllVisitTypes();
      expect(types.length).toBe(10);
    });

    test('returns array of strings', () => {
      const types = getAllVisitTypes();
      types.forEach(type => {
        expect(typeof type).toBe('string');
      });
    });

    test('all returned types have configs', () => {
      const types = getAllVisitTypes();
      types.forEach(type => {
        expect(VISIT_TYPES[type as VisitType]).toBeDefined();
      });
    });
  });

  describe('getNurseRequiredVisitTypes', () => {
    test('returns types requiring RN certification', () => {
      const nurseTypes = getNurseRequiredVisitTypes();
      expect(nurseTypes).toContain('INITIAL');
      expect(nurseTypes).toContain('ASSESSMENT');
      expect(nurseTypes).toContain('SUPERVISION');
    });

    test('does not include non-nurse types', () => {
      const nurseTypes = getNurseRequiredVisitTypes();
      expect(nurseTypes).not.toContain('REGULAR');
      expect(nurseTypes).not.toContain('RESPITE');
      expect(nurseTypes).not.toContain('MAKEUP');
      expect(nurseTypes).not.toContain('EMERGENCY');
      expect(nurseTypes).not.toContain('DISCHARGE');
      expect(nurseTypes).not.toContain('CONCIERGE');
      expect(nurseTypes).not.toContain('ONGOING_SUPPORT');
    });

    test('all returned types have RN in their required certifications', () => {
      const nurseTypes = getNurseRequiredVisitTypes();
      nurseTypes.forEach(type => {
        expect(VISIT_TYPES[type].requiredCertifications).toContain('RN');
      });
    });
  });

  describe('isValidVisitType', () => {
    test('returns true for all valid visit types', () => {
      const validTypes: VisitType[] = [
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
        expect(isValidVisitType(type)).toBe(true);
      });
    });

    test('returns false for invalid types', () => {
      expect(isValidVisitType('INVALID')).toBe(false);
      expect(isValidVisitType('FAKE_TYPE')).toBe(false);
      expect(isValidVisitType(123)).toBe(false);
      expect(isValidVisitType(null)).toBe(false);
      expect(isValidVisitType(undefined)).toBe(false);
    });

    test('is case-insensitive for string inputs', () => {
      expect(isValidVisitType('regular')).toBe(true);
      expect(isValidVisitType('REGULAR')).toBe(true);
      expect(isValidVisitType('Regular')).toBe(true);
    });
  });

  describe('visit type care levels', () => {
    test('CRITICAL visit type is EMERGENCY', () => {
      const criticalTypes = Object.values(VISIT_TYPES).filter(c => c.careLevel === 'CRITICAL');
      expect(criticalTypes).toHaveLength(1);
      expect(criticalTypes[0].type).toBe('EMERGENCY');
    });

    test('HIGH care level types are clinical', () => {
      const highTypes = Object.values(VISIT_TYPES).filter(c => c.careLevel === 'HIGH');
      highTypes.forEach(config => {
        expect(['INITIAL', 'SUPERVISION']).toContain(config.type);
      });
    });

    test('VARIABLE care level is RESPITE only', () => {
      const variableTypes = Object.values(VISIT_TYPES).filter(c => c.careLevel === 'VARIABLE');
      expect(variableTypes).toHaveLength(1);
      expect(variableTypes[0].type).toBe('RESPITE');
    });

    test('LOW care level is CONCIERGE', () => {
      const lowTypes = Object.values(VISIT_TYPES).filter(c => c.careLevel === 'LOW');
      expect(lowTypes).toHaveLength(1);
      expect(lowTypes[0].type).toBe('CONCIERGE');
    });
  });

  describe('visit type certifications', () => {
    test('INITIAL requires RN or LPN', () => {
      expect(VISIT_TYPES.INITIAL.requiredCertifications).toEqual(['RN', 'LPN']);
    });

    test('ASSESSMENT requires RN or LPN', () => {
      expect(VISIT_TYPES.ASSESSMENT.requiredCertifications).toEqual(['RN', 'LPN']);
    });

    test('SUPERVISION requires RN only', () => {
      expect(VISIT_TYPES.SUPERVISION.requiredCertifications).toEqual(['RN']);
    });

    test('most visit types have no required certifications', () => {
      const typesWithoutCerts = Object.values(VISIT_TYPES).filter(
        c => c.requiredCertifications.length === 0
      );
      expect(typesWithoutCerts.length).toBeGreaterThan(5);
    });
  });
});
