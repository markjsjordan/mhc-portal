import { describe, test, expect } from 'vitest';
import {
  VISIT_TYPES,
  getVisitTypeConfig,
  getAllVisitTypes,
  getNurseRequiredVisitTypes,
  isValidVisitType,
} from '../visitTypeConfig';
import type { VisitType } from '../../types';

const TARGET_VISIT_TYPES: VisitType[] = [
  'REGULAR',
  'INITIAL',
  'SUPERVISION',
  'ASSESSMENT',
  'CONCIERGE',
];

const DEPRECATED_VISIT_TYPES = [
  'DISCHARGE',
  'RESPITE',
  'EMERGENCY',
  'MAKEUP',
  'ONGOING_SUPPORT',
];

describe('visitTypeConfig', () => {
  describe('VISIT_TYPES constant', () => {
    test('exactly 5 target visit types are defined', () => {
      expect(Object.keys(VISIT_TYPES)).toEqual(TARGET_VISIT_TYPES);
      expect(Object.keys(VISIT_TYPES)).toHaveLength(5);
    });

    test('maps internal IDs to required display labels', () => {
      expect(VISIT_TYPES.REGULAR.label).toBe('Home Care Visit');
      expect(VISIT_TYPES.INITIAL.label).toBe('Med Check');
      expect(VISIT_TYPES.SUPERVISION.label).toBe('Nurse Visit');
      expect(VISIT_TYPES.ASSESSMENT.label).toBe('Care Management');
      expect(VISIT_TYPES.CONCIERGE.label).toBe('Concierge Visit');
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
        expect(['LOW', 'STANDARD', 'MEDIUM_HIGH', 'HIGH']).toContain(config.careLevel);
        expect(Array.isArray(config.requiredCertifications)).toBe(true);
        expect(config.billingRate).toBeTruthy();
      });
    });

    test('typical durations are reasonable', () => {
      Object.values(VISIT_TYPES).forEach(config => {
        expect(config.typicalDuration).toBeGreaterThanOrEqual(15);
        expect(config.typicalDuration).toBeLessThanOrEqual(1440);
      });
    });

    test('concierge visit has longest typical duration', () => {
      expect(VISIT_TYPES.CONCIERGE.typicalDuration).toBe(120);
    });

    test('all color classes use valid Tailwind colors', () => {
      const validColors = [
        'text-green-600',
        'text-emerald-600',
        'text-teal-600',
        'text-indigo-600',
        'text-pink-600',
      ];
      Object.values(VISIT_TYPES).forEach(config => {
        expect(validColors).toContain(config.colorClass);
      });
    });

    test('billing rates are defined and consistent', () => {
      const billingRates = new Set(Object.values(VISIT_TYPES).map(c => c.billingRate));
      expect(billingRates.size).toBe(5);
      Object.values(VISIT_TYPES).forEach(config => {
        expect(config.billingRate.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getVisitTypeConfig', () => {
    test('returns correct config for valid visit type', () => {
      const config = getVisitTypeConfig('REGULAR');
      expect(config.type).toBe('REGULAR');
      expect(config.label).toBe('Home Care Visit');
    });

    test('is case-insensitive', () => {
      const config1 = getVisitTypeConfig('regular');
      const config2 = getVisitTypeConfig('REGULAR');
      expect(config1).toEqual(config2);
    });

    test('returns REGULAR as fallback for invalid or deprecated types', () => {
      expect(getVisitTypeConfig('INVALID_TYPE').type).toBe('REGULAR');
      DEPRECATED_VISIT_TYPES.forEach(dep => {
        expect(getVisitTypeConfig(dep).type).toBe('REGULAR');
      });
    });

    test('handles empty string gracefully', () => {
      const config = getVisitTypeConfig('');
      expect(config.type).toBe('REGULAR');
    });

    test('returns config for all 5 target visit types', () => {
      TARGET_VISIT_TYPES.forEach(type => {
        const config = getVisitTypeConfig(type);
        expect(config.type).toBe(type);
      });
    });
  });

  describe('getAllVisitTypes', () => {
    test('returns all 5 visit types', () => {
      const types = getAllVisitTypes();
      expect(types).toEqual(TARGET_VISIT_TYPES);
      expect(types.length).toBe(5);
    });

    test('all returned types have configs', () => {
      const types = getAllVisitTypes();
      types.forEach(type => {
        expect(VISIT_TYPES[type]).toBeDefined();
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
      expect(nurseTypes).not.toContain('CONCIERGE');
    });

    test('all returned types have RN in their required certifications', () => {
      const nurseTypes = getNurseRequiredVisitTypes();
      nurseTypes.forEach(type => {
        expect(VISIT_TYPES[type].requiredCertifications).toContain('RN');
      });
    });
  });

  describe('isValidVisitType', () => {
    test('returns true for all 5 target visit types', () => {
      TARGET_VISIT_TYPES.forEach(type => {
        expect(isValidVisitType(type)).toBe(true);
      });
    });

    test('returns false for deprecated and invalid types', () => {
      DEPRECATED_VISIT_TYPES.forEach(dep => {
        expect(isValidVisitType(dep)).toBe(false);
      });
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
    test('matches spec care levels for all 5 types', () => {
      expect(VISIT_TYPES.REGULAR.careLevel).toBe('STANDARD');
      expect(VISIT_TYPES.INITIAL.careLevel).toBe('HIGH');
      expect(VISIT_TYPES.SUPERVISION.careLevel).toBe('MEDIUM_HIGH');
      expect(VISIT_TYPES.ASSESSMENT.careLevel).toBe('MEDIUM_HIGH');
      expect(VISIT_TYPES.CONCIERGE.careLevel).toBe('LOW');
    });
  });

  describe('visit type certifications', () => {
    test('INITIAL requires RN or LPN', () => {
      expect(VISIT_TYPES.INITIAL.requiredCertifications).toEqual(['RN', 'LPN']);
    });

    test('SUPERVISION requires RN', () => {
      expect(VISIT_TYPES.SUPERVISION.requiredCertifications).toEqual(['RN']);
    });

    test('REGULAR and CONCIERGE require no certifications', () => {
      expect(VISIT_TYPES.REGULAR.requiredCertifications).toEqual([]);
      expect(VISIT_TYPES.CONCIERGE.requiredCertifications).toEqual([]);
    });
  });
});
