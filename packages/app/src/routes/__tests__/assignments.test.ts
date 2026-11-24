import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, Router } from 'express';
import type { Database } from '@folkcare/core';
import { createAssignmentsRouter } from '../assignments.js';
import {
  checkSpecialtyMatch,
  checkAvailabilityWindow,
  hasTimeOverlap,
} from '../../services/assignment-service.js';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const COORDINATOR_ID = '22222222-2222-4222-8222-222222222222';
const CAREGIVER_USER_ID = '33333333-3333-4333-8333-333333333333';
const CAREGIVER_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_CAREGIVER_ID = '55555555-5555-4555-8555-555555555555';
const VISIT_ID = '66666666-6666-4666-8666-666666666666';
const ASSIGNMENT_ID = '77777777-7777-4777-8777-777777777777';

interface MockRes {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockRes;
  json: (payload: unknown) => MockRes;
}

function makeRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function getRouteHandler(
  router: Router,
  path: string,
  method: 'get' | 'post' | 'put' | 'delete'
): (req: Request, res: Response) => Promise<void> {
  const stack = (
    router as unknown as {
      stack: Array<{
        route?: {
          path: string;
          stack: Array<{
            method: string;
            handle: (req: Request, res: Response) => Promise<void>;
          }>;
        };
      }>;
    }
  ).stack;
  const layer = stack.find(
    (l) => l.route?.path === path && l.route.stack.some((s) => s.method === method)
  );
  if (!layer?.route) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  }
  const routeLayers = layer.route.stack.filter((s) => s.method === method);
  return routeLayers[routeLayers.length - 1]!.handle;
}

describe('Assignment rule helpers (E2 / wdvf3adf61)', () => {
  it('matches specialties case-insensitively and allows when unset', () => {
    expect(checkSpecialtyMatch(['Skilled Nursing', 'Personal Care'], 'personal care')).toBe(true);
    expect(checkSpecialtyMatch(['Skilled Nursing'], 'Personal Care')).toBe(false);
    expect(checkSpecialtyMatch([], 'Personal Care')).toBe(true);
  });

  it('detects unavailable date ranges and outside weekly hours', () => {
    const availability = {
      weeklyHours: {
        monday: [{ start: '08:00', end: '16:00' }],
      },
      unavailableDates: [
        { startDate: '2026-11-23', endDate: '2026-11-25', reason: 'PTO' },
      ],
      serviceSpecialties: ['Personal Care'],
    };

    // 2026-11-23 is a Monday, falls in unavailable range
    const ptoViolations = checkAvailabilityWindow(
      availability,
      new Date('2026-11-23T09:00:00Z'),
      new Date('2026-11-23T11:00:00Z')
    );
    expect(ptoViolations.some((v) => v.code === 'UNAVAILABLE_DATE')).toBe(true);

    // 2026-11-30 is a Monday, outside 08:00-16:00
    const hoursViolations = checkAvailabilityWindow(
      availability,
      new Date('2026-11-30T17:00:00Z'),
      new Date('2026-11-30T19:00:00Z')
    );
    expect(hoursViolations.some((v) => v.code === 'OUTSIDE_WEEKLY_HOURS')).toBe(true);

    // 2026-11-30 09:00-11:00 is valid
    const valid = checkAvailabilityWindow(
      availability,
      new Date('2026-11-30T09:00:00Z'),
      new Date('2026-11-30T11:00:00Z')
    );
    expect(valid).toHaveLength(0);
  });

  it('detects overlapping time intervals accurately', () => {
    expect(
      hasTimeOverlap(
        new Date('2026-11-30T09:00:00Z'),
        new Date('2026-11-30T11:00:00Z'),
        new Date('2026-11-30T10:00:00Z'),
        new Date('2026-11-30T12:00:00Z')
      )
    ).toBe(true);

    expect(
      hasTimeOverlap(
        new Date('2026-11-30T09:00:00Z'),
        new Date('2026-11-30T11:00:00Z'),
        new Date('2026-11-30T11:00:00Z'),
        new Date('2026-11-30T13:00:00Z')
      )
    ).toBe(false);
  });
});

