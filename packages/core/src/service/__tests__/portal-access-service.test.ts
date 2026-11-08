/**
 * PortalAccessService Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { PortalAccessService } from '../portal-access-service.js';
import { Database } from '../../db/connection.js';
import { PermissionService } from '../../permissions/permission-service.js';
import { AuditService } from '../../audit/audit-service.js';
import { UserContext, PermissionError, ValidationError, ConflictError } from '../../types/base.js';

describe('PortalAccessService', () => {
  let service: PortalAccessService;
  let mockDb: Database;
  let mockPermissions: PermissionService;
  let mockAudit: AuditService;
  let mockClientQuery: ReturnType<typeof vi.fn>;
  let mockClient: PoolClient;
  let adminContext: UserContext;

  beforeEach(() => {
    mockClientQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    mockClient = {
      query: mockClientQuery,
      release: vi.fn(),
    } as unknown as PoolClient;

    mockDb = {
      query: vi.fn(),
      transaction: vi.fn().mockImplementation(async (callback: (client: PoolClient) => Promise<unknown>) => {
        return await callback(mockClient);
      }),
    } as unknown as Database;

    mockPermissions = {
      requirePermission: vi.fn(),
      hasPermission: vi.fn().mockReturnValue(true),
    } as unknown as PermissionService;

    mockAudit = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    adminContext = {
      userId: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      roles: ['ORG_ADMIN'],
      permissions: ['caregivers:update', 'clients:update'],
      branchIds: ['33333333-3333-4333-8333-333333333333'],
    };

    service = new PortalAccessService(mockDb, mockPermissions, mockAudit);
  });

  describe('inviteCaregiver', () => {
    it('creates state INVITED plus an invite token even if a user row exists for that email', async () => {
      const caregiverId = '44444444-4444-4444-8444-444444444444';
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [
          {
            id: caregiverId,
            organization_id: adminContext.organizationId,
            email: 'caregiver@example.com',
            first_name: 'Care',
            last_name: 'Giver',
            employment_status: 'ACTIVE',
            deleted_at: null,
          },
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await service.inviteCaregiver(caregiverId, adminContext);

      expect(mockPermissions.requirePermission).toHaveBeenCalledWith(
        adminContext,
        'caregivers:update'
      );
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);

      // Verify transaction queries
      const clientQueries = vi.mocked(mockClientQuery).mock.calls;
      // 1: revoke existing pending tokens
      expect(clientQueries[0]?.[0]).toContain('UPDATE invite_tokens');
      // 2: insert invite token with target_type CAREGIVER, target_id
      expect(clientQueries[1]?.[0]).toContain('INSERT INTO invite_tokens');
      expect(clientQueries[1]?.[1]).toContain('CAREGIVER');
      expect(clientQueries[1]?.[1]).toContain(caregiverId);
      // 3: update caregivers set portal_access_status = 'INVITED'
      expect(clientQueries[2]?.[0]).toContain("portal_access_status = 'INVITED'");

      // Verify audit call
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        adminContext,
        expect.objectContaining({
          eventType: 'PORTAL_INVITATION_SENT',
          resource: 'caregiver',
          resourceId: caregiverId,
          result: 'SUCCESS',
        })
      );
    });

    it('rejects with PermissionError when user lacks caregivers:update', async () => {
      vi.mocked(mockPermissions.requirePermission).mockImplementation(() => {
        throw new PermissionError('Permission denied: caregivers:update');
      });

      await expect(
        service.inviteCaregiver('44444444-4444-4444-8444-444444444444', adminContext)
      ).rejects.toThrow(PermissionError);
    });

    it('rejects when caregiver has employment_status TERMINATED or RETIRED', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [
          {
            id: '44444444-4444-4444-8444-444444444444',
            organization_id: adminContext.organizationId,
            email: 'caregiver@example.com',
            first_name: 'Care',
            last_name: 'Giver',
            employment_status: 'TERMINATED',
            deleted_at: null,
          },
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      await expect(
        service.inviteCaregiver('44444444-4444-4444-8444-444444444444', adminContext)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('inviteFamilyMember', () => {
    it('creates state INVITED plus an invite token for family member and audits event', async () => {
      const familyMemberId = '55555555-5555-4555-8555-555555555555';
      const clientId = '66666666-6666-4666-8666-666666666666';

      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [
          {
            id: familyMemberId,
            client_id: clientId,
            email: 'family@example.com',
            first_name: 'Fam',
            last_name: 'Ily',
            client_organization_id: adminContext.organizationId,
            client_status: 'ACTIVE',
          },
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await service.inviteFamilyMember(familyMemberId, adminContext);

      expect(mockPermissions.requirePermission).toHaveBeenCalledWith(
        adminContext,
        'clients:update'
      );
      expect(result.token).toBeDefined();

      const clientQueries = vi.mocked(mockClientQuery).mock.calls;
      expect(clientQueries[1]?.[0]).toContain('INSERT INTO invite_tokens');
      expect(clientQueries[1]?.[1]).toContain('FAMILY');
      expect(clientQueries[1]?.[1]).toContain(familyMemberId);
      expect(clientQueries[2]?.[0]).toContain("portal_access_status = 'INVITED'");

      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        adminContext,
        expect.objectContaining({
          eventType: 'PORTAL_INVITATION_SENT',
          resource: 'family_member',
          resourceId: familyMemberId,
        })
      );
    });

    it('rejects with PermissionError when user lacks clients:update', async () => {
      vi.mocked(mockPermissions.requirePermission).mockImplementation(() => {
        throw new PermissionError('Permission denied: clients:update');
      });

      await expect(
        service.inviteFamilyMember('55555555-5555-4555-8555-555555555555', adminContext)
      ).rejects.toThrow(PermissionError);
    });
  });

  describe('acceptPortalInvite', () => {
    const inviteToken = 'sample-invite-token-123';
    const targetUserId = '77777777-7777-4777-8777-777777777777';
    const targetCaregiverId = '44444444-4444-4444-8444-444444444444';

    it('accepts invite, sets link ACTIVE, marks token ACCEPTED, and bumps token_version', async () => {
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'token-uuid',
              token: inviteToken,
              organization_id: adminContext.organizationId,
              email: 'caregiver@example.com',
              status: 'PENDING',
              expires_at: new Date('2026-11-08T12:00:00Z'),
              target_type: 'CAREGIVER',
              target_id: targetCaregiverId,
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: targetUserId,
              organization_id: adminContext.organizationId,
              email: 'caregiver@example.com',
              status: 'ACTIVE',
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      vi.mocked(mockClientQuery)
        .mockResolvedValueOnce({
          rows: [
            {
              id: targetCaregiverId,
              user_id: null,
              portal_access_status: 'INVITED',
              employment_status: 'ACTIVE',
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] });

      await service.acceptPortalInvite(inviteToken, targetUserId);

      const clientQueries = vi.mocked(mockClientQuery).mock.calls;
      // Caregiver update: sets user_id and portal_access_status = 'ACTIVE'
      expect(clientQueries[1]?.[0]).toContain("portal_access_status = 'ACTIVE'");
      expect(clientQueries[1]?.[1]).toEqual([targetCaregiverId, targetUserId]);

      // Invite token update: marks ACCEPTED
      expect(clientQueries[2]?.[0]).toContain("status = 'ACCEPTED'");
      expect(clientQueries[2]?.[1]).toEqual(['token-uuid', targetUserId]);

      // Users update: bumps token_version
      expect(clientQueries[3]?.[0]).toContain('token_version = token_version + 1');
      expect(clientQueries[3]?.[1]).toEqual([targetUserId]);

      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ userId: targetUserId }),
        expect.objectContaining({
          eventType: 'PORTAL_INVITATION_ACCEPTED',
          resource: 'caregiver',
          resourceId: targetCaregiverId,
        })
      );
    });

    it('rejects if target record is already linked to a different user', async () => {
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'token-uuid',
              token: inviteToken,
              organization_id: adminContext.organizationId,
              email: 'caregiver@example.com',
              status: 'PENDING',
              expires_at: new Date('2026-11-08T12:00:00Z'),
              target_type: 'CAREGIVER',
              target_id: targetCaregiverId,
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: targetUserId,
              organization_id: adminContext.organizationId,
              email: 'caregiver@example.com',
              status: 'ACTIVE',
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      vi.mocked(mockClientQuery).mockResolvedValueOnce({
        rows: [
          {
            id: targetCaregiverId,
            user_id: '99999999-9999-4999-8999-999999999999',
            portal_access_status: 'INVITED',
            employment_status: 'ACTIVE',
          },
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      await expect(service.acceptPortalInvite(inviteToken, targetUserId)).rejects.toThrow(
        ConflictError
      );
    });

    it('rejects accept when user organization_id does not match invite organization_id', async () => {
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'token-uuid',
              token: inviteToken,
              organization_id: adminContext.organizationId,
              email: 'caregiver@example.com',
              status: 'PENDING',
              expires_at: new Date('2026-11-08T12:00:00Z'),
              target_type: 'CAREGIVER',
              target_id: targetCaregiverId,
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: targetUserId,
              organization_id: '99999999-0000-0000-0000-000000000000',
              email: 'caregiver@example.com',
              status: 'ACTIVE',
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      await expect(service.acceptPortalInvite(inviteToken, targetUserId)).rejects.toThrow(
        PermissionError
      );
    });

    it('rejects accept when user email does not match invite email', async () => {
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'token-uuid',
              token: inviteToken,
              organization_id: adminContext.organizationId,
              email: 'caregiver@example.com',
              status: 'PENDING',
              expires_at: new Date('2026-11-08T12:00:00Z'),
              target_type: 'CAREGIVER',
              target_id: targetCaregiverId,
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: targetUserId,
              organization_id: adminContext.organizationId,
              email: 'different@example.com',
              status: 'ACTIVE',
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      await expect(service.acceptPortalInvite(inviteToken, targetUserId)).rejects.toThrow(
        'Invite was issued to a different email address'
      );
    });

    it('accepts invite when email matches case-insensitively with whitespace', async () => {
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'token-uuid',
              token: inviteToken,
              organization_id: adminContext.organizationId,
              email: 'Caregiver@Example.COM ',
              status: 'PENDING',
              expires_at: new Date('2026-11-08T12:00:00Z'),
              target_type: 'CAREGIVER',
              target_id: targetCaregiverId,
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: targetUserId,
              organization_id: adminContext.organizationId,
              email: ' caregiver@example.com',
              status: 'ACTIVE',
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      vi.mocked(mockClientQuery)
        .mockResolvedValueOnce({
          rows: [
            {
              id: targetCaregiverId,
              user_id: null,
              portal_access_status: 'INVITED',
              employment_status: 'ACTIVE',
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] });

      await expect(service.acceptPortalInvite(inviteToken, targetUserId)).resolves.toBeUndefined();
    });

    it('rejects accept when user status is INACTIVE', async () => {
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'token-uuid',
              token: inviteToken,
              organization_id: adminContext.organizationId,
              email: 'caregiver@example.com',
              status: 'PENDING',
              expires_at: new Date('2026-11-08T12:00:00Z'),
              target_type: 'CAREGIVER',
              target_id: targetCaregiverId,
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: targetUserId,
              organization_id: adminContext.organizationId,
              email: 'caregiver@example.com',
              status: 'INACTIVE',
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      await expect(service.acceptPortalInvite(inviteToken, targetUserId)).rejects.toThrow(
        PermissionError
      );
    });

    it('rejects accept when caregiver employment_status is TERMINATED', async () => {
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'token-uuid',
              token: inviteToken,
              organization_id: adminContext.organizationId,
              email: 'caregiver@example.com',
              status: 'PENDING',
              expires_at: new Date('2026-11-08T12:00:00Z'),
              target_type: 'CAREGIVER',
              target_id: targetCaregiverId,
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: targetUserId,
              organization_id: adminContext.organizationId,
              email: 'caregiver@example.com',
              status: 'ACTIVE',
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      vi.mocked(mockClientQuery).mockResolvedValueOnce({
        rows: [
          {
            id: targetCaregiverId,
            user_id: null,
            portal_access_status: 'INVITED',
            employment_status: 'TERMINATED',
          },
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      await expect(service.acceptPortalInvite(inviteToken, targetUserId)).rejects.toThrow(
        'Portal invitation is no longer valid'
      );
    });

    it('rejects accept when caregiver portal_access_status is no longer INVITED', async () => {
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'token-uuid',
              token: inviteToken,
              organization_id: adminContext.organizationId,
              email: 'caregiver@example.com',
              status: 'PENDING',
              expires_at: new Date('2026-11-08T12:00:00Z'),
              target_type: 'CAREGIVER',
              target_id: targetCaregiverId,
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: targetUserId,
              organization_id: adminContext.organizationId,
              email: 'caregiver@example.com',
              status: 'ACTIVE',
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      vi.mocked(mockClientQuery).mockResolvedValueOnce({
        rows: [
          {
            id: targetCaregiverId,
            user_id: null,
            portal_access_status: 'REVOKED',
            employment_status: 'ACTIVE',
          },
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      await expect(service.acceptPortalInvite(inviteToken, targetUserId)).rejects.toThrow(
        'Portal invitation is no longer valid'
      );
    });

    it('rejects accept when family target client is DISCHARGED', async () => {
      const targetFamilyMemberId = '55555555-5555-4555-8555-555555555555';
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'token-uuid',
              token: inviteToken,
              organization_id: adminContext.organizationId,
              email: 'family@example.com',
              status: 'PENDING',
              expires_at: new Date('2026-11-08T12:00:00Z'),
              target_type: 'FAMILY',
              target_id: targetFamilyMemberId,
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: targetUserId,
              organization_id: adminContext.organizationId,
              email: 'family@example.com',
              status: 'ACTIVE',
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      vi.mocked(mockClientQuery).mockResolvedValueOnce({
        rows: [
          {
            id: targetFamilyMemberId,
            user_id: null,
            portal_access_status: 'INVITED',
            client_status: 'DISCHARGED',
          },
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      await expect(service.acceptPortalInvite(inviteToken, targetUserId)).rejects.toThrow(
        'Portal invitation is no longer valid'
      );
    });
  });

  describe('revokeCaregiverAccess and multi-role reconciliation', () => {
    const caregiverId = '44444444-4444-4444-8444-444444444444';
    const linkedUserId = '77777777-7777-4777-8777-777777777777';

    it('manual revoke when user has another active link: user stays ACTIVE, token bumped', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [
          {
            id: caregiverId,
            user_id: linkedUserId,
            portal_access_status: 'ACTIVE',
            organization_id: adminContext.organizationId,
          },
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      // inside transaction:
      // 1. update caregivers
      // 2. update invite_tokens
      // 3. reconcileUserAccount: select user (no staff roles)
      // 4. reconcileUserAccount: select count of active links (returns 1 for family)
      // 5. reconcileUserAccount: update users bump token_version only
      vi.mocked(mockClientQuery)
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] })
        .mockResolvedValueOnce({
          rows: [{ id: linkedUserId, roles: [], status: 'ACTIVE' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [{ count: '1' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] });

      await service.revokeCaregiverAccess(caregiverId, 'Voluntary leave', adminContext);

      const clientQueries = vi.mocked(mockClientQuery).mock.calls;
      // Caregiver row updated
      expect(clientQueries[0]?.[0]).toContain("portal_access_status = 'REVOKED'");
      // Reconcile user account did NOT set status = 'INACTIVE'
      expect(clientQueries[4]?.[0]).not.toContain("status = 'INACTIVE'");
      expect(clientQueries[4]?.[0]).toContain('token_version = token_version + 1');

      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        adminContext,
        expect.objectContaining({
          eventType: 'PORTAL_ACCESS_REVOKED',
          resource: 'caregiver',
          resourceId: caregiverId,
          metadata: expect.objectContaining({
            userAccountDeactivated: false,
            trigger: 'MANUAL',
          }),
        })
      );
    });

    it('revoke of last link with no staff role sets user to INACTIVE and bumps token_version', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [
          {
            id: caregiverId,
            user_id: linkedUserId,
            portal_access_status: 'ACTIVE',
            organization_id: adminContext.organizationId,
          },
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      vi.mocked(mockClientQuery)
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] })
        .mockResolvedValueOnce({
          rows: [{ id: linkedUserId, roles: [], status: 'ACTIVE' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [{ count: '0' }], // No other active or invited links
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] });

      await service.revokeCaregiverAccess(caregiverId, 'Fired', adminContext);

      const clientQueries = vi.mocked(mockClientQuery).mock.calls;
      expect(clientQueries[4]?.[0]).toContain('status = $2');
      expect(clientQueries[4]?.[0]).toContain('token_version = token_version + 1');
      expect(clientQueries[4]?.[1]).toEqual([linkedUserId, 'INACTIVE', adminContext.userId]);

      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        adminContext,
        expect.objectContaining({
          eventType: 'PORTAL_ACCESS_REVOKED',
          metadata: expect.objectContaining({
            userAccountDeactivated: true,
          }),
        })
      );
    });

    it('a staff-role holder stays ACTIVE even when their last portal link is revoked', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [
          {
            id: caregiverId,
            user_id: linkedUserId,
            portal_access_status: 'ACTIVE',
            organization_id: adminContext.organizationId,
          },
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      vi.mocked(mockClientQuery)
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] })
        .mockResolvedValueOnce({
          // User is also a COORDINATOR (staff role)
          rows: [{ id: linkedUserId, roles: ['COORDINATOR'], status: 'ACTIVE' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [{ count: '0' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] });

      await service.revokeCaregiverAccess(caregiverId, 'Resigned as caregiver', adminContext);

      const clientQueries = vi.mocked(mockClientQuery).mock.calls;
      // Did NOT deactivate user status
      expect(clientQueries[4]?.[0]).not.toContain('status = $2');
      expect(clientQueries[4]?.[0]).toContain('token_version = token_version + 1');

      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        adminContext,
        expect.objectContaining({
          metadata: expect.objectContaining({
            userAccountDeactivated: false,
          }),
        })
      );
    });
  });

  describe('handleCaregiverStatusChange (suspend -> restore)', () => {
    const caregiverId = '44444444-4444-4444-8444-444444444444';
    const linkedUserId = '77777777-7777-4777-8777-777777777777';

    it('suspends caregiver and sets user SUSPENDED when no other links or staff roles', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [
          {
            id: caregiverId,
            user_id: linkedUserId,
            portal_access_status: 'ACTIVE',
          },
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      vi.mocked(mockClientQuery)
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] })
        .mockResolvedValueOnce({
          rows: [{ id: linkedUserId, roles: [], status: 'ACTIVE' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [{ count: '0' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] });

      await service.handleCaregiverStatusChange(caregiverId, 'ACTIVE', 'SUSPENDED', adminContext);

      const clientQueries = vi.mocked(mockClientQuery).mock.calls;
      expect(clientQueries[0]?.[0]).toContain("portal_access_status = 'SUSPENDED'");
      expect(clientQueries[3]?.[1]).toEqual([linkedUserId, 'SUSPENDED', adminContext.userId]);

      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        adminContext,
        expect.objectContaining({
          eventType: 'PORTAL_ACCESS_SUSPENDED',
          metadata: expect.objectContaining({
            userAccountDeactivated: true,
            trigger: 'AUTO_REVOKE',
          }),
        })
      );
    });

    it('restores SUSPENDED caregiver to ACTIVE and restores user account status to ACTIVE with token bump when SUSPENDED', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [
          {
            id: caregiverId,
            user_id: linkedUserId,
            portal_access_status: 'SUSPENDED',
          },
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      vi.mocked(mockClientQuery)
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] });

      await service.handleCaregiverStatusChange(caregiverId, 'SUSPENDED', 'ACTIVE', adminContext);

      const clientQueries = vi.mocked(mockClientQuery).mock.calls;
      expect(clientQueries[0]?.[0]).toContain("portal_access_status = 'ACTIVE'");
      expect(clientQueries[1]?.[0]).toContain("status = CASE WHEN status = 'SUSPENDED' THEN 'ACTIVE' ELSE status END");
      expect(clientQueries[1]?.[0]).toContain('token_version = token_version + 1');

      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        adminContext,
        expect.objectContaining({
          eventType: 'PORTAL_ACCESS_RESTORED',
          metadata: expect.objectContaining({
            userAccountDeactivated: false,
          }),
        })
      );
    });

    it('leaves user status unchanged when restoring caregiver if user was INACTIVE (CASE statement)', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [
          {
            id: caregiverId,
            user_id: linkedUserId,
            portal_access_status: 'SUSPENDED',
          },
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      vi.mocked(mockClientQuery)
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] });

      await service.handleCaregiverStatusChange(caregiverId, 'SUSPENDED', 'ACTIVE', adminContext);

      const clientQueries = vi.mocked(mockClientQuery).mock.calls;
      expect(clientQueries[0]?.[0]).toContain("portal_access_status = 'ACTIVE'");
      expect(clientQueries[1]?.[0]).toContain("status = CASE WHEN status = 'SUSPENDED' THEN 'ACTIVE' ELSE status END");
      expect(clientQueries[1]?.[0]).not.toContain("SET status = 'ACTIVE'");
      expect(clientQueries[1]?.[0]).toContain('token_version = token_version + 1');
    });
  });

  describe('handleClientStatusChange', () => {
    it('revokes 2 family links on client discharge', async () => {
      const clientId = '66666666-6666-4666-8666-666666666666';
      const fm1 = '55555555-5555-4555-8555-555555555551';
      const fm2 = '55555555-5555-4555-8555-555555555552';

      // Initial query for family members
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{ id: fm1 }, { id: fm2 }],
        command: 'SELECT',
        rowCount: 2,
        oid: 0,
        fields: [],
      });

      // fm1 details query
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{ id: fm1, client_id: clientId, user_id: 'user-1', portal_access_status: 'ACTIVE' }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      // fm2 details query
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{ id: fm2, client_id: clientId, user_id: 'user-2', portal_access_status: 'ACTIVE' }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      // For each family member's reconcileUserAccount:
      vi.mocked(mockClientQuery)
        .mockResolvedValue({
          rows: [{ id: 'user-id', roles: [], status: 'ACTIVE' }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        });

      await service.handleClientStatusChange(clientId, 'ACTIVE', 'DISCHARGED', adminContext);

      expect(mockAudit.logEvent).toHaveBeenCalledTimes(2);
      expect(mockAudit.logEvent).toHaveBeenNthCalledWith(
        1,
        adminContext,
        expect.objectContaining({
          eventType: 'PORTAL_ACCESS_REVOKED',
          resource: 'family_member',
          resourceId: fm1,
          metadata: expect.objectContaining({ trigger: 'AUTO_REVOKE' }),
        })
      );
      expect(mockAudit.logEvent).toHaveBeenNthCalledWith(
        2,
        adminContext,
        expect.objectContaining({
          eventType: 'PORTAL_ACCESS_REVOKED',
          resource: 'family_member',
          resourceId: fm2,
          metadata: expect.objectContaining({ trigger: 'AUTO_REVOKE' }),
        })
      );
    });
  });

  describe('Audit metadata HIPAA compliance', () => {
    it('ensures audit metadata contains no names, emails, or free-text reasons', async () => {
      const caregiverId = '44444444-4444-4444-8444-444444444444';
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [
          {
            id: caregiverId,
            organization_id: adminContext.organizationId,
            email: 'phi.caregiver@example.com',
            first_name: 'John',
            last_name: 'ProtectedHealth',
            employment_status: 'ACTIVE',
            deleted_at: null,
          },
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      await service.inviteCaregiver(caregiverId, adminContext);

      const auditCalls = vi.mocked(mockAudit.logEvent).mock.calls;
      const metadata = auditCalls[0]?.[1]?.metadata ?? {};

      const serialized = JSON.stringify(metadata);
      expect(serialized).not.toContain('phi.caregiver@example.com');
      expect(serialized).not.toContain('John');
      expect(serialized).not.toContain('ProtectedHealth');

      // Check keys only contain safe identifier fields
      for (const val of Object.values(metadata)) {
        if (typeof val === 'string') {
          // Values should either be UUIDs or enum constants
          const isUuid = /^[\dA-Fa-f-]{36}$/.test(val);
          const isEnum = /^[\dA-Z_]+$/.test(val);
          expect(isUuid || isEnum).toBe(true);
        }
      }
    });
  });
});
