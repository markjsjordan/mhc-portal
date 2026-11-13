/**
 * Route-level tests for GET /api/clients/:clientId/visit-history.
 *
 * Fully mocked: no database. AuthMiddleware, AuditService and ScheduleRepository
 * are replaced, so these tests exercise the real router (authorization, scoping,
 * validation, pagination, audit) without a live DB.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';

const mocks = vi.hoisted(() => ({
  getClientVisitHistory: vi.fn(),
  logEvent: vi.fn(),
}));

vi.mock('@folkcare/core', async () => {
  const actual = await vi.importActual<typeof import('@folkcare/core')>('@folkcare/core');
  return {
    ...actual,
    AuthMiddleware: vi.fn().mockImplementation(function () {
      return {
        // Contract of the real middleware: requireAuth sets req.user or answers 401.
        requireAuth: (
          req: { user?: unknown; headers: Record<string, string | string[] | undefined> },
          res: { status: (c: number) => { json: (b: unknown) => void } },
          next: () => void
        ): void => {
          const raw = req.headers['x-test-user'];
          if (typeof raw !== 'string') {
            res.status(401).json({ error: 'Unauthorized' });
            return;
          }
          req.user = JSON.parse(raw);
          next();
        },
      };
    }),
    AuditService: vi.fn().mockImplementation(function () {
      return { logEvent: mocks.logEvent };
    }),
  };
});

vi.mock('@folkcare/scheduling-visits', () => ({
  ScheduleRepository: vi.fn().mockImplementation(function () {
    return { getClientVisitHistory: mocks.getClientVisitHistory };
  }),
}));

import { createClientVisitHistoryRouter } from '../client-visit-history.js';

const repoArgs = (): any[] => mocks.getClientVisitHistory.mock.calls[0] ?? [];
const auditArgs = (): any[] => mocks.logEvent.mock.calls[0] ?? [];

const ORG = randomUUID();
const BRANCH_A = randomUUID();
const CLIENT = randomUUID();

const user = (overrides: Record<string, unknown> = {}): string =>
  JSON.stringify({
    userId: randomUUID(),
    organizationId: ORG,
    branchIds: [],
    roles: ['BRANCH_ADMIN'],
    permissions: ['clients:read'],
    ...overrides,
  });

const page = (
  items: unknown[] = [],
  extra: Record<string, unknown> = {}
): Record<string, unknown> => ({
  items,
  total: items.length,
  page: 1,
  limit: 20,
  totalPages: items.length > 0 ? 1 : 0,
  ...extra,
});

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api', createClientVisitHistoryRouter({ getPool: () => ({}) } as never));
  return app;
}

const get = (app: express.Express, path: string, u?: string): request.Test => {
  const r = request(app).get(path);
  return u ? r.set('x-test-user', u) : r;
};

describe('GET /api/clients/:clientId/visit-history (mocked repository)', () => {
  let app: express.Express;
  const url = `/api/clients/${CLIENT}/visit-history`;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClientVisitHistory.mockResolvedValue(page());
    mocks.logEvent.mockResolvedValue({});
    app = buildApp();
  });

  describe('authorization', () => {
    it('200 for a role-granted user with no explicit permissions (resolved by PermissionService)', async () => {
      const res = await get(app, url, user({ roles: ['CAREGIVER'], permissions: [] }));
      expect(res.status).toBe(200);
    });

    it('403 for a user with neither role nor token grant for clients', async () => {
      const res = await get(app, url, user({ roles: ['HR'], permissions: [] }));
      expect(res.status).toBe(403);
      expect(mocks.getClientVisitHistory).not.toHaveBeenCalled();
    });

    it('401 when unauthenticated; repository and audit untouched', async () => {
      const res = await get(app, url);
      expect(res.status).toBe(401);
      expect(mocks.getClientVisitHistory).not.toHaveBeenCalled();
      expect(mocks.logEvent).not.toHaveBeenCalled();
    });

    it('403 PERMISSION_DENIED without clients:read (even with visits:read)', async () => {
      const res = await get(app, url, user({ roles: ['HR'], permissions: ['visits:read', 'staff:*'] }));
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ success: false, code: 'PERMISSION_DENIED' });
      expect(mocks.getClientVisitHistory).not.toHaveBeenCalled();
      expect(mocks.logEvent).not.toHaveBeenCalled();
    });

    it.each([
      ['clients:read', ['clients:read', 'visits:update'], 'CAREGIVER'],
      ['clients:*', ['clients:*'], 'ORG_ADMIN'],
      ['*:*', ['*:*'], 'SUPER_ADMIN'],
    ])('200 with %s (no visits:read needed)', async (_n, permissions, role) => {
      const res = await get(app, url, user({ roles: [role], permissions }));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('400 for a non-UUID client id', async () => {
      const res = await get(app, '/api/clients/not-a-uuid/visit-history', user());
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Valid client ID is required');
      expect(mocks.getClientVisitHistory).not.toHaveBeenCalled();
    });

    it('400 when the token has no organization context', async () => {
      const res = await get(app, url, user({ organizationId: '' }));
      expect(res.status).toBe(400);
      expect(mocks.getClientVisitHistory).not.toHaveBeenCalled();
    });
  });

  describe('per-client scope (FAMILY)', () => {
    it('200 for a linked client', async () => {
      const res = await get(app, url, user({ roles: ['FAMILY'], familyClientIds: [CLIENT] }));
      expect(res.status).toBe(200);
    });

    it('403 FAMILY_SCOPE_VIOLATION for an unlinked client; no data read, no audit', async () => {
      const res = await get(app, url, user({ roles: ['FAMILY'], familyClientIds: [randomUUID()] }));
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FAMILY_SCOPE_VIOLATION');
      expect(mocks.getClientVisitHistory).not.toHaveBeenCalled();
      expect(mocks.logEvent).not.toHaveBeenCalled();
    });

    it('403 for FAMILY with no linked clients at all', async () => {
      const res = await get(app, url, user({ roles: ['FAMILY'] }));
      expect(res.status).toBe(403);
    });
  });

  describe('org / branch scoping', () => {
    it("scopes the query to the caller's organization and client", async () => {
      await get(app, url, user());
      const [clientId, orgId] = repoArgs();
      expect(clientId).toBe(CLIENT);
      expect(orgId).toBe(ORG);
    });

    it('passes branch ids when the user is branch-restricted', async () => {
      await get(app, url, user({ branchIds: [BRANCH_A] }));
      expect(repoArgs()[2]).toEqual([BRANCH_A]);
    });

    it('passes no branch restriction for org-wide users', async () => {
      await get(app, url, user({ branchIds: [] }));
      expect(repoArgs()[2]).toBeUndefined();
    });

    it('ignores any organizationId supplied by the caller in the query string', async () => {
      await get(app, `${url}?organizationId=${randomUUID()}`, user());
      expect(repoArgs()[1]).toBe(ORG);
    });

    it('returns an empty page (not another tenant\'s data) when repo finds nothing', async () => {
      const res = await get(app, url, user());
      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.total).toBe(0);
    });
  });

  describe('pagination and filtering', () => {
    it('defaults to page 1, limit 20', async () => {
      await get(app, url, user());
      expect(repoArgs()[3]).toEqual({ page: 1, limit: 20 });
    });

    it('forwards page/limit and echoes repository paging', async () => {
      mocks.getClientVisitHistory.mockResolvedValue(page([{ id: 'v1' }], { page: 3, limit: 5, total: 11, totalPages: 3 }));
      const res = await get(app, `${url}?page=3&limit=5`, user());
      expect(repoArgs()[3]).toEqual({ page: 3, limit: 5 });
      expect(res.body.data).toMatchObject({ page: 3, limit: 5, total: 11, totalPages: 3 });
    });

    it('caps limit at 100', async () => {
      await get(app, `${url}?limit=500`, user());
      expect(repoArgs()[3].limit).toBe(100);
    });

    it.each(['page=0', 'page=-1', 'page=abc', 'limit=0', 'limit=abc'])('400 for invalid %s', async (qs) => {
      const res = await get(app, `${url}?${qs}`, user());
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid pagination parameters');
      expect(mocks.getClientVisitHistory).not.toHaveBeenCalled();
    });

    it('forwards a status filter to the repository', async () => {
      await get(app, `${url}?status=CANCELLED`, user());
      expect(repoArgs()[4]).toBe('CANCELLED');
    });

    it('400 for a malformed status filter', async () => {
      const res = await get(app, `${url}?status=x';DROP TABLE visits--`, user());
      expect(res.status).toBe(400);
      expect(mocks.getClientVisitHistory).not.toHaveBeenCalled();
    });

    it('applies no date window: no date params reach the repository (no 31-day cap)', async () => {
      await get(app, `${url}?startDate=2024-01-01&endDate=2024-01-31`, user());
      const args = repoArgs();
      expect(JSON.stringify(args)).not.toContain('2024-01');
      expect(args).toHaveLength(5);
    });

    it('returns old and recent visits together (distinct statuses preserved)', async () => {
      const items = [
        { id: 'v-new', scheduledDate: '2026-11-01', status: 'COMPLETED' },
        { id: 'v-canc', scheduledDate: '2025-03-01', status: 'CANCELLED' },
        { id: 'v-ns', scheduledDate: '2023-01-01', status: 'NO_SHOW_CLIENT' },
      ];
      mocks.getClientVisitHistory.mockResolvedValue(page(items));
      const res = await get(app, url, user());
      expect(res.body.data.items.map((i: { status: string }) => i.status)).toEqual([
        'COMPLETED',
        'CANCELLED',
        'NO_SHOW_CLIENT',
      ]);
    });
  });

  describe('response shape (minimum necessary)', () => {
    it('returns the repository page under data without adding fields', async () => {
      const item = {
        id: 'v1',
        visitNumber: 'V-1',
        status: 'COMPLETED',
        statusHistory: [{ id: 's1', fromStatus: null, toStatus: 'COMPLETED', timestamp: 't', changedBy: 'u', automatic: false }],
        caregiverFirstName: 'Pat',
        caregiverLastName: 'Lee',
      };
      mocks.getClientVisitHistory.mockResolvedValue(page([item]));
      const res = await get(app, url, user());
      expect(res.body).toEqual({ success: true, data: page([item]) });
      for (const banned of ['internalNotes', 'riskFlags', 'caregiverInstructions', 'address', 'clientNotes']) {
        expect(JSON.stringify(res.body)).not.toContain(banned);
      }
    });
  });

  describe('PHI audit trail', () => {
    it('writes one DATA_ACCESS audit event per successful read', async () => {
      mocks.getClientVisitHistory.mockResolvedValue(page([{ id: 'a' }, { id: 'b' }]));
      const u = JSON.parse(user({ branchIds: [BRANCH_A] }));
      await request(app).get(`${url}?page=2&limit=7`).set('x-test-user', JSON.stringify(u));

      expect(mocks.logEvent).toHaveBeenCalledTimes(1);
      const [ctx, event] = auditArgs();
      expect(ctx).toMatchObject({ userId: u.userId, organizationId: ORG, branchIds: [BRANCH_A] });
      expect(event).toMatchObject({
        eventType: 'DATA_ACCESS',
        resource: 'clients',
        resourceId: CLIENT,
        action: 'VIEW_VISIT_HISTORY',
        result: 'SUCCESS',
      });
      expect(event.metadata).toMatchObject({ visitCount: 2, page: 2, limit: 7 });
    });

    it('audit metadata never contains visit PHI (no names/notes)', async () => {
      mocks.getClientVisitHistory.mockResolvedValue(page([{ id: 'a', caregiverFirstName: 'Pat', serviceTypeName: 'Bath' }]));
      await get(app, url, user());
      const meta = JSON.stringify(auditArgs()[1].metadata);
      expect(meta).not.toContain('Pat');
      expect(meta).not.toContain('Bath');
    });

    it('does not audit denied or invalid requests', async () => {
      await get(app, url, user({ roles: ['HR'], permissions: ['visits:read'] }));
      await get(app, `${url}?page=0`, user());
      expect(mocks.logEvent).not.toHaveBeenCalled();
    });
  });

  describe('failure handling', () => {
    it('does not return data when the repository throws (forwarded to error handler)', async () => {
      mocks.getClientVisitHistory.mockRejectedValue(new Error('db down'));
      const errApp = express();
      errApp.use('/api', createClientVisitHistoryRouter({ getPool: () => ({}) } as never));
      errApp.use((_e: unknown, _req: unknown, res: express.Response, _n: unknown) => {
        res.status(500).json({ success: false });
      });
      const res = await request(errApp).get(url).set('x-test-user', user());
      expect(res.status).toBe(500);
      expect(res.body.data).toBeUndefined();
      expect(mocks.logEvent).not.toHaveBeenCalled();
    });
  });
});
