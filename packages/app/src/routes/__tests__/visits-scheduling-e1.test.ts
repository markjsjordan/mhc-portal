/**
 * E1 Scheduling Infrastructure Tests (wdvf3adf60)
 *
 * Tests for:
 * - GET /api/visits (search by client, date range, status, permission checks)
 * - PATCH /api/visits/:id/status (status transitions, terminal state guards, permissions)
 * - Zod validation schemas for visit search and status transitions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { Database } from '@folkcare/core';
import {
  createVisitRouter,
  isValidVisitStatusTransition,
  visitSearchQuerySchema,
  visitStatusTransitionSchema,
} from '../visits.js';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const CLIENT_ID = '33333333-3333-4333-8333-333333333333';
const VISIT_ID = '44444444-4444-4444-8444-444444444444';

function findRouteHandlers(
  router: ReturnType<typeof createVisitRouter>,
  method: 'get' | 'patch' | 'post' | 'put',
  path: string
): Array<(req: Request, res: Response, next: NextFunction) => unknown> {
  const layer = router.stack.find(
    (entry: { route?: { path?: string; methods?: Record<string, boolean> } }) =>
      entry.route?.path === path && entry.route?.methods?.[method]
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
    let calledNext = false;
    const stepNext: NextFunction = (err?: unknown) => {
      if (err) {
        next(err);
        return;
      }
      calledNext = true;
    };
    await handler(req as Request, res as Response, stepNext);
    if (!calledNext) {
      break;
    }
  }
}

describe('E1 Scheduling Infrastructure (wdvf3adf60)', () => {
  let mockDb: Database;
  let queryMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;
  let mockRes: Partial<Response>;
  let nextMock: NextFunction;

  beforeEach(() => {
    queryMock = vi.fn().mockResolvedValue({ rows: [] });
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

  describe('isValidVisitStatusTransition', () => {
    it('allows SCHEDULED -> COMPLETED, CANCELLED, and NO_SHOW', () => {
      expect(isValidVisitStatusTransition('SCHEDULED', 'COMPLETED')).toBe(true);
      expect(isValidVisitStatusTransition('SCHEDULED', 'CANCELLED')).toBe(true);
      expect(isValidVisitStatusTransition('SCHEDULED', 'NO_SHOW')).toBe(true);
    });

    it('rejects transitions from terminal statuses (COMPLETED, CANCELLED, NO_SHOW)', () => {
      expect(isValidVisitStatusTransition('COMPLETED', 'CANCELLED')).toBe(false);
      expect(isValidVisitStatusTransition('COMPLETED', 'SCHEDULED')).toBe(false);
      expect(isValidVisitStatusTransition('CANCELLED', 'COMPLETED')).toBe(false);
      expect(isValidVisitStatusTransition('NO_SHOW', 'COMPLETED')).toBe(false);
    });
  });

  describe('Zod validation schemas', () => {
    it('validates visitSearchQuerySchema filters', () => {
      const valid = visitSearchQuerySchema.safeParse({
        client_id: CLIENT_ID,
        start_date: '2026-05-01',
        end_date: '2026-05-31',
        status: 'SCHEDULED',
      });
      expect(valid.success).toBe(true);

      const invalidDate = visitSearchQuerySchema.safeParse({
        start_date: '05/01/2026',
      });
      expect(invalidDate.success).toBe(false);
    });

    it('validates visitStatusTransitionSchema', () => {
      expect(visitStatusTransitionSchema.safeParse({ status: 'COMPLETED' }).success).toBe(true);
      expect(visitStatusTransitionSchema.safeParse({ status: 'CANCELLED', reason: 'Client requested' }).success).toBe(true);
      expect(visitStatusTransitionSchema.safeParse({ status: 'NO_SHOW' }).success).toBe(true);
      expect(visitStatusTransitionSchema.safeParse({ status: 'INVALID_STATUS' }).success).toBe(false);
    });
  });

  describe('GET / (Search Visits)', () => {
    it('returns filtered visits for a coordinator by client, date range, and status', async () => {
      const router = createVisitRouter(mockDb);
      const handlers = findRouteHandlers(router, 'get', '/');

      queryMock.mockResolvedValueOnce({
        rows: [
          {
            id: VISIT_ID,
            client_id: CLIENT_ID,
            scheduled_date: '2026-05-10',
            status: 'SCHEDULED',
          },
        ],
      });

      const req: Partial<Request> = {
        query: {
          client_id: CLIENT_ID,
          start_date: '2026-05-01',
          end_date: '2026-05-31',
          status: 'SCHEDULED',
        },
        user: {
          userId: USER_ID,
          email: 'coordinator@example.com',
          tokenVersion: 0,
          organizationId: ORG_ID,
          branchIds: [],
          roles: ['COORDINATOR'],
          permissions: ['visits:read'],
        },
      };

      await runHandlers(handlers, req, mockRes, nextMock);

      expect(queryMock).toHaveBeenCalledTimes(1);
      const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('v.organization_id = $1');
      expect(sql).toContain('v.client_id = $2');
      expect(sql).toContain('v.scheduled_date >= $3');
      expect(sql).toContain('v.scheduled_date <= $4');
      expect(sql).toContain('v.status = ANY($5::text[])');
      expect(params).toEqual([ORG_ID, CLIENT_ID, '2026-05-01', '2026-05-31', ['SCHEDULED'], 100, 0]);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: VISIT_ID,
            client_id: CLIENT_ID,
            scheduled_date: '2026-05-10',
            status: 'SCHEDULED',
          },
        ],
        meta: { count: 1, limit: 100, offset: 0 },
      });
    });

    it('denies access (403) when user lacks scheduling read permission', async () => {
      const router = createVisitRouter(mockDb);
      const handlers = findRouteHandlers(router, 'get', '/');

      const req: Partial<Request> = {
        query: {},
        user: {
          userId: USER_ID,
          email: 'family@example.com',
          tokenVersion: 0,
          organizationId: ORG_ID,
          branchIds: [],
          roles: ['FAMILY_MEMBER'],
          permissions: [],
        },
      };

      await runHandlers(handlers, req, mockRes, nextMock);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(queryMock).not.toHaveBeenCalled();
    });

    it('returns 400 when end_date is before start_date', async () => {
      const router = createVisitRouter(mockDb);
      const handlers = findRouteHandlers(router, 'get', '/');

      const req: Partial<Request> = {
        query: {
          start_date: '2026-05-20',
          end_date: '2026-05-10',
        },
        user: {
          userId: USER_ID,
          email: 'coordinator@example.com',
          tokenVersion: 0,
          organizationId: ORG_ID,
          branchIds: [],
          roles: ['COORDINATOR'],
          permissions: [],
        },
      };

      await runHandlers(handlers, req, mockRes, nextMock);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(queryMock).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /:id/status (Status Transitions)', () => {
    it('transitions SCHEDULED -> CANCELLED with reason and returns updated visit', async () => {
      const router = createVisitRouter(mockDb);
      const handlers = findRouteHandlers(router, 'patch', '/:id/status');

      queryMock
        .mockResolvedValueOnce({
          rows: [{ id: VISIT_ID, organization_id: ORG_ID, status: 'SCHEDULED' }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: VISIT_ID, organization_id: ORG_ID, status: 'CANCELLED', cancellation_reason: 'Client sick' }],
        });

      const req: Partial<Request> = {
        params: { id: VISIT_ID },
        body: { status: 'CANCELLED', reason: 'Client sick' },
        user: {
          userId: USER_ID,
          email: 'coordinator@example.com',
          tokenVersion: 0,
          organizationId: ORG_ID,
          branchIds: [],
          roles: ['COORDINATOR'],
          permissions: [],
        },
      };

      await runHandlers(handlers, req, mockRes, nextMock);

      expect(queryMock).toHaveBeenCalledTimes(3);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ id: VISIT_ID, status: 'CANCELLED' }),
      });
    });

    it('returns 409 Conflict on invalid transition COMPLETED -> CANCELLED', async () => {
      const router = createVisitRouter(mockDb);
      const handlers = findRouteHandlers(router, 'patch', '/:id/status');

      queryMock.mockResolvedValueOnce({
        rows: [{ id: VISIT_ID, organization_id: ORG_ID, status: 'COMPLETED' }],
      });

      const req: Partial<Request> = {
        params: { id: VISIT_ID },
        body: { status: 'CANCELLED' },
        user: {
          userId: USER_ID,
          email: 'coordinator@example.com',
          tokenVersion: 0,
          organizationId: ORG_ID,
          branchIds: [],
          roles: ['COORDINATOR'],
          permissions: [],
        },
      };

      await runHandlers(handlers, req, mockRes, nextMock);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INVALID_STATUS_TRANSITION',
        })
      );
    });

    it('denies access (403) when user lacks scheduling update permission', async () => {
      const router = createVisitRouter(mockDb);
      const handlers = findRouteHandlers(router, 'patch', '/:id/status');

      const req: Partial<Request> = {
        params: { id: VISIT_ID },
        body: { status: 'COMPLETED' },
        user: {
          userId: USER_ID,
          email: 'caregiver@example.com',
          tokenVersion: 0,
          organizationId: ORG_ID,
          branchIds: [],
          roles: ['CAREGIVER'],
          permissions: ['visits:read'],
        },
      };

      await runHandlers(handlers, req, mockRes, nextMock);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(queryMock).not.toHaveBeenCalled();
    });
  });
});
