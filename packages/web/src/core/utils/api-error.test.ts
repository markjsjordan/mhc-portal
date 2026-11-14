import { describe, it, expect } from 'vitest';
import { extractApiErrorMessage } from './api-error.js';
import type { ApiError } from '../types/api.js';

describe('extractApiErrorMessage', () => {
  it('renders { field, message } validation errors from backend shape', () => {
    const body = {
      success: false,
      error: 'Invalid caregiver data',
      details: {
        errors: [
          { field: 'primaryPhone.number', message: 'Invalid phone number format' },
          { field: 'dateOfBirth', message: 'Age must be between 16 and 100' },
        ],
      },
    } as unknown as ApiError;

    expect(extractApiErrorMessage(body, 'Fallback')).toBe(
      'Invalid caregiver data: primaryPhone.number: Invalid phone number format; dateOfBirth: Age must be between 16 and 100'
    );
  });

  it('still supports string-array details.errors', () => {
    const body = {
      error: 'Validation failed',
      details: {
        errors: ['First name is required', 'Email is invalid'],
      },
    } as unknown as ApiError;

    expect(extractApiErrorMessage(body, 'Fallback')).toBe(
      'Validation failed: First name is required; Email is invalid'
    );
  });

  it('de-duplicates repeated error entries', () => {
    const body = {
      error: 'Invalid caregiver data',
      details: {
        errors: [
          { field: 'primaryPhone.number', message: 'Invalid phone number format' },
          { field: 'primaryPhone.number', message: 'Invalid phone number format' },
        ],
      },
    } as unknown as ApiError;

    expect(extractApiErrorMessage(body, 'Fallback')).toBe(
      'Invalid caregiver data: primaryPhone.number: Invalid phone number format'
    );
  });
});
