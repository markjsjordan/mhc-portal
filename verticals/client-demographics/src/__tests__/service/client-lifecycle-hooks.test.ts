import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientService, ClientStatusHook } from '../../service/client-service.js';
import { ClientImportService } from '../../service/client-import-service.js';
import { ClientRepository } from '../../repository/client-repository.js';
import type { Database, UserContext } from '@folkcare/core';
import type { Client } from '../../types/client.js';

vi.mock('@folkcare/core/service/cache.service', () => ({
  getCacheService: () => ({
    getOrSet: vi.fn(async (_key: string, fetcher: () => Promise<unknown>) => fetcher()),
    del: vi.fn().mockResolvedValue(undefined),
    delPattern: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('Client Lifecycle Hooks', () => {
  let mockDb: Database;
  let mockContext: UserContext;
  let mockHook: ClientStatusHook;
  let mockRepo: ClientRepository;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    } as unknown as Database;

    mockRepo = new ClientRepository(mockDb);

    mockContext = {
      userId: 'user-admin',
      organizationId: 'org-123',
      branchIds: ['branch-123'],
      roles: ['ORG_ADMIN'],
      permissions: ['clients:read', 'clients:update', 'clients:create'],
    };

    mockHook = {
      handleClientStatusChange: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe('ClientService status hook', () => {
    it('fires the hook when client is DISCHARGED via updateClient', async () => {
      const service = new ClientService(mockRepo, undefined, mockHook);
      const existing: Partial<Client> = {
        id: 'client-1',
        organizationId: 'org-123',
        status: 'ACTIVE',
        firstName: 'Alice',
        lastName: 'Smith',
      };

      vi.spyOn(service, 'getClientById').mockResolvedValue(existing as Client);
      vi.spyOn(mockRepo, 'update').mockResolvedValue({
        ...existing,
        status: 'DISCHARGED',
      } as Client);

      await service.updateClient('client-1', { status: 'DISCHARGED' }, mockContext);

      expect(mockHook.handleClientStatusChange).toHaveBeenCalledTimes(1);
      expect(mockHook.handleClientStatusChange).toHaveBeenCalledWith(
        'client-1',
        'ACTIVE',
        'DISCHARGED',
        mockContext
      );
    });

    it('fires the hook when client is DISCHARGED via updateClientStatus', async () => {
      const service = new ClientService(mockRepo, undefined, mockHook);
      const existing: Partial<Client> = {
        id: 'client-1',
        organizationId: 'org-123',
        status: 'ACTIVE',
        firstName: 'Alice',
        lastName: 'Smith',
        notes: '',
      };

      vi.spyOn(service, 'getClientById').mockResolvedValue(existing as Client);
      vi.spyOn(mockRepo, 'update').mockResolvedValue({
        ...existing,
        status: 'DISCHARGED',
      } as Client);

      await service.updateClientStatus('client-1', 'DISCHARGED', mockContext, 'Service completed');

      expect(mockHook.handleClientStatusChange).toHaveBeenCalledTimes(1);
      expect(mockHook.handleClientStatusChange).toHaveBeenCalledWith(
        'client-1',
        'ACTIVE',
        'DISCHARGED',
        mockContext
      );
    });

    it('does NOT fire the hook when status is unchanged', async () => {
      const service = new ClientService(mockRepo, undefined, mockHook);
      const existing: Partial<Client> = {
        id: 'client-1',
        organizationId: 'org-123',
        status: 'ACTIVE',
        firstName: 'Alice',
        lastName: 'Smith',
      };

      vi.spyOn(service, 'getClientById').mockResolvedValue(existing as Client);
      vi.spyOn(mockRepo, 'update').mockResolvedValue(existing as Client);

      await service.updateClient('client-1', { firstName: 'Alice Updated' }, mockContext);

      expect(mockHook.handleClientStatusChange).not.toHaveBeenCalled();

      await service.updateClient('client-1', { status: 'ACTIVE' }, mockContext);
      expect(mockHook.handleClientStatusChange).not.toHaveBeenCalled();
    });
  });

  describe('ClientImportService status hook', () => {
    it('fires the hook when import updates status of existing client', async () => {
      const importService = new ClientImportService(mockDb, mockHook);
      const existingClient: Partial<Client> = {
        id: 'client-import-1',
        organizationId: 'org-123',
        firstName: 'Bob',
        lastName: 'Jones',
        dateOfBirth: new Date('1950-01-01T00:00:00.000Z'),
        status: 'ACTIVE',
      };

      vi.spyOn(ClientRepository.prototype, 'search').mockResolvedValue({
        items: [existingClient as Client],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      vi.spyOn(ClientRepository.prototype, 'update').mockResolvedValue({
        ...existingClient,
        status: 'DISCHARGED',
      } as Client);

      const csvRecord = {
        first_name: 'Bob',
        last_name: 'Jones',
        date_of_birth: '1950-01-01',
        branch_id: '11111111-1111-4111-8111-111111111111',
        address_line1: '456 Oak St',
        address_city: 'Austin',
        address_state: 'TX',
        address_postal_code: '78701',
        status: 'DISCHARGED',
      };

      await importService.import(
        [csvRecord],
        {
          userId: mockContext.userId,
          organizationId: mockContext.organizationId ?? 'org-123',
          updateExisting: true,
        }
      );

      expect(mockHook.handleClientStatusChange).toHaveBeenCalledTimes(1);
      expect(mockHook.handleClientStatusChange).toHaveBeenCalledWith(
        'client-import-1',
        'ACTIVE',
        'DISCHARGED',
        expect.objectContaining({
          userId: mockContext.userId,
          organizationId: mockContext.organizationId,
        })
      );
    });
  });
});
