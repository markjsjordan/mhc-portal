/**
 * HIPAA-003: ClientService Tenant Isolation & Minimum-Necessary RBAC Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PermissionError, ValidationError, UserContext } from '@folkcare/core';
import { ClientService } from '../../service/client-service';
import { ClientRepository } from '../../repository/client-repository';
import { Client } from '../../types/client';

vi.mock('@folkcare/core/service/cache.service', () => ({
  getCacheService: () => ({
    getOrSet: vi.fn(async (_key: string, fetcher: () => Promise<unknown>) => fetcher()),
    del: vi.fn().mockResolvedValue(undefined),
    delPattern: vi.fn().mockResolvedValue(undefined),
  }),
}));

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const BRANCH_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function createFixtureClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-org-a',
    organizationId: ORG_A,
    branchId: BRANCH_A,
    clientNumber: 'CL-001',
    firstName: 'Jane',
    lastName: 'Doe',
    dateOfBirth: new Date('1950-05-15T00:00:00.000Z'),
    ssn: '123-45-6789',
    primaryAddress: {
      type: 'HOME',
      line1: '100 Main St',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      country: 'US',
    },
    emergencyContacts: [],
    authorizedContacts: [],
    programs: [],
    serviceEligibility: {
      medicaidEligible: true,
      medicareEligible: true,
      veteransBenefits: false,
      longTermCareInsurance: false,
      privatePayOnly: false,
    },
    insurance: [
      {
        id: 'ins-1',
        type: 'PRIMARY',
        provider: 'Texas Medicaid',
        policyNumber: 'MED-999999',
        subscriberName: 'Jane Doe',
        subscriberRelationship: 'SELF',
        effectiveDate: new Date('2025-01-01T00:00:00.000Z'),
      },
    ],
    fundingSources: [
      {
        id: 'fund-1',
        type: 'MEDICAID',
        name: 'STAR+PLUS',
        priority: 1,
        accountNumber: 'AUTH-12345',
        authorizedUnits: 120,
        effectiveDate: new Date('2025-01-01T00:00:00.000Z'),
      },
    ],
    riskFlags: [],
    status: 'ACTIVE',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    createdBy: 'user-admin',
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedBy: 'user-admin',
    version: 1,
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  };
}

describe('ClientService - HIPAA-003 Tenant Isolation & Minimum-Necessary RBAC', () => {
  let mockRepo: {
    findById: ReturnType<typeof vi.fn>;
    findByClientNumber: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
    findByBranch: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let service: ClientService;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findByClientNumber: vi.fn(),
      search: vi.fn(),
      findByBranch: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    service = new ClientService(mockRepo as unknown as ClientRepository);
  });

  describe('Cross-Tenant Access Prevention (IDOR)', () => {
    const userOrgA: UserContext = {
      userId: 'user-a',
      organizationId: ORG_A,
      branchIds: [BRANCH_A],
      roles: ['ORG_ADMIN'],
      permissions: ['clients:read', 'clients:update', 'clients:delete'],
    };

    it('rejects reading a client belonging to Organization B with PermissionError (403)', async () => {
      const clientOrgB = createFixtureClient({ id: 'client-org-b', organizationId: ORG_B });
      mockRepo.findById.mockResolvedValue(clientOrgB);

      await expect(service.getClientById('client-org-b', userOrgA)).rejects.toThrow(
        PermissionError
      );
    });

    it('rejects updating a client belonging to Organization B with PermissionError (403)', async () => {
      const clientOrgB = createFixtureClient({ id: 'client-org-b', organizationId: ORG_B });
      mockRepo.findById.mockResolvedValue(clientOrgB);

      await expect(
        service.updateClient('client-org-b', { firstName: 'Tampered' }, userOrgA)
      ).rejects.toThrow(PermissionError);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('rejects deleting a client belonging to Organization B with PermissionError (403)', async () => {
      const clientOrgB = createFixtureClient({ id: 'client-org-b', organizationId: ORG_B });
      mockRepo.findById.mockResolvedValue(clientOrgB);

      await expect(service.deleteClient('client-org-b', userOrgA)).rejects.toThrow(
        PermissionError
      );
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('rejects getClientByNumber when caller passes Organization B ID', async () => {
      await expect(
        service.getClientByNumber('CL-001', ORG_B, userOrgA)
      ).rejects.toThrow(PermissionError);
      expect(mockRepo.findByClientNumber).not.toHaveBeenCalled();
    });
  });

  describe('Minimum-Necessary RBAC Field Filtering', () => {
    const caregiverContext: UserContext = {
      userId: 'caregiver-1',
      organizationId: ORG_A,
      branchIds: [BRANCH_A],
      roles: ['CAREGIVER'],
      permissions: ['clients:read'],
    };

    const billingContext: UserContext = {
      userId: 'billing-1',
      organizationId: ORG_A,
      branchIds: [BRANCH_A],
      roles: ['BILLING'],
      permissions: ['clients:read', 'billing:*'],
    };

    it('strips ssn, insurance, and fundingSources for CAREGIVER on getClientById', async () => {
      mockRepo.findById.mockResolvedValue(createFixtureClient());

      const result = await service.getClientById('client-org-a', caregiverContext);

      expect(result.id).toBe('client-org-a');
      expect(result.firstName).toBe('Jane');
      expect(result.ssn).toBeUndefined();
      expect(result.insurance).toBeUndefined();
      expect(result.fundingSources).toBeUndefined();
    });

    it('strips ssn, insurance, and fundingSources for CAREGIVER on searchClients', async () => {
      mockRepo.search.mockResolvedValue({
        items: [createFixtureClient()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const result = await service.searchClients({}, { page: 1, limit: 20 }, caregiverContext);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.ssn).toBeUndefined();
      expect(result.items[0]?.insurance).toBeUndefined();
      expect(result.items[0]?.fundingSources).toBeUndefined();
    });

    it('retains ssn, insurance, and fundingSources for BILLING / ORG_ADMIN roles', async () => {
      mockRepo.findById.mockResolvedValue(createFixtureClient());

      const result = await service.getClientById('client-org-a', billingContext);

      expect(result.ssn).toBe('123-45-6789');
      expect(result.insurance).toHaveLength(1);
      expect(result.fundingSources).toHaveLength(1);
    });
  });

  describe('Manual Client Status Management RBAC & Validation', () => {
    const adminRoles = ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'ADMIN'] as const;

    for (const role of adminRoles) {
      it(`allows ${role} to update client status via updateClientStatus`, async () => {
        const ctx: UserContext = {
          userId: `user-${role.toLowerCase()}`,
          organizationId: ORG_A,
          branchIds: [BRANCH_A],
          roles: [role],
          permissions: ['clients:read', 'clients:update'],
        };
        const existing = createFixtureClient({ status: 'ACTIVE' });
        mockRepo.findById.mockResolvedValue(existing);
        mockRepo.update.mockResolvedValue({ ...existing, status: 'ON_HOLD' });

        const updated = await service.updateClientStatus('client-org-a', 'ON_HOLD', ctx);
        expect(updated.status).toBe('ON_HOLD');
      });
    }

    it('rejects COORDINATOR calling updateClientStatus with PermissionError (403)', async () => {
      const coordinatorCtx: UserContext = {
        userId: 'user-coord',
        organizationId: ORG_A,
        branchIds: [BRANCH_A],
        roles: ['COORDINATOR'],
        permissions: ['clients:read', 'clients:update'],
      };

      await expect(
        service.updateClientStatus('client-org-a', 'INACTIVE', coordinatorCtx)
      ).rejects.toThrow(PermissionError);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('rejects CAREGIVER calling updateClientStatus with PermissionError (403)', async () => {
      const caregiverCtx: UserContext = {
        userId: 'user-cg',
        organizationId: ORG_A,
        branchIds: [BRANCH_A],
        roles: ['CAREGIVER'],
        permissions: ['clients:read'],
      };

      await expect(
        service.updateClientStatus('client-org-a', 'INACTIVE', caregiverCtx)
      ).rejects.toThrow(PermissionError);
    });

    it('rejects PENDING_INTAKE and INQUIRY with ValidationError (400)', async () => {
      const adminCtx: UserContext = {
        userId: 'user-admin',
        organizationId: ORG_A,
        branchIds: [BRANCH_A],
        roles: ['ADMIN'],
        permissions: ['clients:read', 'clients:update'],
      };

      await expect(
        service.updateClientStatus('client-org-a', 'PENDING_INTAKE', adminCtx)
      ).rejects.toThrow(ValidationError);

      await expect(
        service.updateClientStatus('client-org-a', 'INQUIRY', adminCtx)
      ).rejects.toThrow(ValidationError);
    });

    it('blocks COORDINATOR from changing status via updateClient except PENDING_INTAKE -> ACTIVE', async () => {
      const coordinatorCtx: UserContext = {
        userId: 'user-coord',
        organizationId: ORG_A,
        branchIds: [BRANCH_A],
        roles: ['COORDINATOR'],
        permissions: ['clients:read', 'clients:update'],
      };

      // Non-intake status change is blocked
      const activeClient = createFixtureClient({ status: 'ACTIVE' });
      mockRepo.findById.mockResolvedValue(activeClient);
      await expect(
        service.updateClient('client-org-a', { status: 'DISCHARGED' }, coordinatorCtx)
      ).rejects.toThrow(PermissionError);

      // Intake auto-promotion PENDING_INTAKE -> ACTIVE is allowed
      const pendingClient = createFixtureClient({ status: 'PENDING_INTAKE' });
      mockRepo.findById.mockResolvedValue(pendingClient);
      mockRepo.update.mockResolvedValue({ ...pendingClient, status: 'ACTIVE' });
      const promoted = await service.updateClient('client-org-a', { status: 'ACTIVE' }, coordinatorCtx);
      expect(promoted.status).toBe('ACTIVE');
    });
  });
});
