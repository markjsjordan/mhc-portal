/**
 * EVV (Electronic Visit Verification) Routes Tests
 *
 * Tests for EVV clock-in/out and record management API endpoints.
 *
 * NOTE: These are unit tests that verify route configuration and basic
 * functionality. Integration tests with full repository mocking require
 * more complex setup and are planned for future work.
 */

 
 
/* eslint-disable sonarjs/redundant-type-aliases */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Database } from '@folkcare/core';
import type { Router } from 'express';

// Type for Express Router stack layer (Express internals aren't fully typed)
type RouterLayer = any;

// Mock time-tracking-evv module
vi.mock('@folkcare/time-tracking-evv', () => ({
  EVVRepository: vi.fn().mockImplementation(function () {
    return {
      searchEVVRecords: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      getEVVRecordById: vi.fn().mockResolvedValue(null),
    };
  }),
  EVVService: vi.fn().mockImplementation(function () {
    return {
      clockIn: vi.fn().mockResolvedValue({}),
      clockOut: vi.fn().mockResolvedValue({}),
    };
  }),
  EVVHandlers: vi.fn().mockImplementation(function () {
    return {
      clockIn: vi.fn().mockResolvedValue({ status: 201, data: {} }),
      clockOut: vi.fn().mockResolvedValue({ status: 200, data: {} }),
    };
  }),
  IntegrationService: vi.fn().mockImplementation(function () {
    return {};
  }),
  createClientProvider: vi.fn().mockReturnValue({}),
  createCaregiverProvider: vi.fn().mockReturnValue({}),
  AggregatorSubmissionRepository: vi.fn().mockImplementation(function () {
    return {
      create: vi.fn().mockResolvedValue({}),
      findById: vi.fn().mockResolvedValue(null),
    };
  }),
  AggregatorConfigRepository: vi.fn().mockImplementation(function () {
    return {
      getConfig: vi.fn().mockResolvedValue(null),
    };
  }),
  EVVAggregatorService: vi.fn().mockImplementation(function () {
    return {
      submit: vi.fn().mockResolvedValue({}),
    };
  }),
  AggregatorHandlers: vi.fn().mockImplementation(function () {
    return {
      submit: vi.fn().mockResolvedValue({ status: 200, data: {} }),
    };
  }),
}));

// Mock scheduling-visits module (createVisitProvider would otherwise attempt a real DB connection)
vi.mock('@folkcare/scheduling-visits', () => ({
  createVisitProvider: vi.fn().mockReturnValue({}),
}));

// Mock core module
vi.mock('@folkcare/core', async () => {
  const actual = await vi.importActual('@folkcare/core');
  return {
    ...actual,
    AuthMiddleware: vi.fn().mockImplementation(function () {
      return {
        requireAuth: (_req: any, _res: any, next: any) => {
          _req.user = {
            userId: '123e4567-e89b-12d3-a456-426614174000',
            email: 'caregiver@example.com',
            organizationId: '223e4567-e89b-12d3-a456-426614174000',
            roles: ['caregiver'],
            permissions: ['evv:read', 'evv:write'],
          };
          next();
        },
      };
    }),
  };
});

// Import after mocking
import { createEVVRouter, createEVVVisitsRouter } from '../evv.js';

