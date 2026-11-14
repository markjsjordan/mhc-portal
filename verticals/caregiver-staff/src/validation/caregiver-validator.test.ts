import { describe, it, expect } from 'vitest';
import { CaregiverValidator } from './caregiver-validator.js';
import type { CreateCaregiverInput } from '../types/caregiver.js';

describe('CaregiverValidator regression', () => {
  const validator = new CaregiverValidator();

  it('accepts seeded non-RFC IDs and rejects bad phone with exact field error', () => {
    const basePayload = {
      organizationId: '00000000-0000-0000-0000-000000000001',
      branchIds: ['00000000-0000-0000-0000-000000000002'],
      primaryBranchId: '00000000-0000-0000-0000-000000000002',
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: new Date('1990-05-01T00:00:00Z'),
      email: 'jane@example.com',
      primaryPhone: {
        number: '5125551234',
        type: 'MOBILE' as const,
        canReceiveSMS: true,
        isPrimary: true,
      },
      primaryAddress: {
        type: 'HOME' as const,
        line1: '123 Main St',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        country: 'US',
      },
      emergencyContacts: [
        {
          id: '00000000-0000-0000-0000-000000000003',
          name: 'John Doe',
          relationship: 'Spouse',
          phone: {
            number: '5125559999',
            type: 'MOBILE' as const,
            canReceiveSMS: false,
            isPrimary: true,
          },
          isPrimary: true,
        },
      ],
      employmentType: 'FULL_TIME' as const,
      role: 'CAREGIVER' as const,
      hireDate: new Date('2026-01-15T00:00:00Z'),
      payRate: {
        id: '00000000-0000-0000-0000-000000000004',
        rateType: 'BASE' as const,
        amount: 25,
        unit: 'HOURLY' as const,
        effectiveDate: new Date('2026-01-15T00:00:00Z'),
      },
    };

    const validResult = validator.validateCreate(basePayload as unknown as CreateCaregiverInput);
    expect(validResult).toEqual({ success: true });

    const badPhoneResult = validator.validateCreate({
      ...basePayload,
      primaryPhone: {
        ...basePayload.primaryPhone,
        number: '0123456789',
      },
    } as unknown as CreateCaregiverInput);

    expect(badPhoneResult.success).toBe(false);
    expect(badPhoneResult.errors).toContainEqual({
      field: 'primaryPhone.number',
      message: 'Invalid phone number format',
    });
  });
});
