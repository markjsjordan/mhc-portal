/**
 * Caregiver repository tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CaregiverRepository } from '../repository/caregiver-repository';
import type { Database, UserContext } from '@folkcare/core';

describe('CaregiverRepository', () => {
  let repository: CaregiverRepository;
  let mockDb: Database;
  let mockContext: UserContext;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    } as unknown as Database;

    mockContext = {
      userId: 'user-123',
      organizationId: 'org-123',
      branchIds: ['branch-123'],
      roles: ['ORG_ADMIN'],
      permissions: ['caregivers:read', 'caregivers:write'],
    };

    repository = new CaregiverRepository(mockDb);
  });

  describe('createServiceAuthorization', () => {
    it('should create service authorization with all fields', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{ id: 'auth-123' }],
        command: '',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const authId = await repository.createServiceAuthorization(
        {
          caregiverId: 'caregiver-123',
          serviceTypeCode: 'PERSONAL_CARE',
          serviceTypeName: 'Personal Care',
          authorizationSource: 'CREDENTIAL',
          effectiveDate: new Date('2024-01-01'),
          expirationDate: new Date('2025-12-31'),
          notes: 'CNA certified',
        },
        mockContext
      );

      expect(authId).toBe('auth-123');
      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should create service authorization with minimal fields', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{ id: 'auth-456' }],
        command: '',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const authId = await repository.createServiceAuthorization(
        {
          caregiverId: 'caregiver-123',
          serviceTypeCode: 'COMPANION',
          serviceTypeName: 'Companion Care',
          effectiveDate: new Date('2024-01-01'),
        },
        mockContext
      );

      expect(authId).toBe('auth-456');
    });
  });

  describe('getServiceAuthorizations', () => {
    it('should retrieve service authorizations', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [
          {
            id: 'auth-1',
            caregiver_id: 'caregiver-123',
            service_type_code: 'PERSONAL_CARE',
            service_type_name: 'Personal Care',
            authorization_source: 'CREDENTIAL',
            effective_date: new Date('2024-01-01'),
            expiration_date: new Date('2025-12-31'),
            status: 'ACTIVE',
            notes: 'Test note',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        command: '',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const authorizations = await repository.getServiceAuthorizations('caregiver-123');

      expect(authorizations).toHaveLength(1);
      expect(authorizations[0]?.serviceTypeCode).toBe('PERSONAL_CARE');
    });

    it('should return empty array when no authorizations exist', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [],
        command: '',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      const authorizations = await repository.getServiceAuthorizations('caregiver-999');
      expect(authorizations).toHaveLength(0);
    });
  });

  describe('createStateScreening', () => {
    it('should create state screening record', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{ id: 'screening-123' }],
        command: '',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const screeningId = await repository.createStateScreening({
        caregiverId: 'caregiver-123',
        stateCode: 'TX',
        screeningType: 'EMPLOYEE_MISCONDUCT_REGISTRY',
        initiatedBy: 'user-123',
        initiatedAt: new Date('2024-01-01'),
      });

      expect(screeningId).toBe('screening-123');
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('updateStateScreening', () => {
    it('should update all screening fields', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [],
        command: '',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      await repository.updateStateScreening(
        'screening-123',
        {
          status: 'CLEARED',
          completionDate: new Date('2024-01-15'),
          expirationDate: new Date('2025-12-31'),
          confirmationNumber: 'TX-123456',
          clearanceNumber: 'CLEAR-789',
          results: { flagged: false },
          notes: 'Approved',
        },
        mockContext
      );

      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should update only status field', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [],
        command: '',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      await repository.updateStateScreening(
        'screening-123',
        { status: 'IN_PROGRESS' },
        mockContext
      );

      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should handle JSONB results field', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [],
        command: '',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      await repository.updateStateScreening(
        'screening-123',
        {
          results: { level: 2, approved: true, notes: 'Clean record' },
        },
        mockContext
      );

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('getStateScreenings', () => {
    it('should retrieve state screenings', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [
          {
            id: 'screening-1',
            caregiver_id: 'caregiver-123',
            state_code: 'TX',
            screening_type: 'EMPLOYEE_MISCONDUCT_REGISTRY',
            status: 'CLEARED',
            initiation_date: new Date('2024-01-01'),
            completion_date: new Date('2024-01-15'),
            expiration_date: new Date('2025-12-31'),
            confirmation_number: 'TX-123456',
            clearance_number: null,
            results: null,
            notes: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        command: '',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const screenings = await repository.getStateScreenings('caregiver-123');

      expect(screenings).toHaveLength(1);
      expect(screenings[0]?.stateCode).toBe('TX');
      expect(screenings[0]?.status).toBe('CLEARED');
    });

    it('should parse JSONB results field', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [
          {
            id: 'screening-1',
            caregiver_id: 'caregiver-123',
            state_code: 'FL',
            screening_type: 'LEVEL_2_BACKGROUND',
            status: 'CLEARED',
            initiation_date: new Date('2024-01-01'),
            completion_date: new Date('2024-01-15'),
            expiration_date: new Date('2029-12-31'),
            confirmation_number: 'FL-789012',
            clearance_number: null,
            results: JSON.stringify({ level: 2, approved: true }),
            notes: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        command: '',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const screenings = await repository.getStateScreenings('caregiver-123');

      expect(screenings[0]?.results).toEqual({ level: 2, approved: true });
    });

    it('should return empty array when no screenings exist', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [],
        command: '',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      const screenings = await repository.getStateScreenings('caregiver-999');
      expect(screenings).toHaveLength(0);
    });
  });

  describe('search', () => {
    it('should use default ORDER BY last_name asc, first_name asc when no sort is specified', async () => {
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({
          rows: [{ count: '1' }],
          command: '',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'cg-1', first_name: 'Alice', last_name: 'Smith', email: 'alice@example.com' }],
          command: '',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      const result = await repository.search({}, { page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      const dataQuery = vi.mocked(mockDb.query).mock.calls[1]?.[0] as string;
      expect(dataQuery).toContain('ORDER BY last_name asc, first_name asc');
    });

    it('should support whitelisted columns first_name, last_name, and email with asc/desc', async () => {
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({ rows: [{ count: '1' }], command: '', rowCount: 1, oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'cg-1', first_name: 'Bob', last_name: 'Jones', email: 'bob@example.com' }], command: '', rowCount: 1, oid: 0, fields: [] });

      await repository.search({}, { page: 1, limit: 20, sortBy: 'first_name', sortOrder: 'desc' });
      let dataQuery = vi.mocked(mockDb.query).mock.calls[1]?.[0] as string;
      expect(dataQuery).toContain('ORDER BY first_name desc');

      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({ rows: [{ count: '1' }], command: '', rowCount: 1, oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'cg-1', first_name: 'Bob', last_name: 'Jones', email: 'bob@example.com' }], command: '', rowCount: 1, oid: 0, fields: [] });

      await repository.search({}, { page: 1, limit: 20, sortBy: 'email', sortOrder: 'asc' });
      dataQuery = vi.mocked(mockDb.query).mock.calls[3]?.[0] as string;
      expect(dataQuery).toContain('ORDER BY email asc');
    });

    it('should map camelCase column names to snake_case safely', async () => {
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({ rows: [{ count: '1' }], command: '', rowCount: 1, oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'cg-1', first_name: 'Bob', last_name: 'Jones', email: 'bob@example.com' }], command: '', rowCount: 1, oid: 0, fields: [] });

      await repository.search({}, { page: 1, limit: 20, sortBy: 'firstName', sortOrder: 'asc' });
      const dataQuery = vi.mocked(mockDb.query).mock.calls[1]?.[0] as string;
      expect(dataQuery).toContain('ORDER BY first_name asc');
    });

    it('should reject unwhitelisted sort columns and fall back to default', async () => {
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({ rows: [{ count: '1' }], command: '', rowCount: 1, oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'cg-1', first_name: 'Bob', last_name: 'Jones', email: 'bob@example.com' }], command: '', rowCount: 1, oid: 0, fields: [] });

      await repository.search({}, { page: 1, limit: 20, sortBy: 'id; DROP TABLE caregivers;', sortOrder: 'desc' });
      const dataQuery = vi.mocked(mockDb.query).mock.calls[1]?.[0] as string;
      expect(dataQuery).toContain('ORDER BY last_name asc, first_name asc');
      expect(dataQuery).not.toContain('DROP TABLE');
    });
  });

  describe('findByUserId', () => {
    const mockCaregiverRow = {
      id: 'caregiver-123',
      organization_id: 'org-123',
      branch_ids: ['branch-123'],
      primary_branch_id: 'branch-123',
      user_id: 'user-123',
      employee_number: '1001',
      first_name: 'Jane',
      last_name: 'Doe',
      date_of_birth: new Date('1990-01-01'),
      email: 'jane.doe@example.com',
      primary_phone: JSON.stringify({ type: 'MOBILE', number: '555-0100' }),
      primary_address: JSON.stringify({ line1: '123 Main St', city: 'Austin', state: 'TX', postalCode: '78701' }),
      employment_type: 'FULL_TIME',
      employment_status: 'ACTIVE',
      hire_date: new Date('2023-01-01'),
      role: 'CAREGIVER',
      permissions: [],
      credentials: JSON.stringify([]),
      training: JSON.stringify([]),
      skills: JSON.stringify([]),
      specializations: [],
      availability: JSON.stringify({}),
      pay_rate: JSON.stringify({ amount: 20, unit: 'HOURLY' }),
      compliance_status: 'COMPLIANT',
      status: 'ACTIVE',
      created_at: new Date('2023-01-01'),
      created_by: 'system',
      updated_at: new Date('2023-01-01'),
      updated_by: 'system',
      version: 1,
      deleted_at: null,
      deleted_by: null,
    };

    it('returns org-scoped row when matching user_id and organization_id exist', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [mockCaregiverRow],
        command: '',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await repository.findByUserId('user-123', 'org-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('caregiver-123');
      expect(result?.userId).toBe('user-123');
      expect(result?.organizationId).toBe('org-123');

      const [sql, params] = vi.mocked(mockDb.query).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('user_id = $1');
      expect(sql).toContain('organization_id = $2');
      expect(sql).toContain('deleted_at IS NULL');
      expect(params).toEqual(['user-123', 'org-123']);
    });

    it('returns null for another org even with matching user_id', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [],
        command: '',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      const result = await repository.findByUserId('user-123', 'org-other');

      expect(result).toBeNull();
      const [, params] = vi.mocked(mockDb.query).mock.calls[0] as [string, unknown[]];
      expect(params).toEqual(['user-123', 'org-other']);
    });

    it('ignores soft-deleted caregiver profiles', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [],
        command: '',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      const result = await repository.findByUserId('user-deleted', 'org-123');

      expect(result).toBeNull();
      const [sql] = vi.mocked(mockDb.query).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('deleted_at IS NULL');
    });
  });

  describe('findByEmailAndOrganization', () => {
    it('returns caregiver matching email and organization', async () => {
      const mockCaregiverRow = {
        id: 'cg-1',
        organization_id: 'org-123',
        user_id: null,
        employee_number: 'EMP001',
        first_name: 'Jane',
        last_name: 'Doe',
        date_of_birth: new Date('1990-01-01'),
        email: 'jane.doe@example.com',
        primary_phone: JSON.stringify({ type: 'MOBILE', number: '555-0100', canReceiveSMS: true }),
        primary_address: JSON.stringify({ type: 'HOME', line1: '123 Main St', city: 'Austin', state: 'TX', postalCode: '78701', country: 'US' }),
        emergency_contacts: JSON.stringify([]),
        employment_type: 'FULL_TIME',
        employment_status: 'ACTIVE',
        hire_date: new Date('2023-01-01'),
        role: 'CAREGIVER',
        permissions: [],
        credentials: JSON.stringify([]),
        training: JSON.stringify([]),
        skills: JSON.stringify([]),
        specializations: [],
        languages: ['English'],
        availability: JSON.stringify({ schedule: {}, lastUpdated: new Date() }),
        compliance_status: 'COMPLIANT',
        preferred_clients: [],
        restricted_clients: [],
        status: 'ACTIVE',
        created_at: new Date(),
        created_by: 'system',
        updated_at: new Date(),
        updated_by: 'system',
        version: 1,
        deleted_at: null,
        deleted_by: null,
      };

      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [mockCaregiverRow],
        command: '',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await repository.findByEmailAndOrganization('jane.doe@example.com', 'org-123');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('cg-1');
      expect(result?.organizationId).toBe('org-123');

      const [sql, params] = vi.mocked(mockDb.query).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('LOWER(email) = LOWER($1)');
      expect(sql).toContain('organization_id = $2');
      expect(sql).toContain('deleted_at IS NULL');
      expect(params).toEqual(['jane.doe@example.com', 'org-123']);
    });

    it('returns null when no matching record in org', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [],
        command: '',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      const result = await repository.findByEmailAndOrganization('jane.doe@example.com', 'org-other');
      expect(result).toBeNull();
    });
  });
});
