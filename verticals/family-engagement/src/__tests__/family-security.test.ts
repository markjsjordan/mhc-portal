/**
 * Family member security check tests for thread viewing/messaging.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FamilyEngagementService } from '../services/family-engagement-service.js';
import type { UserContext } from '@folkcare/core';

const THREAD = {
  id: 'thread-1',
  familyMemberId: 'fam-1',
  clientId: 'client-1',
  branchId: 'branch-1',
  organizationId: 'org-1',
};

function familyCtx(userId: string): UserContext {
  return {
    userId,
    organizationId: 'org-1',
    roles: ['FAMILY'],
    branchIds: [],
    permissions: [],
  } as UserContext;
}

describe('FamilyEngagementService family security', () => {
  let service: FamilyEngagementService;
  let messageRepo: any;
  let familyMemberRepo: any;

  beforeEach(() => {
    messageRepo = {
      getThreadsForFamilyMember: vi.fn().mockResolvedValue([THREAD]),
      getThreadByIdForOrganization: vi.fn().mockResolvedValue(THREAD),
      getMessagesInThread: vi.fn().mockResolvedValue([]),
    };
    familyMemberRepo = {
      findById: vi.fn().mockResolvedValue({ id: 'fam-1', userId: 'user-fam-1', portalAccessStatus: 'ACTIVE' }),
    };

    service = new FamilyEngagementService(
      familyMemberRepo,
      {} as any,
      {} as any,
      messageRepo,
      { hasPermission: vi.fn().mockReturnValue(true) } as any,
      {} as any,
      {} as any,
      {} as any
    );
  });

  it('allows family user to view their own threads when familyMemberIds includes id', async () => {
    const ctx = {
      ...familyCtx('user-fam-1'),
      familyMemberIds: ['fam-1'],
    };
    const res = await service.getThreadsForFamilyMember('fam-1', ctx);
    expect(res).toBeDefined();
  });

  it('allows family user to view their own threads when linked via family member record userId and ACTIVE', async () => {
    const res = await service.getThreadsForFamilyMember('fam-1', familyCtx('user-fam-1'));
    expect(res).toBeDefined();
  });

  it('denies family user when family member has NULL user_id', async () => {
    familyMemberRepo.findById.mockResolvedValueOnce({
      id: 'fam-null-user',
      userId: null,
      portalAccessStatus: 'ACTIVE',
    });

    await expect(
      service.getThreadsForFamilyMember('fam-null-user', familyCtx('some-user'))
    ).rejects.toThrow('permissions');
  });

  it('denies family user when family member portalAccessStatus is REVOKED', async () => {
    familyMemberRepo.findById.mockResolvedValueOnce({
      id: 'fam-revoked',
      userId: 'user-fam-1',
      portalAccessStatus: 'REVOKED',
    });

    await expect(
      service.getThreadsForFamilyMember('fam-revoked', familyCtx('user-fam-1'))
    ).rejects.toThrow('permissions');
  });

  it('rejects family user attempting to view threads of another family member', async () => {
    await expect(
      service.getThreadsForFamilyMember('fam-1', familyCtx('other-user'))
    ).rejects.toThrow('permissions');
  });

  it('rejects family user attempting to access a thread belonging to another family member', async () => {
    await expect(
      service.getMessagesInThread('thread-1', familyCtx('other-user'))
    ).rejects.toThrow('not found');
  });
});
