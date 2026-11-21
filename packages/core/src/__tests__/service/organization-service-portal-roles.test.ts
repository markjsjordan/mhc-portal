import { describe, it, expect, vi } from 'vitest';
import { OrganizationService } from '../../service/organization-service';
import { ValidationError } from '../../types/base';
import type { Database } from '../../db/connection';

function build() {
  const svc = new OrganizationService({} as Database);
  const userRepo = {
    updateUser: vi.fn(),
    getUserByEmail: vi.fn().mockResolvedValue(null),
    createInviteToken: vi.fn().mockResolvedValue({ id: 'tok' }),
  };
  const orgRepo = { getOrganizationById: vi.fn().mockResolvedValue({ id: 'o' }) };
  Object.assign(svc as unknown as Record<string, unknown>, { userRepo, orgRepo });
  vi.spyOn(svc, 'getOrganizationById').mockResolvedValue({ id: 'o' } as never);
  return { svc, userRepo };
}

describe('portal-derived roles cannot be assigned as team roles (wdvf3acxk6 / wdvf3adczm)', () => {
  it.each(['FAMILY', 'CLIENT'])('updateOrganizationUser rejects %s and names the portal invite flow', async (role) => {
    const { svc, userRepo } = build();
    await expect(
      svc.updateOrganizationUser('o', 'u', { roles: [role as never] }, 'admin')
    ).rejects.toThrow(/Invite to portal/);
    await expect(
      svc.updateOrganizationUser('o', 'u', { roles: [role as never] }, 'admin')
    ).rejects.toBeInstanceOf(ValidationError);
    expect(userRepo.updateUser).not.toHaveBeenCalled();
  });

  it('createInvitation rejects FAMILY for a staff invite', async () => {
    const { svc, userRepo } = build();
    await expect(
      svc.createInvitation('o', { email: 'a@b.com', roles: ['FAMILY' as never] }, 'admin')
    ).rejects.toBeInstanceOf(ValidationError);
    expect(userRepo.createInviteToken).not.toHaveBeenCalled();
  });

  it('allows CAREGIVER for team invites and member edits (wdvf3adczm)', async () => {
    const { svc, userRepo } = build();
    userRepo.updateUser.mockResolvedValue({
      id: 'u',
      firstName: 'a',
      lastName: 'b',
      email: 'a@b.com',
      roles: ['CAREGIVER'],
      status: 'ACTIVE',
    });
    await expect(
      svc.createInvitation('o', { email: 'cg@b.com', roles: ['CAREGIVER' as never] }, 'admin')
    ).resolves.toBeTruthy();
    await expect(
      svc.updateOrganizationUser('o', 'u', { roles: ['CAREGIVER' as never] }, 'admin')
    ).resolves.toBeTruthy();
  });

  it('allows staff roles', async () => {
    const { svc, userRepo } = build();
    userRepo.updateUser.mockResolvedValue({ id: 'u', firstName: 'a', lastName: 'b', email: 'a@b.com', roles: ['COORDINATOR'], status: 'ACTIVE' });
    await expect(svc.updateOrganizationUser('o', 'u', { roles: ['COORDINATOR' as never] }, 'admin')).resolves.toBeTruthy();
  });

  describe('getStaffOptions (wdvf3ad5fr)', () => {
    it.each(['COORDINATOR', 'ORG_ADMIN', 'NURSE_RN', 'CAREGIVER'])(
      'allows %s and returns only active staff with { id, firstName, lastName }',
      async (role) => {
        const { svc, userRepo } = build();
        (userRepo as { getUsersByOrganization?: ReturnType<typeof vi.fn> }).getUsersByOrganization = vi.fn().mockResolvedValue([
          { id: 's-1', firstName: 'Sarah', lastName: 'Miller', email: 'sarah@org.com', roles: ['COORDINATOR'], status: 'ACTIVE' },
          { id: 's-2', firstName: 'Bob', lastName: 'Inactive', email: 'bob@org.com', roles: ['COORDINATOR'], status: 'INACTIVE' },
          { id: 'f-1', firstName: 'Fam', lastName: 'User', email: 'fam@org.com', roles: ['FAMILY'], status: 'ACTIVE' },
          { id: 'c-1', firstName: 'Cli', lastName: 'User', email: 'cli@org.com', roles: ['CLIENT'], status: 'ACTIVE' },
        ]);

        const result = await svc.getStaffOptions('o', {
          userId: 'u-1',
          organizationId: 'o',
          roles: [role as never],
          permissions: [],
          branchIds: [],
        });

        expect(result).toEqual([{ id: 's-1', firstName: 'Sarah', lastName: 'Miller' }]);
        expect(Object.keys(result[0]!).sort((a, b) => a.localeCompare(b))).toEqual(['firstName', 'id', 'lastName']);
      }
    );

    it.each(['BILLING', 'SCHEDULER', 'FAMILY', 'CLIENT'])(
      'throws PermissionError for %s',
      async (role) => {
        const { svc } = build();
        await expect(
          svc.getStaffOptions('o', {
            userId: 'u-1',
            organizationId: 'o',
            roles: [role as never],
            permissions: [],
            branchIds: [],
          })
        ).rejects.toThrow(/Permission denied/);
      }
    );
  });
});
