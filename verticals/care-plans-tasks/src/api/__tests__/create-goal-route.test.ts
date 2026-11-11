/**
 * Route tests for POST /api/care-plans/:carePlanId/goals
 *
 * Ticket: wdvf3abbtf - Create Goals in Care Plan
 *
 * Verifies the createGoal handler wires request params/body into
 * CarePlanService.createGoal correctly and maps service errors to the
 * right HTTP status codes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { ValidationError, PermissionError, NotFoundError } from '@folkcare/core';
import { createCarePlanHandlers } from '../care-plan-handlers';
import type { CarePlanService } from '../../service/care-plan-service';

function buildMockService(createGoalMock?: ReturnType<typeof vi.fn>) {
  return {
    createGoal: createGoalMock ?? vi.fn(),
  } as unknown as CarePlanService;
}

function buildApp(service: CarePlanService, user: Record<string, unknown>): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = user;
    next();
  });

  const handlers = createCarePlanHandlers(service);
  app.post('/api/care-plans/:carePlanId/goals', handlers.createGoal);
  return app;
}

const adminUser = {
  userId: 'user-123',
  email: 'admin@folkcare.example',
  organizationId: 'org-123',
  branchIds: ['branch-123'],
  roles: ['ADMIN'],
  permissions: ['care-plans:update'],
  tokenVersion: 1,
};

describe('POST /api/care-plans/:carePlanId/goals', () => {
  let createGoalMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createGoalMock = vi.fn();
  });

  it('returns 201 with the created goal on success', async () => {
    const createdGoal = {
      id: 'goal-1',
      carePlanId: 'plan-123',
      title: 'Improve mobility',
      description: 'Walk 50 feet unassisted',
      category: 'MOBILITY',
      status: 'NOT_STARTED',
      priority: 'HIGH',
    };
    createGoalMock.mockResolvedValue(createdGoal);
    const app = buildApp(buildMockService(createGoalMock), adminUser);

    const res = await request(app)
      .post('/api/care-plans/plan-123/goals')
      .send({ title: 'Improve mobility', description: 'Walk 50 feet unassisted', category: 'MOBILITY', priority: 'HIGH' })
      .expect(201);

    expect(res.body).toEqual({ success: true, data: createdGoal });
    expect(createGoalMock).toHaveBeenCalledWith(
      'plan-123',
      { title: 'Improve mobility', description: 'Walk 50 feet unassisted', category: 'MOBILITY', priority: 'HIGH' },
      expect.objectContaining({
        userId: 'user-123',
        organizationId: 'org-123',
        branchIds: ['branch-123'],
        roles: ['ADMIN'],
      })
    );
  });

  it('returns 400 when the service rejects an invalid title', async () => {
    createGoalMock.mockRejectedValue(
      new ValidationError('Goal title is required', { field: 'title' })
    );
    const app = buildApp(buildMockService(createGoalMock), adminUser);

    const res = await request(app)
      .post('/api/care-plans/plan-123/goals')
      .send({ title: '' })
      .expect(400);

    expect(res.body.error).toBe('Goal title is required');
  });

  it('returns 403 when the service rejects for insufficient permissions', async () => {
    createGoalMock.mockRejectedValue(
      new PermissionError('Insufficient permissions to create goals')
    );
    const app = buildApp(buildMockService(createGoalMock), adminUser);

    const res = await request(app)
      .post('/api/care-plans/plan-123/goals')
      .send({ title: 'Improve mobility' })
      .expect(403);
    expect(res.status).toBe(403);
  });

  it('returns 404 when the care plan does not exist', async () => {
    createGoalMock.mockRejectedValue(new NotFoundError('Care plan not found', { id: 'plan-missing' }));
    const app = buildApp(buildMockService(createGoalMock), adminUser);

    const res = await request(app)
      .post('/api/care-plans/plan-missing/goals')
      .send({ title: 'Improve mobility' })
      .expect(404);
    expect(res.status).toBe(404);
  });

  it('returns 500 on unexpected service errors', async () => {
    createGoalMock.mockRejectedValue(new Error('boom'));
    const app = buildApp(buildMockService(createGoalMock), adminUser);

    const res = await request(app)
      .post('/api/care-plans/plan-123/goals')
      .send({ title: 'Improve mobility' })
      .expect(500);
    expect(res.status).toBe(500);
  });
});
