import { describe, it, expect } from 'vitest';
import { MFAService } from '../mfa.service.js';

describe('HIPAA-009: MFAService TOTP', () => {
  it('validates generated TOTP correctly', () => {
    const mockDb = {
      query: async () => ({ rows: [] }),
    } as any;

    const service = new MFAService(mockDb);
    const secret = '0123456789abcdef0123456789abcdef01234567';

    // generate valid code for current counter
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / 30);
    const code = (service as any).generateTOTPCode(secret, counter);

    expect(service.validateTOTP(secret, code)).toBe(true);
    expect(service.validateTOTP(secret, '000000')).toBe(false);
  });
});