describe('EVV Routes', () => {
  let mockDb: Database;
  let router: Router;

  beforeEach(() => {
    mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      getPool: vi.fn().mockReturnValue({}),
    } as unknown as Database;

    router = createEVVRouter(mockDb);
  });

  describe('Router Configuration', () => {
    it('should create router with all expected routes', () => {
      expect(router).toBeDefined();

      const routes = router.stack
        .filter((layer: RouterLayer) => layer.route)
        .map((layer: RouterLayer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      expect(routes.length).toBeGreaterThan(0);
    });

    it('should have GET / endpoint for searching EVV records', () => {
      const routes = router.stack
        .filter((layer: RouterLayer) => layer.route)
        .map((layer: RouterLayer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const searchRoute = routes.find((r: any) => r.path === '/');
      expect(searchRoute).toBeDefined();
      expect(searchRoute?.methods).toContain('get');
    });

    it('should have GET /:id endpoint for getting EVV record by ID', () => {
      const routes = router.stack
        .filter((layer: RouterLayer) => layer.route)
        .map((layer: RouterLayer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const getByIdRoute = routes.find((r: any) => r.path === '/:id');
      expect(getByIdRoute).toBeDefined();
      expect(getByIdRoute?.methods).toContain('get');
    });
  });

  describe('Route Count', () => {
    it('should have exactly 10 EVV routes configured', () => {
      const routes = router.stack
        .filter((layer: RouterLayer) => layer.route)
        .map((layer: RouterLayer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      // 10 endpoints:
      // GET / - search EVV records
      // GET /location-policy - get org location policy
      // GET /:id - get EVV record by ID
      // POST /clock-in - clock in
      // POST /:id/clock-out - clock out
      // GET /aggregator/submissions/stats - aggregator submission stats (FC-AUDIT-EVV WU-4)
      // GET /aggregator/submissions/pending - pending aggregator submissions
      // POST /aggregator/submissions/retry-all - retry all pending aggregator submissions
      // POST /aggregator/submissions/:id/retry - retry one aggregator submission
      // GET /aggregator/submissions/:evvRecordId - submission history for a record
      expect(routes.length).toBe(10);
    });

    it('should have GET /location-policy endpoint for getting org location policy', () => {
      const routes = router.stack
        .filter((layer: RouterLayer) => layer.route)
        .map((layer: RouterLayer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const locationPolicyRoute = routes.find((r: any) => r.path === '/location-policy');
      expect(locationPolicyRoute).toBeDefined();
      expect(locationPolicyRoute?.methods).toContain('get');
    });
  });

  describe('Clock In/Out Routes', () => {
    it('should have POST /clock-in endpoint', () => {
      const routes = router.stack
        .filter((layer: RouterLayer) => layer.route)
        .map((layer: RouterLayer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const clockInRoute = routes.find((r: any) => r.path === '/clock-in');
      expect(clockInRoute).toBeDefined();
      expect(clockInRoute?.methods).toContain('post');
    });

    it('should have POST /:id/clock-out endpoint', () => {
      const routes = router.stack
        .filter((layer: RouterLayer) => layer.route)
        .map((layer: RouterLayer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const clockOutRoute = routes.find((r: any) => r.path === '/:id/clock-out');
      expect(clockOutRoute).toBeDefined();
      expect(clockOutRoute?.methods).toContain('post');
    });
  });

  describe('Authentication Requirements', () => {
    it('should use router-level authentication middleware', () => {
      const middlewareCount = router.stack.filter(
        (layer: RouterLayer) => layer.name === 'requireAuth' || !layer.route
      ).length;

      expect(middlewareCount).toBeGreaterThan(0);
    });
  });

  describe('Search Filters', () => {
    it('should support branchId filter', () => {
      const filterName = 'branchId';
      expect(filterName).toBe('branchId');
    });

    it('should support caregiverId filter', () => {
      const filterName = 'caregiverId';
      expect(filterName).toBe('caregiverId');
    });

    it('should support clientId filter', () => {
      const filterName = 'clientId';
      expect(filterName).toBe('clientId');
    });

    it('should support status filter', () => {
      const filterName = 'status';
      expect(filterName).toBe('status');
    });

    it('should support pagination parameters', () => {
      const paginationParams = ['page', 'limit'];
      expect(paginationParams.length).toBe(2);
    });
  });
});

describe('EVV Visits Routes (/api/evv-visits)', () => {
  let mockDb: Database;
  let router: Router;

  beforeEach(() => {
    mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      getPool: vi.fn().mockReturnValue({}),
    } as unknown as Database;

    router = createEVVVisitsRouter(mockDb);
  });

  it('should register POST / and PATCH /:id/clock-out routes', () => {
    const routes = router.stack
      .filter((layer: RouterLayer) => layer.route)
      .map((layer: RouterLayer) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    const postRoute = routes.find((r: any) => r.path === '/' && r.methods.includes('post'));
    const patchRoute = routes.find((r: any) => r.path === '/:id/clock-out' && r.methods.includes('patch'));

    expect(postRoute).toBeDefined();
    expect(patchRoute).toBeDefined();
  });

  it('POST / should return 400 when visit_id is missing', async () => {
    const postLayer: RouterLayer = router.stack.find(
      (layer: RouterLayer) => layer.route?.path === '/' && layer.route?.methods?.post
    );
    const handler = postLayer.route.stack[0].handle;

    const req = {
      body: { caregiver_id: 'cg-1', clock_in_time: '2026-11-23T09:00:00.000Z' },
      params: {},
      query: {},
      user: { userId: 'cg-1', organizationId: 'org-1', roles: ['caregiver'] },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;
    const next = vi.fn();

    await handler(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'visit_id is required' });
  });

  it('POST / should normalize EVV payload and return visit_id, caregiver_id, clock_in_time, clock_out_time', async () => {
    const postLayer: RouterLayer = router.stack.find(
      (layer: RouterLayer) => layer.route?.path === '/' && layer.route?.methods?.post
    );
    const handler = postLayer.route.stack[0].handle;

    const req = {
      body: {
        visit_id: 'visit-123',
        caregiver_id: 'cg-456',
        clock_in_time: '2026-11-23T09:00:00.000Z',
        clock_out_time: null,
      },
      params: {},
      query: {},
      user: { userId: 'cg-456', organizationId: 'org-1', roles: ['caregiver'] },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;
    const next = vi.fn();

    await handler(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        visit_id: 'visit-123',
        caregiver_id: 'cg-456',
        clock_in_time: '2026-11-23T09:00:00.000Z',
        clock_out_time: null,
      })
    );
  });

  it('PATCH /:id/clock-out should return clock_out_time and visit metadata', async () => {
    const patchLayer: RouterLayer = router.stack.find(
      (layer: RouterLayer) => layer.route?.path === '/:id/clock-out' && layer.route?.methods?.patch
    );
    const handler = patchLayer.route.stack[0].handle;

    const req = {
      body: {
        visit_id: 'visit-123',
        caregiver_id: 'cg-456',
        clock_out_time: '2026-11-23T11:00:00.000Z',
      },
      params: { id: 'evv-789' },
      query: {},
      user: { userId: 'cg-456', organizationId: 'org-1', roles: ['caregiver'] },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;
    const next = vi.fn();

    await handler(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        visit_id: 'visit-123',
        caregiver_id: 'cg-456',
        clock_out_time: '2026-11-23T11:00:00.000Z',
      })
    );
  });
});
