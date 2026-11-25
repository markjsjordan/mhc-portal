/**
 * Unit tests for E3 Visit Documentation & Completion (wdvf3adf62)
 *
 * Covers:
 *  - Time calculation (actual duration vs scheduled duration, variance, validation)
 *  - Completion creation (tasks, observations, adverse events, PIN/signature confirmation)
 *  - Status transitions (ASSIGNED -> COMPLETED | NO_SHOW, rejecting locked/unassigned)
 *  - Coordinator post-submit edit with immutable audit trail diff
 *  - Route permission checks (caregiver scope, coordinator/admin access, family denied)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import type { Database, UserContext } from '@folkcare/core';
import {
  VisitCompletionService,
  CompleteVisitSchema,
  calculateActualDurationMinutes,
  hashConfirmationValue,
  VisitCompletionError,
} from '../../services/visit-completion-service.js';
import { createVisitRouter } from '../visits.js';

vi.mock('@folkcare/core', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@folkcare/core')>();
  return {
    ...mod,
    AuthMiddleware: class {
      requireAuth = (_req: Request, _res: Response, next: NextFunction): void => {
        next();
      };
      auditImpersonatedActions = (_req: Request, _res: Response, next: NextFunction): void => {
        next();
      };
    },
  };
});

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const VISIT_ID = '22222222-2222-4222-8222-222222222222';
const CAREGIVER_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_CAREGIVER_ID = '44444444-4444-4444-8444-444444444444';
const USER_ID = '55555555-5555-4555-8555-555555555555';
const COMPLETION_ID = '66666666-6666-4666-8666-666666666666';

const TIME_IN = '2026-11-24T09:00:00.000Z';
const TIME_OUT = '2026-11-24T10:15:00.000Z';

function makeCompletionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: COMPLETION_ID,
    organization_id: ORG_ID,
    visit_id: VISIT_ID,
    caregiver_id: CAREGIVER_ID,
    outcome: 'COMPLETED',
    tasks_completed: [{ id: 't1', title: 'Medication reminder', completed: true }],
    observations: 'Client in good spirits',
    adverse_events: null,
    time_in: TIME_IN,
    time_out: TIME_OUT,
    actual_duration: 75,
    scheduled_duration: 60,
    duration_variance: 15,
    confirmation_method: 'PIN',
    confirmed_by: USER_ID,
    confirmed_at: '2026-11-24T10:16:00.000Z',
    audit_history: [
      {
        action: 'COMPLETED',
        actorId: USER_ID,
        actorRoles: ['CAREGIVER'],
        timestamp: '2026-11-24T10:16:00.000Z',
        summary: 'Visit marked COMPLETED (1/1 tasks, 75m actual vs 60m scheduled)',
      },
    ],
    created_by: USER_ID,
    created_at: '2026-11-24T10:16:00.000Z',
    updated_by: USER_ID,
    updated_at: '2026-11-24T10:16:00.000Z',
    ...overrides,
  };
}

function createMockDb(queryImpl: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>): Database {
  return {
    query: vi.fn(queryImpl),
  } as unknown as Database;
}

function buildTestApp(db: Database, user: Partial<UserContext>): express.Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = {
      userId: USER_ID,
      email: 'test@example.com',
      tokenVersion: 1,
      organizationId: ORG_ID,
      branchIds: [],
      roles: ['COORDINATOR'],
      permissions: ['visits:read', 'visits:update'],
      ...user,
    } as Request['user'];
    next();
  });
  app.use('/api/visits', createVisitRouter(db));
  return app;
}

describe('VisitCompletionService & duration helpers (wdvf3adf62)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates actual duration in minutes accurately', () => {
    expect(calculateActualDurationMinutes(TIME_IN, TIME_OUT)).toBe(75);
    expect(calculateActualDurationMinutes(TIME_IN, TIME_IN)).toBe(0);
    expect(() => calculateActualDurationMinutes(TIME_OUT, TIME_IN)).toThrow(VisitCompletionError);
    expect(() => calculateActualDurationMinutes('invalid', TIME_OUT)).toThrow(VisitCompletionError);
  });

  it('validates PIN / SIGNATURE requirements in CompleteVisitSchema', () => {
    const missingPin = CompleteVisitSchema.safeParse({
      outcome: 'COMPLETED',
      timeIn: TIME_IN,
      timeOut: TIME_OUT,
      confirmationMethod: 'PIN',
    });
    expect(missingPin.success).toBe(false);

    const validPin = CompleteVisitSchema.safeParse({
      outcome: 'COMPLETED',
      timeIn: TIME_IN,
      timeOut: TIME_OUT,
      confirmationMethod: 'PIN',
      confirmationPin: '1234',
    });
    expect(validPin.success).toBe(true);

    const noShowWithoutPin = CompleteVisitSchema.safeParse({
      outcome: 'NO_SHOW',
      timeIn: TIME_IN,
      timeOut: TIME_IN,
      confirmationMethod: 'PIN',
    });
    expect(noShowWithoutPin.success).toBe(true);
  });

  it('completes an ASSIGNED visit, hashes PIN, computes variance, and records audit trail', async () => {
    const queries: Array<{ sql: string; params?: unknown[] }> = [];
    const db = createMockDb(async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('FROM visits')) {
        return {
          rows: [
            {
              id: VISIT_ID,
              status: 'ASSIGNED',
              scheduled_duration: 60,
              assigned_caregiver_id: CAREGIVER_ID,
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO visit_completions')) {
        return { rows: [makeCompletionRow()] };
      }
      return { rows: [] };
    });

    const service = new VisitCompletionService(db);
    const result = await service.completeVisit(
      ORG_ID,
      VISIT_ID,
      {
        outcome: 'COMPLETED',
        tasksCompleted: [{ id: 't1', title: 'Medication reminder', completed: true }],
        observations: 'Client in good spirits',
        timeIn: TIME_IN,
        timeOut: TIME_OUT,
        confirmationMethod: 'PIN',
        confirmationPin: '4321',
      },
      { userId: USER_ID, roles: ['CAREGIVER'], caregiverId: CAREGIVER_ID }
    );

    expect(result.actualDuration).toBe(75);
    expect(result.scheduledDuration).toBe(60);
    expect(result.durationVariance).toBe(15);
    expect(result.auditHistory).toHaveLength(1);
    expect(result.auditHistory[0]?.action).toBe('COMPLETED');

    const insertCall = queries.find((q) => q.sql.includes('INSERT INTO visit_completions'));
    expect(insertCall).toBeDefined();
    // Raw PIN must never be passed to DB — hashed value must be stored instead
    expect(insertCall?.params).not.toContain('4321');
    expect(insertCall?.params).toContain(hashConfirmationValue('4321'));
  });

  it('rejects completing a visit that is already COMPLETED or UNASSIGNED', async () => {
    const db = createMockDb(async () => ({
      rows: [{ id: VISIT_ID, status: 'COMPLETED', scheduled_duration: 60, assigned_caregiver_id: CAREGIVER_ID }],
    }));

    const service = new VisitCompletionService(db);
    await expect(
      service.completeVisit(
        ORG_ID,
        VISIT_ID,
        {
          outcome: 'COMPLETED',
          tasksCompleted: [],
          timeIn: TIME_IN,
          timeOut: TIME_OUT,
          confirmationMethod: 'PIN',
          confirmationPin: '1234',
        },
        { userId: USER_ID, roles: ['COORDINATOR'] }
      )
    ).rejects.toMatchObject({ statusCode: 409, code: 'INVALID_STATUS_TRANSITION' });
  });

  it('allows coordinator post-submit edit and appends EDITED audit trail entry', async () => {
    const editedRow = makeCompletionRow({
      observations: 'Updated clinical note',
      actual_duration: 90,
      duration_variance: 30,
      audit_history: [
        ...(makeCompletionRow().audit_history as unknown[]),
        {
          action: 'EDITED',
          actorId: USER_ID,
          actorRoles: ['COORDINATOR'],
          timestamp: '2026-11-24T11:00:00.000Z',
          reason: 'Corrected clock-out time',
          changes: {
            observations: { before: 'Client in good spirits', after: 'Updated clinical note' },
          },
        },
      ],
    });

    const db = createMockDb(async (sql) => {
      if (sql.includes('SELECT *') && sql.includes('FROM visit_completions')) {
        return { rows: [makeCompletionRow()] };
      }
      if (sql.includes('UPDATE visit_completions')) {
        return { rows: [editedRow] };
      }
      return { rows: [] };
    });

    const service = new VisitCompletionService(db);
    const updated = await service.editCompletion(
      ORG_ID,
      VISIT_ID,
      {
        observations: 'Updated clinical note',
        timeOut: '2026-11-24T10:30:00.000Z',
        editReason: 'Corrected clock-out time',
      },
      { userId: USER_ID, roles: ['COORDINATOR'] }
    );

    expect(updated.actualDuration).toBe(90);
    expect(updated.durationVariance).toBe(30);
    expect(updated.auditHistory).toHaveLength(2);
    expect(updated.auditHistory[1]?.action).toBe('EDITED');
    expect(updated.auditHistory[1]?.reason).toBe('Corrected clock-out time');
  });
});

describe('Visit Completion API routes permission & validation checks', () => {
  it('denies FAMILY role on PATCH /api/visits/:id/complete with 403', async () => {
    const db = createMockDb(async () => ({ rows: [] }));
    const app = buildTestApp(db, { roles: ['FAMILY'], permissions: ['visits:read'] });

    const res = await request(app)
      .patch(`/api/visits/${VISIT_ID}/complete`)
      .send({
        outcome: 'COMPLETED',
        timeIn: TIME_IN,
        timeOut: TIME_OUT,
        confirmationMethod: 'PIN',
        confirmationPin: '1234',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
  });

  it('denies caregiver completing another caregiver’s assigned visit with 403', async () => {
    const db = createMockDb(async () => ({
      rows: [{ assigned_caregiver_id: OTHER_CAREGIVER_ID }],
    }));
    const app = buildTestApp(db, {
      roles: ['CAREGIVER'],
      permissions: ['visits:read'],
      caregiverId: CAREGIVER_ID,
    });

    const res = await request(app)
      .patch(`/api/visits/${VISIT_ID}/complete`)
      .send({
        outcome: 'COMPLETED',
        timeIn: TIME_IN,
        timeOut: TIME_OUT,
        confirmationMethod: 'PIN',
        confirmationPin: '1234',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CAREGIVER_SCOPE_VIOLATION');
  });

  it('denies caregiver from coordinator-only PATCH /api/visits/:id/completion with 403', async () => {
    const db = createMockDb(async () => ({ rows: [] }));
    const app = buildTestApp(db, {
      roles: ['CAREGIVER'],
      permissions: ['visits:read'],
      caregiverId: CAREGIVER_ID,
    });

    const res = await request(app)
      .patch(`/api/visits/${VISIT_ID}/completion`)
      .send({
        observations: 'Trying to edit post-submit',
        editReason: 'Caregiver attempt',
      });

    expect(res.status).toBe(403);
  });

  it('allows coordinator to complete a visit via PATCH /api/visits/:id/complete', async () => {
    const db = createMockDb(async (sql) => {
      if (sql.includes('FROM visits')) {
        return {
          rows: [
            {
              id: VISIT_ID,
              status: 'ASSIGNED',
              scheduled_duration: 60,
              assigned_caregiver_id: CAREGIVER_ID,
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO visit_completions')) {
        return { rows: [makeCompletionRow()] };
      }
      return { rows: [] };
    });

    const app = buildTestApp(db, { roles: ['COORDINATOR'], permissions: ['visits:read', 'visits:update'] });

    const res = await request(app)
      .patch(`/api/visits/${VISIT_ID}/complete`)
      .send({
        outcome: 'COMPLETED',
        tasksCompleted: [{ id: 't1', title: 'Medication reminder', completed: true }],
        observations: 'Client in good spirits',
        timeIn: TIME_IN,
        timeOut: TIME_OUT,
        confirmationMethod: 'PIN',
        confirmationPin: '1234',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.actualDuration).toBe(75);
  });
});
