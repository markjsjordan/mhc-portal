import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SectionAccessService } from '../../permissions/section-access-service.js';
import { PermissionService } from '../../permissions/permission-service.js';
import type { AuditService } from '../../audit/audit-service.js';
import type { Database } from '../../db/connection.js';
import type { UserContext } from '../../types/base.js';
import { ValidationError, NotFoundError } from '../../types/base.js';

describe('SectionAccessService', () => {
  let mockDb: any;
  let mockAudit: AuditService;
  let perms: PermissionService;
  let service: SectionAccessService;

  const actorCtx: UserContext = {
    userId: '11111111-1111-1111-1111-111111111111',
    organizationId: 'org-1111-1111-1111-111111111111',
    roles: ['SUPER_ADMIN'],
    permissions: [],
    branchIds: [],
  };

  const targetUserId = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
      transaction: vi.fn(async (cb: (client: any) => Promise<any>) => {
        const mockClient = {
          query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
        };
        return cb(mockClient);
      }),
    };

    mockAudit = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    perms = new PermissionService();
    service = new SectionAccessService(mockDb as Database, mockAudit, perms);
  });

  describe('getRoleDefaults and getEffective', () => {
    it('an override beats the role default', async () => {
      const ctx: UserContext = {
        userId: targetUserId,
        organizationId: actorCtx.organizationId,
        roles: ['READ_ONLY'], // default: clients read=true, write=false
        permissions: [],
        branchIds: [],
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [{ section: 'clients', access: 'NONE' }],
      });

      const effective = await service.getEffective(ctx);
      expect(effective.roleDefaults.clients).toEqual({ read: true, write: false });
      expect(effective.overrides['clients']).toBe('NONE');
      expect(effective.effective.clients).toEqual({ read: false, write: false });
    });

    it('NONE blocks both read and write', async () => {
      const ctx: UserContext = {
        userId: targetUserId,
        organizationId: actorCtx.organizationId,
        roles: ['SUPER_ADMIN'],
        permissions: [],
        branchIds: [],
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [{ section: 'billing', access: 'NONE' }],
      });

      const effective = await service.getEffective(ctx);
      expect(effective.effective.billing).toEqual({ read: false, write: false });
    });

    it('READ gives write=false', async () => {
      const ctx: UserContext = {
        userId: targetUserId,
        organizationId: actorCtx.organizationId,
        roles: ['SUPER_ADMIN'], // default is read=true, write=true
        permissions: [],
        branchIds: [],
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [{ section: 'billing', access: 'READ' }],
      });

      const effective = await service.getEffective(ctx);
      expect(effective.effective.billing).toEqual({ read: true, write: false });
    });

    it('WRITE gives both read and write', async () => {
      const ctx: UserContext = {
        userId: targetUserId,
        organizationId: actorCtx.organizationId,
        roles: ['READ_ONLY'], // default for billing is read=false, write=false
        permissions: [],
        branchIds: [],
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [{ section: 'billing', access: 'WRITE' }],
      });

      const effective = await service.getEffective(ctx);
      expect(effective.effective.billing).toEqual({ read: true, write: true });
    });

    it('a role with clients:* keeps read and write when no override exists', async () => {
      const ctx: UserContext = {
        userId: targetUserId,
        organizationId: actorCtx.organizationId,
        roles: ['BRANCH_ADMIN'], // has caregivers:*, schedules:*, clients:read/update/delete
        permissions: ['clients:*'],
        branchIds: [],
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [],
      });

      const effective = await service.getEffective(ctx);
      expect(effective.effective.clients).toEqual({ read: true, write: true });
    });
  });

  describe('setOverride', () => {
    it('setOverride writes an audit event whose context.userId is the actor, with previous and next in metadata', async () => {
      // 1. user check
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: targetUserId, organization_id: actorCtx.organizationId, deleted_at: null }],
      });
      // 2. existing override check
      mockDb.query.mockResolvedValueOnce({
        rows: [{ access: 'READ' }],
      });

      await service.setOverride(actorCtx, targetUserId, 'clients', 'NONE');

      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        actorCtx,
        expect.objectContaining({
          eventType: 'AUTHORIZATION',
          resource: 'user_section_access',
          resourceId: targetUserId,
          action: 'SECTION_ACCESS_SET',
          result: 'SUCCESS',
          metadata: {
            section: 'clients',
            previous: 'READ',
            next: 'NONE',
          },
        })
      );
    });

    it('setOverride(null) deletes the row and audits SECTION_ACCESS_CLEARED', async () => {
      // 1. user check
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: targetUserId, organization_id: actorCtx.organizationId, deleted_at: null }],
      });
      // 2. existing override check
      mockDb.query.mockResolvedValueOnce({
        rows: [{ access: 'WRITE' }],
      });

      await service.setOverride(actorCtx, targetUserId, 'clients', null);

      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        actorCtx,
        expect.objectContaining({
          eventType: 'AUTHORIZATION',
          resource: 'user_section_access',
          resourceId: targetUserId,
          action: 'SECTION_ACCESS_CLEARED',
          result: 'SUCCESS',
          metadata: {
            section: 'clients',
            previous: 'WRITE',
            next: null,
          },
        })
      );
    });

    it('a cross-org target is rejected', async () => {
      // user check returns no rows
      mockDb.query.mockResolvedValueOnce({
        rows: [],
      });

      await expect(
        service.setOverride(actorCtx, targetUserId, 'clients', 'READ')
      ).rejects.toThrow(NotFoundError);
    });

    it('an invalid section is rejected', async () => {
      await expect(
        service.setOverride(actorCtx, targetUserId, 'non_existent_section', 'READ')
      ).rejects.toThrow(ValidationError);
    });

    it('a failed audit write rolls back the change', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: targetUserId, organization_id: actorCtx.organizationId, deleted_at: null }],
      });
      mockDb.query.mockResolvedValueOnce({
        rows: [],
      });

      // Audit throws
      vi.mocked(mockAudit.logEvent).mockRejectedValueOnce(new Error('Audit DB failure'));

      // In real DB transaction, throwing inside callback rolls back
      mockDb.transaction.mockImplementationOnce(async (cb: any) => {
        const client = { query: vi.fn() };
        return cb(client);
      });

      await expect(
        service.setOverride(actorCtx, targetUserId, 'clients', 'READ')
      ).rejects.toThrow('Audit DB failure');
    });
  });

  describe('pure helpers', () => {
    it('methodToLevel correctly identifies READ vs WRITE', () => {
      expect(service.methodToLevel('GET')).toBe('READ');
      expect(service.methodToLevel('get')).toBe('READ');
      expect(service.methodToLevel('HEAD')).toBe('READ');
      expect(service.methodToLevel('OPTIONS')).toBe('READ');
      expect(service.methodToLevel('POST')).toBe('WRITE');
      expect(service.methodToLevel('PUT')).toBe('WRITE');
      expect(service.methodToLevel('PATCH')).toBe('WRITE');
      expect(service.methodToLevel('DELETE')).toBe('WRITE');
    });

    it('accessAllows checks read or write permissions', () => {
      expect(service.accessAllows({ read: true, write: false }, 'READ')).toBe(true);
      expect(service.accessAllows({ read: true, write: false }, 'WRITE')).toBe(false);
      expect(service.accessAllows({ read: false, write: true }, 'READ')).toBe(false);
      expect(service.accessAllows({ read: false, write: true }, 'WRITE')).toBe(true);
      expect(service.accessAllows({ read: true, write: true }, 'WRITE')).toBe(true);
    });

    it('pathToSection resolves specific paths, prefix tables, and unmapped areas', () => {
      expect(service.pathToSection('/api/visits/123/tasks')).toBe('tasks');
      expect(service.pathToSection('/api/visits/123/notes')).toBe('notes');
      expect(service.pathToSection('/api/clients')).toBe('clients');
      expect(service.pathToSection('/api/medications/interaction')).toBe('clients');
      expect(service.pathToSection('/api/evv/records')).toBe('visits');
      expect(service.pathToSection('/api/time-tracking/verify')).toBe('visits');
      expect(service.pathToSection('/api/compliance/audit')).toBe('compliance');
      expect(service.pathToSection('/api/qa-audits/checklist')).toBe('compliance');
      expect(service.pathToSection('/api/export/csv')).toBe('reports');
      expect(service.pathToSection('/api/analytics/dashboard')).toBe('reports');
      expect(service.pathToSection('/api/unknown-endpoint')).toBeNull();
    });
  });
});
