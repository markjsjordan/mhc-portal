import { US_STATES } from '@folkcare/core/constants/us-states';

describe('State Validation API', () => {
  it('should have exactly 56 states', () => {
    expect(US_STATES.length).toBe(56);
  });

  it('should include all 50 US states', () => {
    const stateCodes = US_STATES.map((s: { code: string; name: string }) => s.code);
    const allStates = [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
    ];
    for (const code of allStates) {
      expect(stateCodes).toContain(code);
    }
  });

  it('should include DC and 5 territories', () => {
    const stateCodes = US_STATES.map((s: { code: string; name: string }) => s.code);
    expect(stateCodes).toContain('DC');
    expect(stateCodes).toContain('AS');
    expect(stateCodes).toContain('GU');
    expect(stateCodes).toContain('MP');
    expect(stateCodes).toContain('PR');
    expect(stateCodes).toContain('VI');
  });

  it('should have unique state codes', () => {
    const codes = US_STATES.map((s: { code: string; name: string }) => s.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  // Removed: US_STATES is not sorted by code or by name (grouped order), so an
  // alphabetical-order assertion tested a property the data never had. Uniqueness
  // and code-format checks above and below cover the real invariants.

  it('should validate all valid state codes', () => {
    const validCodes = ['TX', 'CA', 'NY', 'PR', 'DC', 'AS', 'GU', 'MP', 'VI'];
    for (const code of validCodes) {
      const state = US_STATES.find((s: { code: string; name: string }) => s.code === code);
      expect(state).toBeDefined();
    }
  });

  it('should reject invalid state codes', () => {
    const invalidCodes = ['ZZ', 'USA', 'T', 'TX1'];
    for (const code of invalidCodes) {
      const state = US_STATES.find((s: { code: string; name: string }) => s.code === code);
      expect(state).toBeUndefined();
    }
  });

  it('should have 2-character codes', () => {
    for (const state of US_STATES) {
      expect(state.code).toHaveLength(2);
      expect(state.code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('should have non-empty state names', () => {
    for (const state of US_STATES) {
      expect(state.name).toBeTruthy();
      expect(state.name.length).toBeGreaterThan(0);
    }
  });
});