describe('/api/assignments router (E2 / wdvf3adf61)', () => {
  it('POST / forbids caregivers from creating assignments (403)', async () => {
    const query = vi.fn();
    const router = createAssignmentsRouter({ query } as unknown as Database);
    const handler = getRouteHandler(router, '/', 'post');

    const req = {
      user: {
        userId: CAREGIVER_USER_ID,
        organizationId: ORG_ID,
        roles: ['CAREGIVER'],
      },
      body: { caregiverId: CAREGIVER_ID, visitId: VISIT_ID },
    } as unknown as Request;
    const res = makeRes();

    await handler(req, res as unknown as Response);
    expect(res.statusCode).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('POST / creates assignment with audit trail when no conflicts exist', async () => {
    const query = vi
      .fn()
      // 1. Load visit
      .mockResolvedValueOnce({
        rows: [
          {
            id: VISIT_ID,
            scheduled_start: '2026-11-30T09:00:00Z',
            scheduled_end: '2026-11-30T11:00:00Z',
            visit_type: 'Personal Care',
          },
        ],
      })
      // 2. Load caregiver availability
      .mockResolvedValueOnce({ rows: [] })
      // 3. Check overlapping assignments
      .mockResolvedValueOnce({ rows: [] })
      // 4. Insert assignment
      .mockResolvedValueOnce({
        rows: [
          {
            id: ASSIGNMENT_ID,
            organization_id: ORG_ID,
            caregiver_id: CAREGIVER_ID,
            visit_id: VISIT_ID,
            status: 'PENDING_ACCEPTANCE',
            assigned_by: COORDINATOR_ID,
            assigned_at: '2026-11-24T12:00:00Z',
            updated_by: COORDINATOR_ID,
            updated_at: '2026-11-24T12:00:00Z',
            notes: 'Primary caregiver',
            conflict_warning: false,
            audit_history: [
              {
                action: 'ASSIGNED',
                actorId: COORDINATOR_ID,
                timestamp: '2026-11-24T12:00:00Z',
                previousStatus: null,
                newStatus: 'PENDING_ACCEPTANCE',
              },
            ],
          },
        ],
      })
      // 5. Sync visits.caregiver_id
      .mockResolvedValueOnce({ rows: [] });

    const router = createAssignmentsRouter({ query } as unknown as Database);
    const handler = getRouteHandler(router, '/', 'post');

    const req = {
      user: {
        userId: COORDINATOR_ID,
        organizationId: ORG_ID,
        roles: ['COORDINATOR'],
      },
      body: {
        caregiverId: CAREGIVER_ID,
        visitId: VISIT_ID,
        notes: 'Primary caregiver',
      },
    } as unknown as Request;
    const res = makeRes();

    await handler(req, res as unknown as Response);
    expect(res.statusCode).toBe(201);
    const body = res.body as {
      success: boolean;
      data: { id: string; status: string; assignedBy: string; auditHistory: unknown[] };
    };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('PENDING_ACCEPTANCE');
    expect(body.data.assignedBy).toBe(COORDINATOR_ID);
    expect(body.data.auditHistory).toHaveLength(1);
  });

  it('POST / returns 409 Conflict when caregiver is double-booked', async () => {
    const query = vi
      .fn()
      // 1. Load visit
      .mockResolvedValueOnce({
        rows: [
          {
            id: VISIT_ID,
            scheduled_start: '2026-11-30T09:00:00Z',
            scheduled_end: '2026-11-30T11:00:00Z',
            visit_type: 'Personal Care',
          },
        ],
      })
      // 2. Load availability
      .mockResolvedValueOnce({ rows: [] })
      // 3. Overlapping assignment found
      .mockResolvedValueOnce({
        rows: [
          {
            id: '88888888-8888-8888-8888-888888888888',
            visit_id: '99999999-9999-9999-9999-999999999999',
            status: 'ACCEPTED',
            scheduled_start: '2026-11-30T10:00:00Z',
            scheduled_end: '2026-11-30T12:00:00Z',
          },
        ],
      });

    const router = createAssignmentsRouter({ query } as unknown as Database);
    const handler = getRouteHandler(router, '/', 'post');

    const req = {
      user: {
        userId: COORDINATOR_ID,
        organizationId: ORG_ID,
        roles: ['COORDINATOR'],
      },
      body: { caregiverId: CAREGIVER_ID, visitId: VISIT_ID },
    } as unknown as Request;
    const res = makeRes();

    await handler(req, res as unknown as Response);
    expect(res.statusCode).toBe(409);
    const body = res.body as { success: boolean; violations: Array<{ code: string }> };
    expect(body.success).toBe(false);
    expect(body.violations[0]?.code).toBe('TIME_CONFLICT');
  });

  it('GET / scopes caregiver users to their own assignments only', async () => {
    const query = vi
      .fn()
      // 1. Resolve caregiver_id for user
      .mockResolvedValueOnce({ rows: [{ id: CAREGIVER_ID }] })
      // 2. COUNT
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      // 3. SELECT assignments
      .mockResolvedValueOnce({
        rows: [
          {
            id: ASSIGNMENT_ID,
            organization_id: ORG_ID,
            caregiver_id: CAREGIVER_ID,
            visit_id: VISIT_ID,
            status: 'ACCEPTED',
            assigned_by: COORDINATOR_ID,
            assigned_at: '2026-11-24T12:00:00Z',
            updated_by: CAREGIVER_USER_ID,
            updated_at: '2026-11-24T12:05:00Z',
            notes: null,
            conflict_warning: false,
            audit_history: [],
          },
        ],
      });

    const router = createAssignmentsRouter({ query } as unknown as Database);
    const handler = getRouteHandler(router, '/', 'get');

    const req = {
      user: {
        userId: CAREGIVER_USER_ID,
        organizationId: ORG_ID,
        roles: ['CAREGIVER'],
      },
      // Attempt to query another caregiver's assignments — must be ignored
      query: { caregiverId: OTHER_CAREGIVER_ID },
    } as unknown as Request;
    const res = makeRes();

    await handler(req, res as unknown as Response);
    expect(res.statusCode).toBe(200);
    // Verify SQL query used CAREGIVER_ID, not OTHER_CAREGIVER_ID
    const countParams = query.mock.calls[1]?.[1] as unknown[];
    expect(countParams).toContain(CAREGIVER_ID);
    expect(countParams).not.toContain(OTHER_CAREGIVER_ID);
  });

  it('PUT /:id/status forbids caregiver from updating another caregiver assignment (403)', async () => {
    const query = vi
      .fn()
      // 1. Resolve caregiver_id
      .mockResolvedValueOnce({ rows: [{ id: CAREGIVER_ID }] })
      // 2. Load assignment belonging to OTHER_CAREGIVER_ID
      .mockResolvedValueOnce({
        rows: [
          {
            id: ASSIGNMENT_ID,
            organization_id: ORG_ID,
            caregiver_id: OTHER_CAREGIVER_ID,
            visit_id: VISIT_ID,
            status: 'PENDING_ACCEPTANCE',
            assigned_by: COORDINATOR_ID,
            assigned_at: '2026-11-24T12:00:00Z',
            updated_by: null,
            updated_at: '2026-11-24T12:00:00Z',
            notes: null,
            conflict_warning: false,
            audit_history: [],
          },
        ],
      });

    const router = createAssignmentsRouter({ query } as unknown as Database);
    const handler = getRouteHandler(router, '/:id/status', 'put');

    const req = {
      user: {
        userId: CAREGIVER_USER_ID,
        organizationId: ORG_ID,
        roles: ['CAREGIVER'],
      },
      params: { id: ASSIGNMENT_ID },
      body: { status: 'ACCEPTED' },
    } as unknown as Request;
    const res = makeRes();

    await handler(req, res as unknown as Response);
    expect(res.statusCode).toBe(403);
  });

  it('PUT /:id/status updates status and appends audit history', async () => {
    const query = vi
      .fn()
      // 1. Load existing assignment
      .mockResolvedValueOnce({
        rows: [
          {
            id: ASSIGNMENT_ID,
            organization_id: ORG_ID,
            caregiver_id: CAREGIVER_ID,
            visit_id: VISIT_ID,
            status: 'PENDING_ACCEPTANCE',
            assigned_by: COORDINATOR_ID,
            assigned_at: '2026-11-24T12:00:00Z',
            updated_by: null,
            updated_at: '2026-11-24T12:00:00Z',
            notes: null,
            conflict_warning: false,
            audit_history: [],
          },
        ],
      })
      // 2. Update status
      .mockResolvedValueOnce({
        rows: [
          {
            id: ASSIGNMENT_ID,
            organization_id: ORG_ID,
            caregiver_id: CAREGIVER_ID,
            visit_id: VISIT_ID,
            status: 'ACCEPTED',
            assigned_by: COORDINATOR_ID,
            assigned_at: '2026-11-24T12:00:00Z',
            updated_by: COORDINATOR_ID,
            updated_at: '2026-11-24T12:10:00Z',
            notes: 'Confirmed',
            conflict_warning: false,
            audit_history: [
              {
                action: 'STATUS_CHANGED',
                actorId: COORDINATOR_ID,
                timestamp: '2026-11-24T12:10:00Z',
                previousStatus: 'PENDING_ACCEPTANCE',
                newStatus: 'ACCEPTED',
              },
            ],
          },
        ],
      });

    const router = createAssignmentsRouter({ query } as unknown as Database);
    const handler = getRouteHandler(router, '/:id/status', 'put');

    const req = {
      user: {
        userId: COORDINATOR_ID,
        organizationId: ORG_ID,
        roles: ['COORDINATOR'],
      },
      params: { id: ASSIGNMENT_ID },
      body: { status: 'ACCEPTED', notes: 'Confirmed' },
    } as unknown as Request;
    const res = makeRes();

    await handler(req, res as unknown as Response);
    expect(res.statusCode).toBe(200);
    const body = res.body as {
      success: boolean;
      data: { status: string; auditHistory: Array<{ action: string; newStatus: string }> };
    };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ACCEPTED');
    expect(body.data.auditHistory[0]?.newStatus).toBe('ACCEPTED');
  });
});
