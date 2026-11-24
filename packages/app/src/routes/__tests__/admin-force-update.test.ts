import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentRoles: string[] = ['ADMIN'];

vi.mock('@folkcare/core', () => ({
  getDatabase: vi.fn(() => ({})),
  AuthMiddleware: vi.fn().mockImplementation(function () {
    return {
      requireAuth: vi.fn(async (req: Record<string, unknown>, _res: unknown, next: () => void) => {
        req['user'] = {
          userId: 'user-admin-1',
          organizationId: 'org-1',
          roles: currentRoles,
        };
        next();
      }),
    };
  }),
}));

vi.mock('@folkcare/core/service/cache.service', () => ({
  getCacheService: vi.fn(() => ({
    getStats: vi.fn().mockResolvedValue({}),
    delPattern: vi.fn().mockResolvedValue(true),
    clearAll: vi.fn().mockResolvedValue(true),
  })),
}));

import adminRouter from '../admin.js';

describe('GET /api/admin/force-update-link (wdvf3adf4m)', () => {
  const originalAppUrl = process.env.APP_URL;
  const originalFrontendUrl = process.env.FRONTEND_URL;

  function buildApp(): express.Express {
    const app = express();
    app.use('/api/admin', adminRouter);
    return app;
  }

  beforeEach(() => {
    currentRoles = ['ADMIN'];
    delete process.env.APP_URL;
    delete process.env.FRONTEND_URL;
  });

  afterEach(() => {
    if (originalAppUrl !== undefined) {
      process.env.APP_URL = originalAppUrl;
    } else {
      delete process.env.APP_URL;
    }
    if (originalFrontendUrl !== undefined) {
      process.env.FRONTEND_URL = originalFrontendUrl;
    } else {
      delete process.env.FRONTEND_URL;
    }
  });

  it('returns the deterministic /force-update link for an admin user', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/admin/force-update-link');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.path).toBe('/force-update');
    expect(res.body.data.url).toMatch(/\/force-update$/);
  });

  it('uses APP_URL when configured and strips trailing slashes', async () => {
    process.env.APP_URL = 'https://mhc-family-portal.vercel.app///';
    const app = buildApp();
    const res = await request(app).get('/api/admin/force-update-link');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        path: '/force-update',
        url: 'https://mhc-family-portal.vercel.app/force-update',
      },
    });
  });

  it('rejects non-admin users with 403', async () => {
    currentRoles = ['CAREGIVER'];
    const app = buildApp();
    const res = await request(app).get('/api/admin/force-update-link');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_PERMISSIONS');
  });
});
