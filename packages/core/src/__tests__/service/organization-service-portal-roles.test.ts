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

describe('portal-derived roles cannot be assigned as team roles (wdvf3acxk6)', () => {
  it.each(['CAREGIVER', 'FAMILY', 'CLIENT'])('updateOrganizationUser rejects %s and names the portal invite flow', async (role) => {
    const { svc, userRepo } = build();
    await expect(
      svc.updateOrganizationUser('o', 'u', { roles: [role as never] }, 'admin')
    ).rejects.toThrow(/Invite to portal/);
    await expect(
      svc.updateOrganizationUser('o', 'u', { roles: [role as never] }, 'admin')
    ).rejects.toBeInstanceOf(ValidationError);
    expect(userRepo.updateUser).not.toHaveBeenCalled();
  });

  it('createInvitation rejects CAREGIVER for a staff invite', async () => {
    const { svc, userRepo } = build();
    await expect(
      svc.createInvitation('o', { email: 'a@b.com', roles: ['CAREGIVER' as never] }, 'admin')
    ).rejects.toBeInstanceOf(ValidationError);
    expect(userRepo.createInviteToken).not.toHaveBeenCalled();
  });

  it('allows staff roles', async () => {
    const { svc, userRepo } = build();
    userRepo.updateUser.mockResolvedValue({ id: 'u', firstName: 'a', lastName: 'b', email: 'a@b.com', roles: ['COORDINATOR'], status: 'ACTIVE' });
    await expect(svc.updateOrganizationUser('o', 'u', { roles: ['COORDINATOR' as never] }, 'admin')).resolves.toBeTruthy();
  });
});
