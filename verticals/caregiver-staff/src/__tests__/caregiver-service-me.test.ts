/**
 * Tests for getCurrentCaregiverProfile method
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CaregiverService } from '../service/caregiver-service';
import type { Database, UserContext } from '@folkcare/core';

// Mock database
const mockDatabase: Database = {
  query: vi.fn(),
  healthCheck: vi.fn().mockResolvedValue(true),
  close: vi.fn(),
} as unknown as Database;

// Fixed test date
const FIXED_DATE = new Date('2024-01-15T10:00:00Z');

describe('CaregiverService - getCurrentCaregiverProfile', () => {
  let service: CaregiverService;
  let mockContext: UserContext;

  const mockCaregiverRow = {
    id: 'caregiver-123',
    organization_id: 'org-123',
    user_id: 'user-123',
    branch_ids: ['branch-123'],
    primary_branch_id: 'branch-123',
    employee_number: '1001',
    first_name: 'John',
    last_name: 'Doe',
    date_of_birth: new Date('1990-01-01'),
    email: 'john.doe@example.com',
    primary_phone: JSON.stringify({ 
      type: 'MOBILE', 
      number: '555-0100',
      canReceiveSMS: true 
    }),
    primary_address: JSON.stringify({
      type: 'HOME',
      line1: '123 Main St',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      country: 'US',
    }),
    emergency_contacts: JSON.stringify([]),
    employment_type: 'FULL_TIME',
    employment_status: 'ACTIVE',
    hire_date: new Date('2023-01-01'),
    role: 'CAREGIVER',
    permissions: [],
    credentials: JSON.stringify([
      {
        id: 'cred-123',
        type: 'CNA',
        name: 'Certified Nursing Assistant',
        number: 'TX-CNA-12345',
        issuingAuthority: 'Texas DADS',
        issueDate: new Date('2023-01-01'),
        expirationDate: new Date('2025-01-01'),
        status: 'ACTIVE',
      },
    ]),
    training: JSON.stringify([]),
    skills: JSON.stringify([]),
    specializations: [],
    languages: ['English', 'Spanish'],
    availability: JSON.stringify({
      schedule: {
        monday: { available: true, timeSlots: [{ startTime: '08:00', endTime: '17:00' }] },
        tuesday: { available: true, timeSlots: [{ startTime: '08:00', endTime: '17:00' }] },
        wednesday: { available: true, timeSlots: [{ startTime: '08:00', endTime: '17:00' }] },
        thursday: { available: true, timeSlots: [{ startTime: '08:00', endTime: '17:00' }] },
        friday: { available: true, timeSlots: [{ startTime: '08:00', endTime: '17:00' }] },
        saturday: { available: false },
        sunday: { available: false },
      },
      lastUpdated: FIXED_DATE,
    }),
    pay_rate: JSON.stringify({
      id: 'pay-123',
      rateType: 'BASE',
      amount: 18.00,
      unit: 'HOURLY',
      effectiveDate: new Date('2023-01-01'),
    }),
    compliance_status: 'COMPLIANT',
    preferred_clients: [],
    restricted_clients: [],
    status: 'ACTIVE',
    created_at: FIXED_DATE,
    created_by: 'system',
    updated_at: FIXED_DATE,
    updated_by: 'system',
    version: 1,
    deleted_at: null,
    deleted_by: null,
  };

  const mockUserRow = {
    id: 'user-123',
    organization_id: 'org-123',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    username: 'johndoe',
    roles: ['CAREGIVER'],
    branch_ids: ['branch-123'],
    status: 'ACTIVE',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CaregiverService(mockDatabase);
    
    mockContext = {
      userId: 'user-123',
      organizationId: 'org-123',
      branchIds: ['branch-123'],
      roles: ['CAREGIVER'],
      permissions: ['caregivers:read'],
    };
  });

  it('prefers findByUserId and does not query users table when user_id matches', async () => {
    vi.mocked(mockDatabase.query).mockImplementation((sql: string) => {
      if (sql.includes('FROM caregivers') && sql.includes('user_id = $1')) {
        return Promise.resolve({ rows: [mockCaregiverRow] } as any);
      }
      return Promise.resolve({ rows: [] } as any);
    });

    const result = await service.getCurrentCaregiverProfile(mockContext);

    expect(result).toBeDefined();
    expect(result.id).toBe('caregiver-123');
    expect(result.userId).toBe('user-123');
    expect(result.email).toBe('john.doe@example.com');
    // Ensure user lookup in users table was not called
    const calls = vi.mocked(mockDatabase.query).mock.calls;
    const userQueryCall = calls.find((c: any[]) => typeof c[0] === 'string' && c[0].includes('FROM users'));
    expect(userQueryCall).toBeUndefined();
  });

  it('falls back to email lookup when user_id has no match', async () => {
    const caregiverWithoutUserId = { ...mockCaregiverRow, user_id: null };

    vi.mocked(mockDatabase.query).mockImplementation((sql: string) => {
      if (sql.includes('FROM caregivers') && sql.includes('user_id = $1')) {
        // No match by user_id
        return Promise.resolve({ rows: [] } as any);
      }
      if (sql.includes('FROM users') && sql.includes('WHERE id = $1')) {
        // User found
        return Promise.resolve({ rows: [mockUserRow] } as any);
      }
      if (sql.includes('FROM caregivers') && sql.includes('LOWER(email) = LOWER($1)')) {
        // Caregiver found by email
        return Promise.resolve({ rows: [caregiverWithoutUserId] } as any);
      }
      return Promise.resolve({ rows: [] } as any);
    });

    const result = await service.getCurrentCaregiverProfile(mockContext);

    expect(result).toBeDefined();
    expect(result.id).toBe('caregiver-123');
    expect(result.email).toBe('john.doe@example.com');
    expect(result.credentials).toHaveLength(1);
    expect(result.languages).toContain('Spanish');

    // Both findByUserId, getUserById, and findByEmail should have been called
    const calls = vi.mocked(mockDatabase.query).mock.calls;
    const caregiverByUserIdCall = calls.find((c: any[]) => typeof c[0] === 'string' && c[0].includes('user_id = $1'));
    const userQueryCall = calls.find((c: any[]) => typeof c[0] === 'string' && c[0].includes('FROM users'));
    const caregiverByEmailCall = calls.find((c: any[]) => typeof c[0] === 'string' && c[0].includes('LOWER(email) = LOWER($1)'));

    expect(caregiverByUserIdCall).toBeDefined();
    expect(userQueryCall).toBeDefined();
    expect(caregiverByEmailCall).toBeDefined();
  });

  it('throws NotFoundError if user does not exist during fallback', async () => {
    vi.mocked(mockDatabase.query).mockImplementation(() => {
      // Both user_id search and user lookup return nothing
      return Promise.resolve({ rows: [] } as any);
    });

    await expect(service.getCurrentCaregiverProfile(mockContext)).rejects.toThrow(
      'User not found: user-123'
    );
  });

  it('throws NotFoundError if caregiver profile does not exist during fallback', async () => {
    vi.mocked(mockDatabase.query).mockImplementation((sql: string) => {
      if (sql.includes('FROM users') && sql.includes('WHERE id = $1')) {
        return Promise.resolve({ rows: [mockUserRow] } as any);
      }
      // No caregiver by user_id or email
      return Promise.resolve({ rows: [] } as any);
    });

    await expect(service.getCurrentCaregiverProfile(mockContext)).rejects.toThrow(
      'Caregiver profile not found for user: user-123'
    );
  });
});
