/**
 * Organization Service Tests
 *
 * Verifies invitation workflows including caregiver account linking.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrganizationService } from '../organization-service.js';
import * as emailServiceModule from '../email-service.js';
import type { Database } from '../../db/connection.js';
import type { AcceptInviteRequest } from '../../types/organization.js';

describe('OrganizationService - Invitation Accept (Caregiver Linking)', () => {
  let service: OrganizationService;
  let mockDb: Database;

  const sampleInviteToken = {
    id: 'invite-123',
    token: 'token-abc',
    email: 'caregiver@example.com',
    roles: ['CAREGIVER'],
    branchIds: ['branch-1'],
    createdBy: 'admin-1',
    status: 'PENDING',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      query: vi.fn(),
      transaction: vi.fn(async (callback) => {
        return await callback(mockDb);
      }),
    } as unknown as Database;

    service = new OrganizationService(mockDb);
  });

  const setupBaseMocks = (roles: string[] = ['CAREGIVER']) => {
    vi.spyOn(service, 'getInvitationDetails').mockResolvedValue({
      token: 'token-abc',
      organizationId: 'org-123',
      organizationName: 'Test Org',
      email: 'caregiver@example.com',
      firstName: 'Jane',
      lastName: 'Caregiver',
      roles: roles as any,
      isValid: true,
      expiresAt: new Date(Date.now() + 86400000),
    });

    (service as any).userRepo.getInviteByToken = vi.fn().mockResolvedValue({
      ...sampleInviteToken,
      roles,
    });

    (service as any).userRepo.createUser = vi.fn().mockResolvedValue({
      id: 'new-user-123',
      organizationId: 'org-123',
      email: 'caregiver@example.com',
      username: 'caregiver_user',
      roles,
      branchIds: ['branch-1'],
      status: 'ACTIVE',
    });

    (service as any).userRepo.acceptInviteToken = vi.fn().mockResolvedValue(undefined);
  };

  const acceptRequest: AcceptInviteRequest = {
    token: 'token-abc',
    firstName: 'Jane',
    lastName: 'Caregiver',
    // eslint-disable-next-line sonarjs/no-hardcoded-passwords
    password: 'Password123!Secure',
    phone: '555-0100',
  };

  it('CAREGIVER accept with exactly one matching caregiver links user_id', async () => {
    setupBaseMocks(['CAREGIVER']);

    vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM caregivers') && sql.includes('organization_id = $1')) {
        return {
          rows: [{ id: 'cg-single-match' }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        };
      }
      if (typeof sql === 'string' && sql.includes('UPDATE caregivers SET user_id = $1')) {
        return {
          rows: [],
          rowCount: 1,
          command: 'UPDATE',
          oid: 0,
          fields: [],
        };
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });

    const userId = await service.acceptInvitation(acceptRequest);

    expect(userId).toBe('new-user-123');

    // Verify caregivers table was queried with organizationId and email
    const calls = vi.mocked(mockDb.query).mock.calls;
    const selectCall = calls.find((c) => typeof c[0] === 'string' && c[0].includes('FROM caregivers'));
    expect(selectCall).toBeDefined();
    expect(selectCall?.[1]).toEqual(['org-123', 'caregiver@example.com']);

    // Verify update query linked user_id
    const updateCall = calls.find((c) => typeof c[0] === 'string' && c[0].includes('UPDATE caregivers SET user_id = $1'));
    expect(updateCall).toBeDefined();
    expect(updateCall?.[1]).toEqual(['new-user-123', 'cg-single-match']);
  });

  it('zero matches creates no row and links nothing', async () => {
    setupBaseMocks(['CAREGIVER']);

    vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM caregivers')) {
        return { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] };
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });

    const userId = await service.acceptInvitation(acceptRequest);

    expect(userId).toBe('new-user-123');

    const calls = vi.mocked(mockDb.query).mock.calls;
    const updateCall = calls.find((c) => typeof c[0] === 'string' && c[0].includes('UPDATE caregivers'));
    const insertCall = calls.find((c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO caregivers'));

    expect(updateCall).toBeUndefined();
    expect(insertCall).toBeUndefined();
  });

  it('two matches links nothing and logs a warning', async () => {
    setupBaseMocks(['CAREGIVER']);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM caregivers')) {
        return {
          rows: [{ id: 'cg-1' }, { id: 'cg-2' }],
          rowCount: 2,
          command: 'SELECT',
          oid: 0,
          fields: [],
        };
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });

    const userId = await service.acceptInvitation(acceptRequest);

    expect(userId).toBe('new-user-123');

    const calls = vi.mocked(mockDb.query).mock.calls;
    const updateCall = calls.find((c) => typeof c[0] === 'string' && c[0].includes('UPDATE caregivers'));
    expect(updateCall).toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
    const warnMessage = warnSpy.mock.calls[0]?.[0] as string;
    expect(warnMessage).toContain('Multiple unlinked caregiver rows (2)');

    warnSpy.mockRestore();
  });

  it('non-caregiver role does not touch caregivers table', async () => {
    setupBaseMocks(['COORDINATOR']);

    vi.mocked(mockDb.query).mockResolvedValue({
      rows: [],
      rowCount: 0,
      command: '',
      oid: 0,
      fields: [],
    });

    const userId = await service.acceptInvitation(acceptRequest);

    expect(userId).toBe('new-user-123');

    const calls = vi.mocked(mockDb.query).mock.calls;
    const caregiverQuery = calls.find((c) => typeof c[0] === 'string' && c[0].includes('caregivers'));
    expect(caregiverQuery).toBeUndefined();
  });
});

describe('OrganizationService - resendInvitation', () => {
  let service: OrganizationService;
  let mockDb: Database;
  let mockSendInvitation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      query: vi.fn(),
      transaction: vi.fn(async (callback) => {
        return await callback(mockDb);
      }),
    } as unknown as Database;

    service = new OrganizationService(mockDb);
    mockSendInvitation = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(emailServiceModule, 'createEmailService').mockReturnValue({
      sendInvitation: mockSendInvitation,
    } as unknown as emailServiceModule.EmailService);
  });

  it('extends token expiry and dispatches invitation email with organization and inviter context', async () => {
    const invite = {
      id: 'invite-1',
      token: 'tok-resend-123',
      organizationId: 'org-1',
      email: 'newuser@example.com',
      firstName: 'Alex',
      lastName: 'Morgan',
      roles: ['COORDINATOR'],
      branchIds: [],
      expiresAt: new Date('2026-01-01T00:00:00Z'),
      status: 'PENDING',
      acceptedUserId: null,
      acceptedAt: null,
    };

    (service as any).userRepo.getOrganizationInvites = vi.fn().mockResolvedValue([invite]);
    (service as any).userRepo.resendInviteToken = vi.fn().mockResolvedValue(undefined);
    (service as any).organizationRepo.getOrganizationById = vi.fn().mockResolvedValue({
      id: 'org-1',
      name: 'Sunrise Home Health',
    });
    (service as any).userRepo.getUserById = vi.fn().mockResolvedValue({
      id: 'admin-1',
      firstName: 'Jordan',
      lastName: 'Admin',
    });

    await service.resendInvitation('invite-1', 'org-1', 'admin-1');

    expect((service as any).userRepo.resendInviteToken).toHaveBeenCalledWith('invite-1', 'org-1', 'admin-1');
    expect(mockSendInvitation).toHaveBeenCalledTimes(1);
    expect(mockSendInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'newuser@example.com',
        recipientName: 'Alex Morgan',
        inviterName: 'Jordan Admin',
        organizationName: 'Sunrise Home Health',
        invitationToken: 'tok-resend-123',
        expiresAt: expect.any(Date),
      })
    );
  });

  it('falls back gracefully when organization or resender details are missing', async () => {
    const invite = {
      id: 'invite-2',
      token: 'tok-resend-456',
      organizationId: 'org-2',
      email: 'noname@example.com',
      firstName: null,
      lastName: null,
      roles: ['CAREGIVER'],
      branchIds: [],
      expiresAt: new Date('2026-01-01T00:00:00Z'),
      status: 'PENDING',
      acceptedUserId: null,
      acceptedAt: null,
    };

    (service as any).userRepo.getOrganizationInvites = vi.fn().mockResolvedValue([invite]);
    (service as any).userRepo.resendInviteToken = vi.fn().mockResolvedValue(undefined);
    (service as any).organizationRepo.getOrganizationById = vi.fn().mockResolvedValue(null);
    (service as any).userRepo.getUserById = vi.fn().mockResolvedValue(null);

    await service.resendInvitation('invite-2', 'org-2', 'missing-admin');

    expect(mockSendInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'noname@example.com',
        inviterName: 'An administrator',
        organizationName: 'MHC Portal',
        invitationToken: 'tok-resend-456',
        expiresAt: expect.any(Date),
      })
    );
    expect(mockSendInvitation.mock.calls[0]?.[0]).not.toHaveProperty('recipientName');
  });

  it('throws NotFoundError and does not send email when invitation does not exist', async () => {
    (service as any).userRepo.getOrganizationInvites = vi.fn().mockResolvedValue([]);

    await expect(service.resendInvitation('missing-id', 'org-1', 'admin-1')).rejects.toThrow(
      'Invitation not found'
    );
    expect(mockSendInvitation).not.toHaveBeenCalled();
  });

  it('throws ValidationError and does not send email when invitation is not PENDING', async () => {
    (service as any).userRepo.getOrganizationInvites = vi.fn().mockResolvedValue([
      {
        id: 'invite-accepted',
        token: 'tok-accepted',
        organizationId: 'org-1',
        email: 'accepted@example.com',
        firstName: 'Sam',
        lastName: 'User',
        roles: ['CAREGIVER'],
        branchIds: [],
        expiresAt: new Date('2026-01-01T00:00:00Z'),
        status: 'ACCEPTED',
        acceptedUserId: 'user-1',
        acceptedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);

    await expect(service.resendInvitation('invite-accepted', 'org-1', 'admin-1')).rejects.toThrow(
      'Only pending invitations can be resent'
    );
    expect(mockSendInvitation).not.toHaveBeenCalled();
  });
});
