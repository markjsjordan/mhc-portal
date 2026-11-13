/**
 * wdvf3acxjt: CLIENT role per-client scoping (HIPAA minimum necessary).
 * A CLIENT portal user may read ONLY their own client record.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PermissionError, NotFoundError, UserContext } from '@folkcare/core';
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

const ORG = '11111111-1111-4111-8111-111111111111';
const BRANCH = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function fixture(id: string, over: Partial<Client> = {}): Client {
  return {
    id,
    organizationId: ORG,
    branchId: BRANCH,
    clientNumber: `CL-${id}`,
    firstName: id === 'client-own' ? 'Own' : 'Other',
    lastName: 'Person',
    dateOfBirth: new Date('1950-05-15T00:00:00.000Z'),
    ssn: '123-45-6789',
    primaryAddress: { type: 'HOME', line1: '1 Main', city: 'Austin', state: 'TX', postalCode: '78701', country: 'US' },
    emergencyContacts: [],
    authorizedContacts: [],
    programs: [],
    serviceEligibility: {
      medicaidEligible: true,
      medicareEligible: false,
      veteransBenefits: false,
      longTermCareInsurance: false,
      privatePayOnly: false,
    },
    insurance: [],
    fundingSources: [],
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'u',
    updatedBy: 'u',
    deletedAt: null,
    deletedBy: null,
    ...over,
  } as unknown as Client;
}

describe('ClientService - CLIENT role scoping', () => {
  let repo: Record<'findById' | 'findByClientNumber' | 'search' | 'findByBranch' | 'update' | 'delete', ReturnType<typeof vi.fn>>;
  let service: ClientService;
  const own = fixture('client-own');
  const other = fixture('client-other');

  const clientUser: UserContext = {
    userId: 'user-client',
    organizationId: ORG,
    branchIds: [],
    roles: ['CLIENT'],
    permissions: ['clients:read'],
    directClientId: 'client-own',
  };

  beforeEach(() => {
    repo = {
      findById: vi.fn(async (id: string) => (id === 'client-own' ? own : id === 'client-other' ? other : null)),
      findByClientNumber: vi.fn(),
      search: vi.fn(),
      findByBranch: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    service = new ClientService(repo as unknown as ClientRepository);
  });

  it('reads their own record, with SSN/insurance stripped (minimum necessary)', async () => {
    const result = await service.getClientById('client-own', clientUser);
    expect(result.id).toBe('client-own');
    expect(result.ssn).toBeUndefined();
  });

  it("KEY NEGATIVE: cannot read another client's record (same org) - 404, repository never queried", async () => {
    await expect(service.getClientById('client-other', clientUser)).rejects.toThrow(NotFoundError);
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('cannot read another client by guessing a nonexistent id either (indistinguishable 404)', async () => {
    await expect(service.getClientById('does-not-exist', clientUser)).rejects.toThrow(NotFoundError);
  });

  it('fails closed when the CLIENT user has no directClientId in the token', async () => {
    const noLink = { ...clientUser, directClientId: undefined };
    await expect(service.getClientById('client-own', noLink)).rejects.toThrow(NotFoundError);
    await expect(service.searchClients({}, { page: 1, limit: 20 }, noLink)).rejects.toThrow(NotFoundError);
  });

  it('search never runs an org-wide query: returns only their own record', async () => {
    const result = await service.searchClients({}, { page: 1, limit: 50 }, clientUser);
    expect(repo.search).not.toHaveBeenCalled();
    expect(result.items.map((c) => c.id)).toEqual(['client-own']);
    expect(result.total).toBe(1);
  });

  it('getClientByNumber: own number works, another client number is 404', async () => {
    const mine = await service.getClientByNumber('CL-client-own', ORG, clientUser);
    expect(mine.id).toBe('client-own');
    await expect(service.getClientByNumber('CL-client-other', ORG, clientUser)).rejects.toThrow(NotFoundError);
    expect(repo.findByClientNumber).not.toHaveBeenCalled();
  });

  it('cannot list clients by branch', async () => {
    await expect(service.getClientsByBranch(BRANCH, { ...clientUser, branchIds: [BRANCH] })).rejects.toThrow(PermissionError);
    expect(repo.findByBranch).not.toHaveBeenCalled();
  });

  it('cannot mutate or delete (no clients:update / clients:delete from the role map)', async () => {
    const roleOnly: UserContext = { ...clientUser, permissions: [] };
    await expect(service.updateClient('client-own', { firstName: 'X' }, roleOnly)).rejects.toThrow(PermissionError);
    await expect(service.deleteClient('client-own', roleOnly)).rejects.toThrow(PermissionError);
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('a CLIENT user from another organization still cannot read a record in this org', async () => {
    const foreign: UserContext = { ...clientUser, organizationId: '22222222-2222-4222-8222-222222222222' };
    await expect(service.getClientById('client-own', foreign)).rejects.toThrow(PermissionError);
  });

  it('staff (non-CLIENT) are unaffected by self scoping', async () => {
    const staff: UserContext = {
      userId: 's',
      organizationId: ORG,
      branchIds: [],
      roles: ['ORG_ADMIN'],
      permissions: ['clients:read'],
    };
    const r = await service.getClientById('client-other', staff);
    expect(r.id).toBe('client-other');
  });
});
