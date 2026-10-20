import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createImportRoutes } from '../import-routes.js';
import { createComplianceRouter } from '../compliance.js';
import { createOnboardingRouter } from '../onboarding.js';

// Setup mock database
const mockDb = {
  query: vi.fn(),
} as any;

// Mock AuthMiddleware so requireAuth succeeds and sets user, while requireRole validates role
vi.mock('@folkcare/core', async () => {
  const actual = await vi.importActual('@folkcare/core');
  return {
    ...actual,
    AuthMiddleware: class MockAuthMiddleware {
      requireAuth = (req: any, _res: any, next: any): void => {
        req.user ??= {
          userId: '11111111-1111-1111-1111-111111111111',
          organizationId: '22222222-2222-2222-2222-222222222222',
          roles: ['CAREGIVER'],
          permissions: ['clients:read'],
        };
        next();
      };

      requireRole = (roles: string[]) => (req: any, res: any, next: any) => {
        const userRoles = req.user?.roles ?? [];
        const hasRole = roles.some((r) => userRoles.includes(r));
        if (!hasRole) {
          res.status(403).json({
            success: false,
            error: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            requiredRoles: roles,
            userRoles,
          });
          return;
        }
        next();
      };
    },
  };
});

describe('Route Permissions RBAC Enforcement', () => {
  it('should return 403 Forbidden on import routes for unauthorized roles', async () => {
    const app = express();
    app.use(express.json());
    // Attach user with CAREGIVER role (not allowed to import bulk clients)
    app.use((req: any, _res, next) => {
      req.user = {
        userId: '11111111-1111-1111-1111-111111111111',
        organizationId: '22222222-2222-2222-2222-222222222222',
        roles: ['CAREGIVER'],
        permissions: ['clients:read'],
      };
      next();
    });
    app.use('/api/import', createImportRoutes(mockDb));

    const res = await request(app)
      .post('/api/import/clients/csv')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('should return 403 Forbidden on compliance scan for unauthorized roles', async () => {
    const app = express();
    app.use(express.json());
    // Attach user with CAREGIVER role (not allowed to trigger compliance scans)
    app.use((req: any, _res, next) => {
      req.user = {
        userId: '11111111-1111-1111-1111-111111111111',
        organizationId: '22222222-2222-2222-2222-222222222222',
        roles: ['CAREGIVER'],
        permissions: ['compliance:read'],
      };
      next();
    });
    app.use('/api/compliance', createComplianceRouter(mockDb));

    const res = await request(app)
      .post('/api/compliance/scan')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('should return 403 Forbidden on onboarding go-live for unauthorized roles', async () => {
    const app = express();
    app.use(express.json());
    // Attach user with COORDINATOR role (not allowed to trigger go-live approval)
    app.use((req: any, _res, next) => {
      req.user = {
        userId: '11111111-1111-1111-1111-111111111111',
        organizationId: '22222222-2222-2222-2222-222222222222',
        roles: ['COORDINATOR'],
        permissions: ['clients:read'],
      };
      next();
    });
    app.use('/api/onboarding', createOnboardingRouter(mockDb));

    const res = await request(app)
      .post('/api/onboarding/go-live')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_PERMISSIONS');
  });
});
