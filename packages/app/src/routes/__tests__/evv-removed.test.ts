/**
 * Route-level regression tests for wdvf3adf73:
 * Verify EVV and geofencing API endpoints are removed from the Portal API.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express, Request, Response, NextFunction } from 'express';
import request from 'supertest';
import type { Database } from '@folkcare/core';

vi.mock('@folkcare/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@folkcare/core')>();
  return {
    ...actual,
    AuthMiddleware: class MockAuthMiddleware extends actual.AuthMiddleware {
      override requireAuth = (req: Request, _res: Response, next: NextFunction): Promise<void> => {
        req.user = {
          userId: 'test-admin',
          email: 'admin@test.example',
          organizationId: 'test-org',
          branchIds: [],
          roles: ['ADMIN'],
          permissions: [],
          tokenVersion: 1,
        };
        next();
        return Promise.resolve();
      };
      override auditImpersonatedActions = (_req: Request, _res: Response, next: NextFunction): void => {
        next();
      };
    },
  };
});

import { setupRoutes } from '../index.js';

describe('EVV/Geofencing API Removal (wdvf3adf73)', () => {
  let app: Express;

  beforeEach(async () => {
    app = express();
    app.use(express.json());

    const mockPool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      connect: vi.fn(),
      end: vi.fn(),
    };

    const mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      getPool: vi.fn().mockReturnValue(mockPool),
      transaction: vi.fn(),
    } as unknown as Database;

    await setupRoutes(app, mockDb);
  });

  it('returns 404 for GET /api/evv', async () => {
    const res = await request(app).get('/api/evv');
    expect(res.status).toBe(404);
  });

  it('returns 404 for GET /api/evv/location-policy', async () => {
    const res = await request(app).get('/api/evv/location-policy');
    expect(res.status).toBe(404);
  });

  it('returns 404 for POST /api/evv-visits', async () => {
    const res = await request(app).post('/api/evv-visits').send({ visitId: 'v-1' });
    expect(res.status).toBe(404);
  });

  it('returns 404 for PATCH /api/evv-visits/:id/clock-out', async () => {
    const res = await request(app).patch('/api/evv-visits/v-1/clock-out').send({});
    expect(res.status).toBe(404);
  });

  it('returns 404 for GET /api/time-tracking', async () => {
    const res = await request(app).get('/api/time-tracking');
    expect(res.status).toBe(404);
  });
});
