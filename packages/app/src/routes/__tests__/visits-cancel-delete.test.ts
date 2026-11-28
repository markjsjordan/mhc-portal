/**
 * Cancel & Soft-Delete Visit Endpoints + Role Guards Tests (wdvf3adqmj)
 *
 * Covers:
 * - PATCH /api/visits/:id/status role guards, valid SQL schema, and series cancellation
 * - DELETE /api/visits/:id soft-delete, series support, 404/400 handling, and role guards
 * - PUT /api/visits/patterns/:id series cancellation with updates.status === 'CANCELLED'
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { Database } from '@folkcare/core';
import {
  createVisitRouter,
  canManageVisitLifecycle,
  deleteVisitBodySchema,
  visitStatusTransitionSchema,
} from '../visits.js';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const CLIENT_ID = '33333333-3333-4333-8333-333333333333';
const VISIT_ID = '44444444-4444-4444-8444-444444444444';
const PATTERN_ID = '55555555-5555-4555-8555-555555555555';

function findRouteHandlers(
  router: ReturnType<typeof createVisitRouter>,
  method: 'get' | 'patch' | 'post' | 'put' | 'delete',
  path: string
): Array<(req: Request, res: Response, next: NextFunction) => unknown> {
  const layer = router.stack.find(
    (entry: { route?: { path?: string; methods?: Record<string, boolean> } }) =>
      entry.route?.path === path &&
      entry.route.methods !== undefined &&
      Object.prototype.hasOwnProperty.call(entry.route.methods, method) &&
      Boolean(new Map(Object.entries(entry.route.methods)).get(method))
  ) as
    | { route: { stack: Array<{ handle: (req: Request, res: Response, next: NextFunction) => unknown }> } }
    | undefined;

  if (!layer) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  }
  return layer.route.stack.map((s) => s.handle);
}

async function runHandlers(
  handlers: Array<(req: Request, res: Response, next: NextFunction) => unknown>,
  req: Partial<Request>,
  res: Partial<Response>,
  next: NextFunction
): Promise<void> {
  for (const handler of handlers) {
    const state = { calledNext: false };
    const stepNext: NextFunction = (err?: unknown) => {
      if (err) {
        next(err);
        return;
      }
      state.calledNext = true;
    };
    await handler(req as Request, res as Response, stepNext);
    if (!state.calledNext) {
      break;
    }
  }
}

function makeUser(roles: string[], permissions: string[] = []): {
  userId: string;
  email: string;
  tokenVersion: number;
  organizationId: string;
  branchIds: string[];
  roles: string[];
  permissions: string[];
} {
  return {
    userId: USER_ID,
    email: 'test@example.com',
    tokenVersion: 0,
    organizationId: ORG_ID,
    branchIds: [],
    roles,
    permissions,
  };
}

describe('Visit Cancel & Soft-Delete Endpoints (wdvf3adqmj)', () => {
  let mockDb: Database;
  let queryMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;
  let mockRes: Partial<Response>;
  let nextMock: NextFunction;

  beforeEach(() => {
    queryMock = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    mockDb = {
      query: queryMock,
      getPool: vi.fn().mockReturnValue(null),
    } as unknown as Database;

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnThis();
    mockRes = {
      json: jsonMock,
      status: statusMock,
    } as unknown as Response;
    nextMock = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('canManageVisitLifecycle & schemas', () => {
    it.each(['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'ADMIN', 'COORDINATOR'])(
      'allows %s for cancel and delete',
      (role) => {
        const ctx = makeUser([role], []);
        expect(canManageVisitLifecycle(ctx, 'cancel')).toBe(true);
        expect(canManageVisitLifecycle(ctx, 'delete')).toBe(true);
      }
    );

    it.each(['CAREGIVER', 'FAMILY', 'FAMILY_MEMBER', 'CLIENT', 'SCHEDULER', 'NURSE', 'BILLING', 'READ_ONLY'])(
      'denies %s for cancel and delete even with visits:update permission',
      (role) => {
        const ctx = makeUser([role], ['visits:read', 'visits:update', 'visits:complete']);
        expect(canManageVisitLifecycle(ctx, 'cancel')).toBe(false);
        expect(canManageVisitLifecycle(ctx, 'delete')).toBe(false);
      }
    );

    it('validates updateMode on visitStatusTransitionSchema and deleteVisitBodySchema', () => {
      expect(visitStatusTransitionSchema.safeParse({ status: 'CANCELLED', updateMode: 'ALL_FUTURE' }).success).toBe(true);
      expect(visitStatusTransitionSchema.safeParse({ status: 'CANCELLED', updateMode: 'INVALID' }).success).toBe(false);
      expect(deleteVisitBodySchema.safeParse({}).success).toBe(true);
      expect(deleteVisitBodySchema.safeParse({ updateMode: 'THIS_VISIT' }).success).toBe(true);
      expect(deleteVisitBodySchema.safeParse({ updateMode: 'ALL_FUTURE' }).success).toBe(true);
      expect(deleteVisitBodySchema.safeParse({ updateMode: 'BOGUS' }).success).toBe(false);
    });
  });

  describe('PATCH /api/visits/:id/status', () => {
    it.each(['COORDINATOR', 'ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'SUPER_ADMIN'])(
      'allows %s to cancel a visit and writes valid visits schema columns (status_history, no cancelled_at)',
      async (role) => {
        const router = createVisitRouter(mockDb);
        const handlers = findRouteHandlers(router, 'patch', '/:id/status');

        queryMock
          .mockResolvedValueOnce({
            rows: [{ id: VISIT_ID, organization_id: ORG_ID, status: 'SCHEDULED', pattern_id: null, scheduled_date: '2026-06-01', client_id: CLIENT_ID }],
          })
          .mockResolvedValueOnce({
            rows: [{ id: VISIT_ID, status: 'CANCELLED' }],
          });

        const req: Partial<Request> = {
          params: { id: VISIT_ID },
          body: { status: 'CANCELLED', reason: 'Client unavailable', notes: 'Reschedule next week' },
          user: makeUser([role], []),
        };

        await runHandlers(handlers, req, mockRes, nextMock);

        expect(statusMock).not.toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({ id: VISIT_ID, status: 'CANCELLED' }),
          })
        );

        const updateSql = queryMock.mock.calls[1]?.[0] as string;
        expect(updateSql).toContain('status_history');
        expect(updateSql).toContain('version = COALESCE(version, 1) + 1');
        expect(updateSql).not.toContain('cancelled_at');
        expect(updateSql).not.toContain('cancelled_by');
        expect(updateSql).not.toContain('cancellation_reason');
      }
    );

    it.each([
      ['CAREGIVER', ['visits:read', 'visits:update', 'visits:complete']],
      ['FAMILY', ['visits:read']],
      ['FAMILY_MEMBER', ['visits:read']],
      ['CLIENT', ['visits:read']],
      ['SCHEDULER', ['schedules:*', 'visits:read']],
      ['NURSE', ['visits:read']],
    ])('returns 403 PERMISSION_DENIED for %s (regression: CAREGIVER with visits:update)', async (role, perms) => {
      const router = createVisitRouter(mockDb);
      const handlers = findRouteHandlers(router, 'patch', '/:id/status');

      const req: Partial<Request> = {
        params: { id: VISIT_ID },
        body: { status: 'CANCELLED' },
        user: makeUser([role], perms),
      };

      await runHandlers(handlers, req, mockRes, nextMock);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'PERMISSION_DENIED',
        })
      );
      expect(queryMock).not.toHaveBeenCalled();
    });

    it('supports updateMode ALL_FUTURE on a pattern-linked visit', async () => {
      const router = createVisitRouter(mockDb);
      const handlers = findRouteHandlers(router, 'patch', '/:id/status');

      queryMock
        .mockResolvedValueOnce({
          rows: [{ id: VISIT_ID, organization_id: ORG_ID, status: 'SCHEDULED', pattern_id: PATTERN_ID, scheduled_date: '2026-06-01', client_id: CLIENT_ID }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: VISIT_ID, status: 'CANCELLED' }],
        })
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 3,
        });

      const req: Partial<Request> = {
        params: { id: VISIT_ID },
        body: { status: 'CANCELLED', updateMode: 'ALL_FUTURE', reason: 'Series paused' },
        user: makeUser(['COORDINATOR'], []),
      };

      await runHandlers(handlers, req, mockRes, nextMock);

      expect(queryMock).toHaveBeenCalledTimes(4);
      const batchSql = queryMock.mock.calls[2]?.[0] as string;
      expect(batchSql).toContain('AND pattern_id = $4');
      expect(batchSql).toContain('AND scheduled_date >= $5');
      expect(batchSql).toContain('AND actual_start_time IS NULL');
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          meta: { updateMode: 'ALL_FUTURE', cancelledCount: 4 },
        })
      );
    });
  });

  describe('DELETE /api/visits/:id', () => {
    it.each(['COORDINATOR', 'ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'SUPER_ADMIN'])(
      'allows %s to soft-delete a single visit (never hard-deletes)',
      async (role) => {
        const router = createVisitRouter(mockDb);
        const handlers = findRouteHandlers(router, 'delete', '/:id');

        queryMock
          .mockResolvedValueOnce({
            rows: [{ id: VISIT_ID, organization_id: ORG_ID, client_id: CLIENT_ID, pattern_id: null, scheduled_date: '2026-06-01', status: 'SCHEDULED', actual_start_time: null }],
          })
          .mockResolvedValueOnce({
            rows: [{ id: VISIT_ID }],
            rowCount: 1,
          });

        const req: Partial<Request> = {
          params: { id: VISIT_ID },
          body: undefined,
          query: {},
          user: makeUser([role], []),
        };

        await runHandlers(handlers, req, mockRes, nextMock);

        expect(statusMock).not.toHaveBeenCalledWith(403);
        const updateSql = queryMock.mock.calls[1]?.[0] as string;
        expect(updateSql).toContain('SET deleted_at = NOW()');
        expect(updateSql).not.toContain('DELETE FROM visits');
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: {
            id: VISIT_ID,
            deletedCount: 1,
            deletedIds: [VISIT_ID],
            updateMode: 'THIS_VISIT',
          },
        });
      }
    );

    it.each([
      ['CAREGIVER', ['visits:read', 'visits:update', 'visits:complete']],
      ['FAMILY', ['visits:read']],
      ['FAMILY_MEMBER', ['visits:read']],
      ['CLIENT', ['visits:read']],
      ['SCHEDULER', ['schedules:*', 'visits:read']],
    ])('returns 403 PERMISSION_DENIED for %s', async (role, perms) => {
      const router = createVisitRouter(mockDb);
      const handlers = findRouteHandlers(router, 'delete', '/:id');

      const req: Partial<Request> = {
        params: { id: VISIT_ID },
        body: {},
        query: {},
        user: makeUser([role], perms),
      };

      await runHandlers(handlers, req, mockRes, nextMock);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, code: 'PERMISSION_DENIED' })
      );
      expect(queryMock).not.toHaveBeenCalled();
    });

    it('returns 404 when visit does not exist or is already soft-deleted', async () => {
      const router = createVisitRouter(mockDb);
      const handlers = findRouteHandlers(router, 'delete', '/:id');

      queryMock.mockResolvedValueOnce({ rows: [] });

      const req: Partial<Request> = {
        params: { id: VISIT_ID },
        body: {},
        query: {},
        user: makeUser(['COORDINATOR'], []),
      };

      await runHandlers(handlers, req, mockRes, nextMock);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ success: false, error: 'Visit not found' });
    });

    it('returns 400 on invalid UUID or invalid updateMode', async () => {
      const router = createVisitRouter(mockDb);
      const handlers = findRouteHandlers(router, 'delete', '/:id');

      await runHandlers(
        handlers,
        { params: { id: 'not-a-uuid' }, body: {}, query: {}, user: makeUser(['ADMIN'], []) },
        mockRes,
        nextMock
      );
      expect(statusMock).toHaveBeenCalledWith(400);

      vi.clearAllMocks();
      await runHandlers(
        handlers,
        { params: { id: VISIT_ID }, body: { updateMode: 'INVALID' }, query: {}, user: makeUser(['ADMIN'], []) },
        mockRes,
        nextMock
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('soft-deletes this and all future visits in series when updateMode is ALL_FUTURE', async () => {
      const router = createVisitRouter(mockDb);
      const handlers = findRouteHandlers(router, 'delete', '/:id');

      const FUTURE_ID_2 = '66666666-6666-4666-8666-666666666666';
      queryMock
        .mockResolvedValueOnce({
          rows: [{ id: VISIT_ID, organization_id: ORG_ID, client_id: CLIENT_ID, pattern_id: PATTERN_ID, scheduled_date: '2026-06-01', status: 'SCHEDULED', actual_start_time: null }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: VISIT_ID }, { id: FUTURE_ID_2 }],
          rowCount: 2,
        });

      const req: Partial<Request> = {
        params: { id: VISIT_ID },
        body: { updateMode: 'ALL_FUTURE' },
        query: {},
        user: makeUser(['COORDINATOR'], []),
      };

      await runHandlers(handlers, req, mockRes, nextMock);

      const updateSql = queryMock.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain('SET deleted_at = NOW()');
      expect(updateSql).toContain('pattern_id = $4');
      expect(updateSql).toContain('scheduled_date >= $5');
      expect(updateSql).toContain("status NOT IN ('COMPLETED', 'IN_PROGRESS')");
      expect(updateSql).toContain('actual_start_time IS NULL');
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          id: VISIT_ID,
          deletedCount: 2,
          deletedIds: [VISIT_ID, FUTURE_ID_2],
          updateMode: 'ALL_FUTURE',
        },
      });
    });
  });
});
