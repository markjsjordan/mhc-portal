import { describe, it, expect } from 'vitest';
import { extractApiErrorMessage } from '../api-error';

describe('extractApiErrorMessage', () => {
  it('uses top-level message', () => {
    expect(extractApiErrorMessage({ message: 'Boom' }, 'fallback')).toBe('Boom');
  });

  it('uses string error', () => {
    expect(extractApiErrorMessage({ error: 'Bad thing' }, 'fallback')).toBe('Bad thing');
  });

  it('unwraps structured error objects instead of returning [object Object]', () => {
    const msg = extractApiErrorMessage(
      { error: { message: 'Cannot clock in for this visit', code: 'VALIDATION_ERROR' } },
      'Bad Request'
    );
    expect(msg).toBe('Cannot clock in for this visit');
    expect(msg).not.toContain('[object Object]');
  });

  it('appends validation detail reasons', () => {
    const msg = extractApiErrorMessage(
      {
        error: {
          message: 'Invalid clock-in data',
          code: 'VALIDATION_ERROR',
          details: { errors: ['deviceId is required', 'accuracy cannot be negative'] },
        },
      },
      'Bad Request'
    );
    expect(msg).toBe('Invalid clock-in data: deviceId is required; accuracy cannot be negative');
  });

  it('falls back when nothing usable is present', () => {
    expect(extractApiErrorMessage({}, 'Bad Request')).toBe('Bad Request');
    expect(extractApiErrorMessage(null, 'Bad Request')).toBe('Bad Request');
  });
});
