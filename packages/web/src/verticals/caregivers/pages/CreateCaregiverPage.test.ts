import { describe, it, expect } from 'vitest';
import { validate } from './CreateCaregiverPage.js';
import { EMPTY_CAREGIVER_FORM, type CaregiverFormValues } from '../types/index.js';

const FIXED_NOW = new Date('2026-06-15T12:00:00Z');

function makeValidForm(overrides: Partial<CaregiverFormValues> = {}): CaregiverFormValues {
  return {
    ...EMPTY_CAREGIVER_FORM,
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phoneNumber: '5125551234',
    dateOfBirth: '1990-05-01',
    hireDate: '2026-01-15',
    addressLine1: '123 Main St',
    addressCity: 'Austin',
    addressState: 'TX',
    addressPostalCode: '78701',
    emergencyContactName: 'John Doe',
    emergencyContactRelationship: 'Spouse',
    emergencyContactPhone: '5125559999',
    branchIdsRaw: '00000000-0000-0000-0000-000000000002',
    primaryBranchId: '00000000-0000-0000-0000-000000000002',
    payRateAmount: '25',
    payRateEffectiveDate: '2026-01-15',
    ...overrides,
  };
}

describe('CreateCaregiverPage validate()', () => {
  it('accepts a valid form', () => {
    expect(validate(makeValidForm(), FIXED_NOW)).toEqual({});
  });

  it('rejects leading-0 and too-short phones on primary and emergency contacts', () => {
    const leadingZero = validate(
      makeValidForm({ phoneNumber: '0123456789', emergencyContactPhone: '0555123456' }),
      FIXED_NOW
    );
    expect(leadingZero.phoneNumber).toBeDefined();
    expect(leadingZero.emergencyContactPhone).toBeDefined();

    const tooShort = validate(
      makeValidForm({ phoneNumber: '5', emergencyContactPhone: '1' }),
      FIXED_NOW
    );
    expect(tooShort.phoneNumber).toBeDefined();
    expect(tooShort.emergencyContactPhone).toBeDefined();
  });

  it('rejects DOB outside age 16-100 using fixed reference date', () => {
    const tooYoung = validate(makeValidForm({ dateOfBirth: '2015-01-01' }), FIXED_NOW);
    expect(tooYoung.dateOfBirth).toBe('Age must be between 16 and 100');

    const tooOld = validate(makeValidForm({ dateOfBirth: '1920-01-01' }), FIXED_NOW);
    expect(tooOld.dateOfBirth).toBe('Age must be between 16 and 100');
  });
});
