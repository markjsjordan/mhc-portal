import { describe, it, expect } from 'vitest';
import { blankToUndefined, findIntakeFormatError } from '../intake-payload';

describe('blankToUndefined', () => {
  it('returns undefined for undefined, null, empty and whitespace-only values', () => {
    expect(blankToUndefined(undefined)).toBeUndefined();
    expect(blankToUndefined(null)).toBeUndefined();
    expect(blankToUndefined('')).toBeUndefined();
    expect(blankToUndefined('   ')).toBeUndefined();
  });

  it('returns the trimmed value otherwise', () => {
    expect(blankToUndefined('  jane@example.com ')).toBe('jane@example.com');
  });
});

describe('findIntakeFormatError', () => {
  it('accepts an entirely blank form (blank fields are omitted, not invalid)', () => {
    expect(findIntakeFormatError({})).toBeNull();
    expect(
      findIntakeFormatError({
        phone: '  ',
        address: { state: '', postalCode: '' },
        emergencyContacts: [{ name: '', phone: '' }],
      })
    ).toBeNull();
  });

  it.each(['(512) 555-1212', '512-555-1212', '+1 512 555 1212', '5125551212'])(
    'accepts phone %s',
    (phone) => {
      expect(findIntakeFormatError({ phone })).toBeNull();
    }
  );

  it.each(['512.555.1212', '512-555-1212 x2', 'call me'])('rejects phone %s on step 1', (phone) => {
    const result = findIntakeFormatError({ phone });
    expect(result?.step).toBe(1);
    expect(result?.message).toMatch(/phone/i);
  });

  it.each(['78701', '78701-1234'])('accepts ZIP %s', (postalCode) => {
    expect(findIntakeFormatError({ address: { state: 'TX', postalCode } })).toBeNull();
  });

  it.each(['7870', '787011', '78701-12', 'ABCDE'])('rejects ZIP %s', (postalCode) => {
    const result = findIntakeFormatError({ address: { state: 'TX', postalCode } });
    expect(result?.step).toBe(1);
    expect(result?.message).toMatch(/ZIP/);
  });

  it.each(['T', 'TEX', 'T1', '12'])('rejects state %s', (state) => {
    const result = findIntakeFormatError({ address: { state, postalCode: '' } });
    expect(result?.message).toMatch(/State/);
  });

  it('accepts a lower-case 2-letter state (the payload upper-cases it)', () => {
    expect(findIntakeFormatError({ address: { state: 'tx', postalCode: '' } })).toBeNull();
  });

  it('rejects an invalid emergency contact phone and names the contact', () => {
    const result = findIntakeFormatError({
      emergencyContacts: [{ name: 'Sam Smith', phone: '512.555.1212' }],
    });
    expect(result?.step).toBe(1);
    expect(result?.message).toContain('Sam Smith');
  });
});
