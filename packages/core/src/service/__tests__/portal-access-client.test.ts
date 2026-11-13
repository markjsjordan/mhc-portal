/**
 * wdvf3acxjt: client self-portal access (CLIENT role) - service level tests
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { PoolClient } from 'pg';
import { PortalAccessService } from '../portal-access-service.js';
import { Database } from '../../db/connection.js';
import { PermissionService } from '../../permissions/permission-service.js';
import { AuditService } from '../../audit/audit-service.js';
import {
  UserContext,
  PermissionError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from '../../types/base.js';
import { resolvePortalLinks, deriveRoles } from '../portal-link-resolver.js';

const ORG = '22222222-2222-4222-8222-222222222222';
const OTHER_ORG = '99999999-9999-4999-8999-999999999999';
const CLIENT_ID = '66666666-6666-4666-8666-666666666666';
const USER_ID = '77777777-7777-4777-8777-777777777777';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const res = (rows: unknown[]): any => ({ rows, command: 'SELECT', rowCount: rows.length, oid: 0, fields: [] });

describe('PortalAccessService - client portal access', () => {
  let service: PortalAccessService;
  let mockDb: Database;
  let audit: AuditService;
  let txQuery: Mock<(sql: string, params?: unknown[]) => Promise<unknown>>;
  let admin: UserContext;
  const permissions = new PermissionService();

  beforeEach(() => {
    txQuery = vi.fn<(sql: string, params?: unknown[]) => Promise<unknown>>().mockResolvedValue({ rows: [], rowCount: 1 });
    const txClient = { query: txQuery, release: vi.fn() } as unknown as PoolClient;
    mockDb = {
      query: vi.fn(),
      transaction: vi.fn().mockImplementation(async (cb: (c: PoolClient) => Promise<unknown>) => cb(txClient)),
    } as unknown as Database;
    audit = { logEvent: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    admin = {
      userId: '11111111-1111-4111-8111-111111111111',
      organizationId: ORG,
      roles: ['ORG_ADMIN'],
      permissions: ['clients:update'],
      branchIds: [],
    };
    service = new PortalAccessService(mockDb, permissions, audit);
  });

  const clientRow = (over: Record<string, unknown> = {}) => ({
    id: CLIENT_ID,
    organization_id: ORG,
    email: 'Client@Example.com ',
    first_name: 'Cli',
    last_name: 'Ent',
    status: 'ACTIVE',
    deleted_at: null,
    ...over,
  });

  describe('inviteClient', () => {
    it('creates a CLIENT-targeted invite with normalized email and sets INVITED', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce(res([clientRow()]));
      const result = await service.inviteClient(CLIENT_ID, admin);

      expect(result.token).toBeTruthy();
      const insert = txQuery.mock.calls.find((c) => String(c[0]).includes('INSERT INTO invite_tokens'));
      expect(insert?.[1]).toEqual(expect.arrayContaining(['client@example.com', 'CLIENT', CLIENT_ID, ORG]));
      expect(txQuery.mock.calls.some((c) => String(c[0]).includes("portal_access_status = 'INVITED'"))).toBe(true);
      expect(audit.logEvent).toHaveBeenCalledWith(
        admin,
        expect.objectContaining({ eventType: 'PORTAL_INVITATION_SENT', resource: 'client', resourceId: CLIENT_ID })
      );
    });

    it('requires clients:update (caller without it is refused, nothing queried)', async () => {
      const nurse: UserContext = { ...admin, roles: ['READ_ONLY'], permissions: [] };
      await expect(service.inviteClient(CLIENT_ID, nurse)).rejects.toThrow(PermissionError);
      expect(mockDb.query).not.toHaveBeenCalled();
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('a CLIENT-role user cannot invite clients', async () => {
      const clientUser: UserContext = {
        ...admin,
        roles: ['CLIENT'],
        permissions: [],
        directClientId: CLIENT_ID,
      };
      await expect(service.inviteClient(CLIENT_ID, clientUser)).rejects.toThrow(PermissionError);
    });

    it.each(['DISCHARGED', 'DECEASED'])('refuses %s clients', async (status) => {
      vi.mocked(mockDb.query).mockResolvedValueOnce(res([clientRow({ status })]));
      await expect(service.inviteClient(CLIENT_ID, admin)).rejects.toThrow(ValidationError);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it.each([null, '', '   '])('rejects missing/blank client email (%j)', async (email) => {
      vi.mocked(mockDb.query).mockResolvedValueOnce(res([clientRow({ email })]));
      await expect(service.inviteClient(CLIENT_ID, admin)).rejects.toThrow(/valid email/);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('treats a client from another organization as not found', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce(res([clientRow({ organization_id: OTHER_ORG })]));
      await expect(service.inviteClient(CLIENT_ID, admin)).rejects.toThrow(NotFoundError);
    });

    it('throws NotFound for an unknown client', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce(res([]));
      await expect(service.inviteClient(CLIENT_ID, admin)).rejects.toThrow(NotFoundError);
    });
  });

  describe('acceptPortalInvite (CLIENT target)', () => {
    const tokenRow = {
      id: 'token-uuid',
      token: 'tok',
      organization_id: ORG,
      email: 'client@example.com',
      status: 'PENDING',
      expires_at: new Date(Date.now() + 86_400_000),
      target_type: 'CLIENT',
      target_id: CLIENT_ID,
    };
    const userRow = { id: USER_ID, organization_id: ORG, email: 'client@example.com', status: 'ACTIVE' };

    it('links the user to exactly that client and marks the client ACTIVE', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce(res([tokenRow])).mockResolvedValueOnce(res([userRow]));
      txQuery
        .mockResolvedValueOnce(res([{ id: CLIENT_ID, user_id: null, portal_access_status: 'INVITED', status: 'ACTIVE' }]))
        .mockResolvedValue({ rows: [], rowCount: 1 });

      await service.acceptPortalInvite('tok', USER_ID);

      const update = txQuery.mock.calls.find((c) => String(c[0]).includes('UPDATE clients'));
      expect(String(update?.[0])).toContain("portal_access_status = 'ACTIVE'");
      expect(update?.[1]).toEqual([CLIENT_ID, USER_ID]);
      expect(audit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID }),
        expect.objectContaining({ eventType: 'PORTAL_INVITATION_ACCEPTED', resource: 'client', resourceId: CLIENT_ID })
      );
    });

    it.each(['DISCHARGED', 'DECEASED'])('refuses acceptance when the client became %s', async (status) => {
      vi.mocked(mockDb.query).mockResolvedValueOnce(res([tokenRow])).mockResolvedValueOnce(res([userRow]));
      txQuery.mockResolvedValueOnce(res([{ id: CLIENT_ID, user_id: null, portal_access_status: 'INVITED', status }]));
      await expect(service.acceptPortalInvite('tok', USER_ID)).rejects.toThrow(ConflictError);
      expect(txQuery.mock.calls.some((c) => String(c[0]).includes('UPDATE clients'))).toBe(false);
    });

    it('refuses acceptance once access was revoked (invite no longer INVITED)', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce(res([tokenRow])).mockResolvedValueOnce(res([userRow]));
      txQuery.mockResolvedValueOnce(res([{ id: CLIENT_ID, user_id: null, portal_access_status: 'REVOKED', status: 'ACTIVE' }]));
      await expect(service.acceptPortalInvite('tok', USER_ID)).rejects.toThrow(ConflictError);
    });

    it('refuses linking a client already linked to a different user', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce(res([tokenRow])).mockResolvedValueOnce(res([userRow]));
      txQuery.mockResolvedValueOnce(
        res([{ id: CLIENT_ID, user_id: 'someone-else', portal_access_status: 'INVITED', status: 'ACTIVE' }])
      );
      await expect(service.acceptPortalInvite('tok', USER_ID)).rejects.toThrow(ConflictError);
    });
  });

  describe('revokeClientAccess / suspendClientAccess', () => {
    it('revoke requires clients:update', async () => {
      const ro: UserContext = { ...admin, roles: ['READ_ONLY'], permissions: [] };
      await expect(service.revokeClientAccess(CLIENT_ID, 'r', ro)).rejects.toThrow(PermissionError);
    });

    it('revoke refuses a client from another organization', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce(res([{ organization_id: OTHER_ORG }]));
      await expect(service.revokeClientAccess(CLIENT_ID, 'r', admin)).rejects.toThrow(NotFoundError);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('revoke marks REVOKED, revokes pending tokens, deactivates the user and audits', async () => {
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce(res([{ organization_id: ORG }]))
        .mockResolvedValueOnce(res([{ id: CLIENT_ID, user_id: USER_ID, portal_access_status: 'ACTIVE' }]));
      txQuery.mockImplementation((sql: string) => {
        if (sql.includes('FROM users WHERE id')) return Promise.resolve(res([{ id: USER_ID, roles: ['CLIENT'], status: 'ACTIVE' }]));
        if (sql.includes('AS count')) return Promise.resolve(res([{ count: '0' }]));
        return Promise.resolve({ rows: [], rowCount: 1 });
      });

      await service.revokeClientAccess(CLIENT_ID, 'moved away', admin);

      const sqls = txQuery.mock.calls.map((c) => String(c[0]));
      expect(sqls.some((q) => q.includes("portal_access_status = 'REVOKED'"))).toBe(true);
      expect(sqls.some((q) => q.includes("target_type = 'CLIENT'") && q.includes("status = 'REVOKED'"))).toBe(true);
      expect(sqls.some((q) => q.includes('token_version = token_version + 1'))).toBe(true);
      expect(audit.logEvent).toHaveBeenCalledWith(
        admin,
        expect.objectContaining({ eventType: 'PORTAL_ACCESS_REVOKED', resourceId: CLIENT_ID })
      );
    });

    it('suspend only works on ACTIVE access and requires clients:update', async () => {
      const ro: UserContext = { ...admin, roles: ['READ_ONLY'], permissions: [] };
      await expect(service.suspendClientAccess(CLIENT_ID, 'r', ro)).rejects.toThrow(PermissionError);

      vi.mocked(mockDb.query).mockResolvedValueOnce(
        res([{ id: CLIENT_ID, organization_id: ORG, user_id: null, portal_access_status: 'INVITED' }])
      );
      await expect(service.suspendClientAccess(CLIENT_ID, 'r', admin)).rejects.toThrow(ConflictError);
    });

    it('suspend sets SUSPENDED, suspends the user (token bump) and audits', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce(
        res([{ id: CLIENT_ID, organization_id: ORG, user_id: USER_ID, portal_access_status: 'ACTIVE' }])
      );
      txQuery.mockImplementation((sql: string) => {
        if (sql.includes('FROM users WHERE id')) return Promise.resolve(res([{ id: USER_ID, roles: ['CLIENT'], status: 'ACTIVE' }]));
        if (sql.includes('AS count')) return Promise.resolve(res([{ count: '0' }]));
        return Promise.resolve({ rows: [], rowCount: 1 });
      });
      await service.suspendClientAccess(CLIENT_ID, 'investigation', admin);
      const sqls = txQuery.mock.calls.map((c) => String(c[0]));
      expect(sqls.some((q) => q.includes("portal_access_status = 'SUSPENDED'"))).toBe(true);
      const userUpdate = txQuery.mock.calls.find((c) => String(c[0]).includes('SET status = $2'));
      expect(userUpdate?.[1]).toEqual([USER_ID, 'SUSPENDED', admin.userId]);
      expect(audit.logEvent).toHaveBeenCalledWith(
        admin,
        expect.objectContaining({ eventType: 'PORTAL_ACCESS_SUSPENDED', resourceId: CLIENT_ID })
      );
    });

    it('suspend refuses a client from another organization', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce(
        res([{ id: CLIENT_ID, organization_id: OTHER_ORG, user_id: null, portal_access_status: 'ACTIVE' }])
      );
      await expect(service.suspendClientAccess(CLIENT_ID, 'r', admin)).rejects.toThrow(NotFoundError);
    });
  });

  describe('handleClientStatusChange for direct client access', () => {
    it.each(['DISCHARGED', 'DECEASED'] as const)('auto-revokes direct client access on %s', async (status) => {
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce(res([])) // no family members
        .mockResolvedValueOnce(res([{ id: CLIENT_ID, portal_access_status: 'ACTIVE' }]))
        .mockResolvedValueOnce(res([{ id: CLIENT_ID, user_id: USER_ID, portal_access_status: 'ACTIVE' }]));
      txQuery.mockResolvedValue(res([{ id: USER_ID, roles: ['CLIENT'], status: 'ACTIVE', count: '0' }]));

      await service.handleClientStatusChange(CLIENT_ID, 'ACTIVE', status, admin);

      expect(audit.logEvent).toHaveBeenCalledWith(
        admin,
        expect.objectContaining({
          eventType: 'PORTAL_ACCESS_REVOKED',
          resource: 'client',
          metadata: expect.objectContaining({ trigger: 'AUTO_REVOKE' }),
        })
      );
    });
  });
});

describe('portal-link-resolver - CLIENT', () => {
  it('deriveRoles adds CLIENT from directClientId and never trusts a stored CLIENT role', () => {
    expect(deriveRoles([], { familyMemberIds: [], familyClientIds: [], directClientId: CLIENT_ID })).toEqual(['CLIENT']);
    expect(deriveRoles(['CLIENT'], { familyMemberIds: [], familyClientIds: [] })).toEqual([]);
  });

  it('resolvePortalLinks only resolves ACTIVE, non-discharged linked clients', async () => {
    const q = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: CLIENT_ID }] });
    const links = await resolvePortalLinks({ query: q } as unknown as Database, USER_ID);
    expect(links.directClientId).toBe(CLIENT_ID);
    const clientSql = String(q.mock.calls[2]?.[0]);
    expect(clientSql).toContain("portal_access_status = 'ACTIVE'");
    expect(clientSql).toContain("'DISCHARGED', 'DECEASED'");
    expect(clientSql).toContain('deleted_at IS NULL');
  });
});

describe('CLIENT role permissions (least privilege)', () => {
  const ps = new PermissionService();
  const ctx: UserContext = {
    userId: USER_ID,
    organizationId: ORG,
    roles: ['CLIENT'],
    permissions: [],
    branchIds: [],
    directClientId: CLIENT_ID,
  };

  it('can read clients (scoped server-side) but nothing that mutates or lists org-wide PHI', () => {
    expect(ps.hasPermission(ctx, 'clients:read')).toBe(true);
    for (const p of ['clients:update', 'clients:create', 'clients:delete', 'visits:read', 'care-plans:read', 'notes:read',
      'caregivers:read', 'billing:read', 'users:read', 'audit:read']) {
      expect(ps.hasPermission(ctx, p), p).toBe(false);
    }
  });
});
