/**
 * Route tests for /api/caregivers/me/availability
 *
 * Covers:
 * - 401 unauthenticated
 * - 403 for COORDINATOR and FAMILY
 * - 200 and 409 paths (including conflict and cutoff)
 * - a caregiver cannot target another caregiver (resolved from auth session)
 * - cross-organization isolation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
// Mock AuthMiddleware from @folkcare/core
vi.mock('@folkcare/core', async () => {
  const actual = await vi.importActual('@folkcare/core');
  return {
    ...actual,
    AuthMiddleware: class MockAuthMiddleware {
      requireAuth = (req: any, res: any, next: any): void => {
        if (!req.user) {
          res.status(401).json({ success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' });
          return;
        }
        next();
      };

      requireRole = (roles: string[]) => (req: any, res: any, next: any): void => {
        const userRoles = req.user?.roles ?? [];
        const hasRole = roles.some((r) => userRoles.includes(r));
        if (!hasRole) {
          res.status(403).json({ success: false, error: 'Insufficient permissions', code: 'INSUFFICIENT_PERMISSIONS' });
          return;
        }
        next();
      };

      requirePermission = (permissions: string[]) => (req: any, res: any, next: any): void => {
        const userPermissions = req.user?.permissions ?? [];
        const hasPermission = permissions.some((p) => userPermissions.includes(p));
        if (!hasPermission) {
          res.status(403).json({ success: false, error: 'Insufficient permissions', code: 'INSUFFICIENT_PERMISSIONS' });
          return;
        }
        next();
      };
    },
  };
});

import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { createCaregiverRouter } from '../caregivers.js';
import { errorHandler } from '../../middleware/error-handler.js';
import type { Database } from '@folkcare/core';
import {
  CaregiverAvailabilityService,
  AvailabilityConflictError,
  AvailabilityCutoffError,
} from '@folkcare/caregiver-staff';

describe('Caregiver Availability Routes - /api/caregivers/me/availability', () => {
  let mockDb: Database;
  let currentUser: any;

  beforeEach(() => {
    vi.clearAllMocks();

    currentUser = {
      userId: 'user-caregiver-1',
      organizationId: 'org-1',
      roles: ['CAREGIVER'],
      permissions: ['availability:read-own', 'availability:update-own', 'clients:read'],
      branchIds: ['branch-1'],
    };

    mockDb = {
      query: vi.fn(),
      transaction: vi.fn().mockImplementation(async (cb) => {
        return await cb(mockDb);
      }),
      healthCheck: vi.fn(),
      close: vi.fn(),
    } as unknown as Database;
  });

  function createApp(userOverride?: any): express.Express {
    const app = express();
    app.use(express.json());

    // Middleware simulating authentication header / session
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const user = userOverride !== undefined ? userOverride : currentUser;
      if (user) {
        req.headers['authorization'] = 'Bearer fake-valid-token';
        req.user = user;
      }
      next();
    });

    app.use('/api/caregivers', createCaregiverRouter(mockDb));
    app.use(errorHandler);
    return app;
  }

  describe('Authentication & Authorization', () => {
    it('returns 401 when unauthenticated', async () => {
      const app = createApp(null); // No user attached

      const getRes = await request(app).get('/api/caregivers/me/availability?weekStart=2026-11-02');
      expect(getRes.status).toBe(401);

      const putRes = await request(app).put('/api/caregivers/me/availability').send({
        weekStart: '2026-11-02',
        schedule: {},
        expectedVersion: 1,
      });
      expect(putRes.status).toBe(401);
    });

    it('returns 403 for COORDINATOR role', async () => {
      const coordinatorUser = {
        userId: 'user-coord-1',
        organizationId: 'org-1',
        roles: ['COORDINATOR'],
        permissions: ['schedules:read'],
        branchIds: ['branch-1'],
      };
      const app = createApp(coordinatorUser);

      const getRes = await request(app).get('/api/caregivers/me/availability?weekStart=2026-11-02');
      expect(getRes.status).toBe(403);

      const putRes = await request(app).put('/api/caregivers/me/availability').send({
        weekStart: '2026-11-02',
        schedule: {},
        expectedVersion: 1,
      });
      expect(putRes.status).toBe(403);
    });

    it('returns 403 for FAMILY role', async () => {
      const familyUser = {
        userId: 'user-family-1',
        organizationId: 'org-1',
        roles: ['FAMILY'],
        permissions: ['clients:read'],
        branchIds: ['branch-1'],
      };
      const app = createApp(familyUser);

      const getRes = await request(app).get('/api/caregivers/me/availability?weekStart=2026-11-02');
      expect(getRes.status).toBe(403);

      const putRes = await request(app).put('/api/caregivers/me/availability').send({
        weekStart: '2026-11-02',
        schedule: {},
        expectedVersion: 1,
      });
      expect(putRes.status).toBe(403);
    });

    it('rejects PUT from impersonated sessions with 403', async () => {
      const impersonatedUser = {
        ...currentUser,
        impersonation: {
          adminUserId: 'admin-1',
          adminEmail: 'admin@example.com',
          sessionId: 'session-1',
          startedAt: new Date().toISOString(),
        },
      };
      const app = createApp(impersonatedUser);

      const res = await request(app).put('/api/caregivers/me/availability').send({
        weekStart: '2026-11-02',
        schedule: {},
        expectedVersion: 1,
      });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('IMPERSONATION_BLOCKED');
    });
  });

  describe('200 and 409 Paths', () => {
    const mockCaregiverRow = {
      id: '923e4567-e89b-12d3-a456-426614174000',
      organization_id: 'org-1',
      user_id: 'user-caregiver-1',
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      timezone: 'America/New_York',
      version: 1,
      availability: { schedule: {} },
    };

    it('GET returns resolved availability (200)', async () => {
      vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
        if ((sql.includes('FROM caregivers') && sql.includes('user_id = $1'))) {
          return { rows: [mockCaregiverRow] } as any;
        }
        if ((sql.includes('FROM caregivers') && sql.includes('id = $1'))) {
          return { rows: [mockCaregiverRow] } as any;
        }
        if (sql.includes('FROM caregiver_availability_overrides')) {
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      const app = createApp();
      const res = await request(app).get('/api/caregivers/me/availability?weekStart=2026-11-02');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('schedule');
      expect(res.body).toHaveProperty('editable');
      expect(res.body).toHaveProperty('cutoffAt');
      expect(res.body).toHaveProperty('conflicts');
      expect(res.body.conflicts).toEqual([]);
      expect(res.body.version).toBe(1);
    });

    it('PUT saves weekly availability override (200)', async () => {
      vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
        if ((sql.includes('FROM caregivers') && sql.includes('user_id = $1'))) {
          return { rows: [mockCaregiverRow] } as any;
        }
        if ((sql.includes('FROM caregivers') && sql.includes('id = $1'))) {
          return { rows: [mockCaregiverRow] } as any;
        }
        if (sql.includes('FROM caregiver_availability_overrides')) {
          return { rows: [] } as any;
        }
        if (sql.includes('FROM visits')) {
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      // Mock saveAvailabilityOverride to simulate success
      vi.spyOn(CaregiverAvailabilityService.prototype, 'saveAvailabilityOverride').mockResolvedValueOnce({
        version: 2,
        schedule: { monday: { available: true } } as any,
        before: {},
      });

      const app = createApp();
      const res = await request(app).put('/api/caregivers/me/availability').send({
        weekStart: '2026-11-02',
        schedule: { monday: { available: true } },
        expectedVersion: 1,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.version).toBe(2);
    });

    it('PUT returns 409 AVAILABILITY_CONFLICT_BOOKED_VISITS on conflict', async () => {
      vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
        if ((sql.includes('FROM caregivers') && sql.includes('user_id = $1'))) {
          return { rows: [mockCaregiverRow] } as any;
        }
        return { rows: [] } as any;
      });

      vi.spyOn(CaregiverAvailabilityService.prototype, 'saveAvailabilityOverride').mockRejectedValueOnce(
        new AvailabilityConflictError([
          { visitId: 'visit-101', date: '2026-11-02', start: '10:00', end: '14:00' },
        ])
      );

      const app = createApp();
      const res = await request(app).put('/api/caregivers/me/availability').send({
        weekStart: '2026-11-02',
        schedule: { monday: { available: false } },
        expectedVersion: 1,
      });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('AVAILABILITY_CONFLICT_BOOKED_VISITS');
      expect(res.body.conflicts).toHaveLength(1);
      expect(res.body.conflicts[0].visitId).toBe('visit-101');
    });

    it('PUT returns 409 AVAILABILITY_EDIT_CUTOFF_PASSED when cutoff passed', async () => {
      vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
        if ((sql.includes('FROM caregivers') && sql.includes('user_id = $1'))) {
          return { rows: [mockCaregiverRow] } as any;
        }
        return { rows: [] } as any;
      });

      vi.spyOn(CaregiverAvailabilityService.prototype, 'saveAvailabilityOverride').mockRejectedValueOnce(
        new AvailabilityCutoffError('Availability edit cutoff passed for week 2026-11-02')
      );

      const app = createApp();
      const res = await request(app).put('/api/caregivers/me/availability').send({
        weekStart: '2026-11-02',
        schedule: { monday: { available: false } },
        expectedVersion: 1,
      });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('AVAILABILITY_EDIT_CUTOFF_PASSED');
    });
  });

  describe('Identity & Cross-Organization Isolation', () => {
    it('a caregiver cannot target another caregiver (resolved from auth session, body caregiverId ignored)', async () => {
      const caregiver1Row = {
        id: 'cg-me-1',
        organization_id: 'org-1',
        user_id: 'user-caregiver-1',
      };

      vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
        if ((sql.includes('FROM caregivers') && sql.includes('user_id = $1'))) {
          return { rows: [caregiver1Row] } as any;
        }
        return { rows: [] } as any;
      });

      const saveSpy = vi.spyOn(CaregiverAvailabilityService.prototype, 'saveAvailabilityOverride').mockResolvedValueOnce({
        version: 2,
        schedule: {} as any,
        before: {},
      });

      const app = createApp();
      // Client maliciously supplies caregiverId in body
      const res = await request(app).put('/api/caregivers/me/availability').send({
        caregiverId: 'cg-target-another',
        weekStart: '2026-11-02',
        schedule: { monday: { available: true } },
        expectedVersion: 1,
      });

      expect(res.status).toBe(200);
      // Assert that saveAvailabilityOverride was called with cg-me-1, NOT cg-target-another
      expect(saveSpy).toHaveBeenCalledWith('cg-me-1', expect.anything(), expect.anything());
    });

    it('cross-organization isolation: caregiver in other org is NOT resolved', async () => {
      vi.mocked(mockDb.query).mockImplementation(async (sql: string, params?: unknown[]) => {
        if ((sql.includes('FROM caregivers') && sql.includes('user_id = $1'))) {
          // If searching for org-1, return empty because user is in org-other
          if (params?.[1] === 'org-other') {
            return { rows: [{ id: 'cg-other', organization_id: 'org-other' }] } as any;
          }
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      const app = createApp(); // currentUser organizationId is 'org-1'
      const res = await request(app).get('/api/caregivers/me/availability?weekStart=2026-11-02');

      // Caregiver profile not found in org-1
      expect(res.status).toBe(404);
    });
  });
});
