import { ClientAddressSchema, ClientIntakeSchema, isValidStateCode } from '../useClientForm';
import { US_STATES } from '@/core/constants/us-states';

describe('Zod Validation Schemas', () => {
  it('validates complete address with valid state code', () => {
    const address = {
      line1: '123 Main Street',
      line2: 'Apt 4B',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
    };
    const result = ClientAddressSchema.safeParse(address);
    expect(result.success).toBe(true);
  });

  it('validates all 50 US states', () => {
    const baseAddress = { line1: '123 Main Street', city: 'City', postalCode: '12345' };
    const states = US_STATES.filter(s => !['AS', 'GU', 'MP', 'PR', 'VI'].includes(s.code));
    states.forEach(state => {
      const result = ClientAddressSchema.safeParse({ ...baseAddress, state: state.code });
      expect(result.success).toBe(true);
    });
  });

  it('rejects invalid state code', () => {
    const result = ClientAddressSchema.safeParse({
      line1: '123 Main Street',
      city: 'Austin',
      state: 'ZZ',
      postalCode: '78701',
    });
    expect(result.success).toBe(false);
  });

  it('validates client intake form', () => {
    const result = ClientIntakeSchema.safeParse({
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-01-15',
      address: {
        line1: '123 Main Street',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('isValidStateCode Type Guard', () => {
  it('returns true for valid state codes', () => {
    expect(isValidStateCode('TX')).toBe(true);
    expect(isValidStateCode('PR')).toBe(true);
  });

  it('returns false for invalid state codes', () => {
    expect(isValidStateCode('ZZ')).toBe(false);
    expect(isValidStateCode(123)).toBe(false);
  });

  it('validates all 56 states', () => {
    US_STATES.forEach(state => {
      expect(isValidStateCode(state.code)).toBe(true);
    });
  });
});