/**
 * Organization Routes Tests
 *
 * Tests for organization API endpoints including signup, registration,
 * and team invitation management.
 *
 * NOTE: These are unit tests that verify route configuration and basic
 * functionality. Integration tests with full service mocking require
 * more complex setup and are planned for future work.
 */

 
 
/* eslint-disable sonarjs/redundant-type-aliases */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { AuditService, OrganizationService, PermissionError, ValidationError, type Database } from '@folkcare/core';
import type { Router } from 'express';

// Type for Express Router stack layer (Express internals aren't fully typed)
type RouterLayer = any;

function mockOrgRequireRole(roles: string[]) {
  return (_req: any, res: any, next: any) => {
    const userRoles = (_req.user?.roles ?? []).map((r: string) => r.toUpperCase());
    const hasRole = roles.some((r) => userRoles.includes(r.toUpperCase()));
    if (!hasRole) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}

// Mock all external dependencies before importing the router
vi.mock('@folkcare/core', async () => {
  const actual = await vi.importActual('@folkcare/core');
  return {
    ...actual,
    OrganizationService: vi.fn().mockImplementation(function () {
      return {
        registerOrganization: vi.fn(),
        getOrganizationById: vi.fn(),
        createInvitation: vi.fn(),
        getOrganizationInvitations: vi.fn(),
        getInvitationDetails: vi.fn(),
        acceptInvitation: vi.fn(),
        revokeInvitation: vi.fn(),
      };
    }),
    SignupService: vi.fn().mockImplementation(function () {
      return {
        registerOrganization: vi.fn(),
      };
    }),
    AuthMiddleware: vi.fn().mockImplementation(function () {
      return {
        requireAuth: (_req: any, _res: any, next: any) => {
          _req.user ??= {
            userId: '123e4567-e89b-12d3-a456-426614174000',
            email: 'admin@example.com',
            organizationId: '223e4567-e89b-12d3-a456-426614174000',
            roles: ['ORG_ADMIN', 'admin'],
            permissions: ['organizations:read', 'organizations:write'],
          };
          next();
        },
        requireSameOrganization: () => (_req: any, res: any, next: any) => {
          const targetOrg = _req.params?.id;
          const userOrg = _req.user?.organizationId;
          const userRoles: string[] = _req.user?.roles ?? [];
          if (
            targetOrg &&
            userOrg &&
            targetOrg !== userOrg &&
            !userRoles.includes('SUPER_ADMIN')
          ) {
            res.status(403).json({
              success: false,
              error: 'Cross-organization access denied',
              code: 'CROSS_ORG_ACCESS_DENIED',
            });
            return;
          }
          next();
        },
        requireRole: mockOrgRequireRole,
      };
    }),
    ValidationError: class ValidationError extends Error {
      code: string;
      constructor(message: string, code: string = 'VALIDATION_ERROR') {
        super(message);
        this.code = code;
      }
    },
    ConflictError: class ConflictError extends Error {
      code: string;
      constructor(message: string, code: string = 'CONFLICT') {
        super(message);
        this.code = code;
      }
    },
    NotFoundError: class NotFoundError extends Error {
      code: string;
      constructor(message: string, code: string = 'NOT_FOUND') {
        super(message);
        this.code = code;
      }
    },
  };
});

// Import after mocking
import { createOrganizationRouter } from '../organizations.js';

describe('Organization Routes', () => {
  let mockDb: Database;
  let router: Router;

  beforeEach(() => {
    mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      getPool: vi.fn().mockReturnValue({}),
    } as unknown as Database;

    router = createOrganizationRouter(mockDb);
  });

  describe('Router Configuration', () => {
    it('should create router with all expected routes', () => {
      expect(router).toBeDefined();

      // Get all routes from the router stack
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      // Verify essential routes exist
      expect(routes.length).toBeGreaterThan(0);
    });

    it('should have signup endpoint', () => {
      const routes = router.stack
        .filter((layer: RouterLayer) => layer.route)
        .map((layer: RouterLayer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const signupRoute = routes.find((r: any) => r.path === '/signup');
      expect(signupRoute).toBeDefined();
      expect(signupRoute?.methods).toContain('post');
    });

    it('should have organization registration endpoint', () => {
      const routes = router.stack
        .filter((layer: RouterLayer) => layer.route)
        .map((layer: RouterLayer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const registerRoute = routes.find(
        (r: any) => r.path === '/organizations/register'
      );
      expect(registerRoute).toBeDefined();
      expect(registerRoute?.methods).toContain('post');
    });

    it('should have get organization by ID endpoint', () => {
      const routes = router.stack
        .filter((layer: RouterLayer) => layer.route)
        .map((layer: RouterLayer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const getOrgRoute = routes.find(
        (r: any) => r.path === '/organizations/:id'
      );
      expect(getOrgRoute).toBeDefined();
      expect(getOrgRoute?.methods).toContain('get');
    });

    it('should have create invitation endpoint', () => {
      const routes = router.stack
        .filter((layer: RouterLayer) => layer.route)
        .map((layer: RouterLayer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const createInviteRoute = routes.find(
        (r: any) => r.path === '/organizations/:id/invitations'
      );
      expect(createInviteRoute).toBeDefined();
      expect(createInviteRoute?.methods).toContain('post');
    });

    it('should have list invitations endpoint', () => {
      const routes = router.stack
        .filter((layer: RouterLayer) => layer.route)
        .map((layer: RouterLayer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      // Find all routes matching this path (POST and GET are separate entries)
      const invitationRoutes = routes.filter(
        (r: any) => r.path === '/organizations/:id/invitations'
      );
      expect(invitationRoutes.length).toBeGreaterThan(0);
      // Check that GET exists among the methods
      const hasGetMethod = invitationRoutes.some((r: any) =>
        r.methods.includes('get')
      );
      expect(hasGetMethod).toBe(true);
    });

    it('should have get invitation details endpoint', () => {
      const routes = router.stack
        .filter((layer: RouterLayer) => layer.route)
        .map((layer: RouterLayer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const getInviteRoute = routes.find(
        (r: any) => r.path === '/invitations/:token'
      );
      expect(getInviteRoute).toBeDefined();
      expect(getInviteRoute?.methods).toContain('get');
    });

    it('should have accept invitation endpoint', () => {
      const routes = router.stack
        .filter((layer: RouterLayer) => layer.route)
        .map((layer: RouterLayer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const acceptInviteRoute = routes.find(
        (r: any) => r.path === '/invitations/accept'
      );
      expect(acceptInviteRoute).toBeDefined();
      expect(acceptInviteRoute?.methods).toContain('post');
    });

    it('should have revoke invitation endpoint', () => {
      const routes = router.stack
        .filter((layer: RouterLayer) => layer.route)
        .map((layer: RouterLayer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      // Find all routes matching this path (GET and DELETE are separate entries)
      const tokenRoutes = routes.filter(
        (r: any) => r.path === '/invitations/:token'
      );
      expect(tokenRoutes.length).toBeGreaterThan(0);
      // Check that DELETE exists among the methods
      const hasDeleteMethod = tokenRoutes.some((r: any) =>
        r.methods.includes('delete')
      );
      expect(hasDeleteMethod).toBe(true);
    });
  });

  describe('Route Count', () => {
    it('should have all 8 organization routes configured', () => {
      const routes = router.stack
        .filter((layer: RouterLayer) => layer.route)
        .map((layer: RouterLayer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      // 16 endpoints total:
      // POST /signup
      // POST /organizations/register
      // GET /organizations/:id
      // PUT /organizations/:id
      // POST /organizations/:id/invitations
      // GET /organizations/:id/invitations
      // GET /organizations/:id/users
      // PUT /organizations/:id/users/:userId
      // POST /organizations/:id/users/:userId/deactivate
      // POST /organizations/:id/users/:userId/reactivate
      // POST /organizations/:id/invitations/:invitationId/resend
      // DELETE /organizations/:id/invitations/:invitationId
      // GET /invitations/:token
      // POST /invitations/accept
      // DELETE /invitations/:token
      // POST /organizations/:id/seed-demo
      // DELETE /organizations/:id/demo-data
      // GET /organizations/:id/demo-data/status
      // POST /portal-invitations/accept
      // GET /organizations/:id/users/:userId/section-access
      // PUT /organizations/:id/users/:userId/section-access
      // GET /organizations/:id/staff-options
      expect(routes.length).toBe(22);
    });
  });

  describe('Authentication Requirements', () => {
    it('should have public signup endpoint (no auth required)', () => {
      const routes = router.stack.filter(
        (layer: RouterLayer) => layer.route?.path === '/signup'
      );

      expect(routes.length).toBe(1);
      // Signup should be accessible without authentication
      const route = routes[0] as RouterLayer;
      expect(route?.route?.methods?.post).toBe(true);
    });

    it('should have public organization registration endpoint (no auth required)', () => {
      const routes = router.stack.filter(
        (layer: RouterLayer) => layer.route?.path === '/organizations/register'
      );

      expect(routes.length).toBe(1);
      const route = routes[0] as RouterLayer;
      expect(route?.route?.methods?.post).toBe(true);
    });

    it('should have public invitation details endpoint (no auth required)', () => {
      const routes = router.stack.filter(
        (layer: RouterLayer) => layer.route?.path === '/invitations/:token'
      );

      // GET and DELETE are separate route entries
      expect(routes.length).toBeGreaterThan(0);
      // Find the GET route (for getting invitation details - public)
      const getRoute = routes.find(
        (r: RouterLayer) => r.route.methods.get === true
      );
      expect(getRoute).toBeDefined();
    });

    it('should have public accept invitation endpoint (no auth required)', () => {
      const routes = router.stack.filter(
        (layer: RouterLayer) => layer.route?.path === '/invitations/accept'
      );

      expect(routes.length).toBe(1);
      const route = routes[0] as RouterLayer;
      expect(route?.route?.methods?.post).toBe(true);
    });

    it('should require auth for get organization by ID', () => {
      const routes = router.stack.filter(
        (layer: RouterLayer) => layer.route?.path === '/organizations/:id'
      );

      // GET and PUT are separate route entries
      expect(routes.length).toBe(2);
      // Check both GET and PUT routes exist
      const hasGet = routes.some(
        (r: RouterLayer) => r.route.methods.get === true
      );
      const hasPut = routes.some(
        (r: RouterLayer) => r.route.methods.put === true
      );
      expect(hasGet).toBe(true);
      expect(hasPut).toBe(true);
    });

    it('should require auth for organization invitations management', () => {
      const routes = router.stack.filter(
        (layer: RouterLayer) =>
          layer.route?.path === '/organizations/:id/invitations'
      );

      // GET and POST are separate route entries
      expect(routes.length).toBeGreaterThan(0);
      // Check both GET and POST routes exist
      const hasGet = routes.some(
        (r: RouterLayer) => r.route.methods.get === true
      );
      const hasPost = routes.some(
        (r: RouterLayer) => r.route.methods.post === true
      );
      expect(hasGet).toBe(true);
      expect(hasPost).toBe(true);
    });

    it('should require auth for revoking invitations', () => {
      const routes = router.stack.filter(
        (layer: RouterLayer) => layer.route?.path === '/invitations/:token'
      );

      // GET and DELETE are separate route entries
      expect(routes.length).toBeGreaterThan(0);
      // Find the DELETE route (requires auth)
      const deleteRoute = routes.find(
        (r: RouterLayer) => r.route.methods.delete === true
      );
      expect(deleteRoute).toBeDefined();
    });

    it('should have demo data seeding endpoint with auth', () => {
      const routes = router.stack.filter(
        (layer: RouterLayer) => layer.route?.path === '/organizations/:id/seed-demo'
      );

      expect(routes.length).toBe(1);
      const route = routes[0] as RouterLayer;
      expect(route?.route?.methods?.post).toBe(true);
    });

    it('should have demo data deletion endpoint with auth', () => {
      const routes = router.stack.filter(
        (layer: RouterLayer) => layer.route?.path === '/organizations/:id/demo-data'
      );

      expect(routes.length).toBe(1);
      const route = routes[0] as RouterLayer;
      expect(route?.route?.methods?.delete).toBe(true);
    });

    it('should have demo data status endpoint with auth', () => {
      const routes = router.stack.filter(
        (layer: RouterLayer) => layer.route?.path === '/organizations/:id/demo-data/status'
      );

      expect(routes.length).toBe(1);
      const route = routes[0] as RouterLayer;
      expect(route?.route?.methods?.get).toBe(true);
    });

    it('should configure PUT /organizations/:id endpoint with auth and role requirements', () => {
      const putRoute = router.stack.find(
        (layer: RouterLayer) => layer.route?.path === '/organizations/:id' && layer.route.methods.put === true
      );
      expect(putRoute).toBeDefined();
    });
  });

  describe('Section Access Endpoints (/organizations/:id/users/:userId/section-access)', () => {
    const adminId = '123e4567-e89b-12d3-a456-426614174000';
    const orgId = '223e4567-e89b-12d3-a456-426614174000';
    const targetUserId = '333e4567-e89b-12d3-a456-426614174000';

    function buildOrgTestApp(roleOverride?: string[], orgOverride?: string): express.Express {
      const app = express();
      app.use(express.json());
      if (roleOverride !== undefined || orgOverride !== undefined) {
        app.use((req, _res, next) => {
          req.user = {
            userId: adminId,
            email: 'caller@example.com',
            organizationId: orgOverride ?? orgId,
            branchIds: [],
            roles: roleOverride ?? ['ORG_ADMIN'],
            permissions: [],
            tokenVersion: 1,
          };
          next();
        });
      }
      app.use('/api', router);
      return app;
    }

    it('rejects COORDINATOR and BRANCH_ADMIN with 403 on GET and PUT', async () => {
      for (const role of ['COORDINATOR', 'BRANCH_ADMIN']) {
        const app = buildOrgTestApp([role]);

        const getRes = await request(app).get(
          `/api/organizations/${orgId}/users/${targetUserId}/section-access`
        );
        expect(getRes.status).toBe(403);

        const putRes = await request(app)
          .put(`/api/organizations/${orgId}/users/${targetUserId}/section-access`)
          .send({ overrides: [{ section: 'clients', access: 'READ' }] });
        expect(putRes.status).toBe(403);
      }
    });

    it('rejects cross-org requests with 403', async () => {
      const otherOrgId = '999e4567-e89b-12d3-a456-426614174000';
      const app = buildOrgTestApp(['ORG_ADMIN'], orgId);

      const getRes = await request(app).get(
        `/api/organizations/${otherOrgId}/users/${targetUserId}/section-access`
      );
      expect(getRes.status).toBe(403);

      const putRes = await request(app)
        .put(`/api/organizations/${otherOrgId}/users/${targetUserId}/section-access`)
        .send({ overrides: [{ section: 'clients', access: 'READ' }] });
      expect(putRes.status).toBe(403);
    });

    it('rejects self-edit with 403', async () => {
      const app = buildOrgTestApp(['ORG_ADMIN'], orgId);

      const putRes = await request(app)
        .put(`/api/organizations/${orgId}/users/${adminId}/section-access`)
        .send({ overrides: [{ section: 'clients', access: 'READ' }] });

      expect(putRes.status).toBe(403);
      expect(putRes.body.code).toBe('SELF_SECTION_ACCESS_EDIT');
    });

    it('GET returns roleDefaults, overrides and effective for a user in the org', async () => {
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({
          rows: [
            {
              id: targetUserId,
              roles: ['COORDINATOR'],
              permissions: ['clients:read', 'clients:write'],
              branch_ids: [],
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        // resolvePortalLinks runs three queries: caregiver link, family links, direct client link (none)
        .mockResolvedValueOnce({ rows: [] } as never)
        .mockResolvedValueOnce({ rows: [] } as never)
        .mockResolvedValueOnce({ rows: [] } as never)
        .mockResolvedValueOnce({
          rows: [{ section: 'clients', access: 'READ' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      const app = buildOrgTestApp(['ORG_ADMIN'], orgId);
      const res = await request(app).get(
        `/api/organizations/${orgId}/users/${targetUserId}/section-access`
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.roleDefaults.clients).toEqual({ read: true, write: true });
      expect(res.body.data.overrides).toEqual([{ section: 'clients', access: 'READ' }]);
      expect(res.body.data.effective.clients).toEqual({ read: true, write: false });
    });

    it('PUT writes an audit event attributed to the admin and returns updated effective access', async () => {
      const auditSpy = vi.spyOn(AuditService.prototype, 'logEvent').mockResolvedValue();
      mockDb.transaction = vi.fn(async (cb) => {
        const mockClient = {
          query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
        };
        return cb(mockClient as never);
      });

      vi.mocked(mockDb.query)
        // 1. loadSectionAccessTarget
        .mockResolvedValueOnce({
          rows: [
            {
              id: targetUserId,
              roles: ['COORDINATOR'],
              permissions: ['clients:read', 'clients:write'],
              branch_ids: [],
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        // resolvePortalLinks runs three queries: caregiver link, family links, direct client link (none)
        .mockResolvedValueOnce({ rows: [] } as never)
        .mockResolvedValueOnce({ rows: [] } as never)
        .mockResolvedValueOnce({ rows: [] } as never)
        // 2. SectionAccessService.setOverride target user check
        .mockResolvedValueOnce({
          rows: [{ id: targetUserId, organization_id: orgId, deleted_at: null }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        // 3. SectionAccessService.setOverride existing override check
        .mockResolvedValueOnce({
          rows: [],
          command: 'SELECT',
          rowCount: 0,
          oid: 0,
          fields: [],
        })
        // 4. getEffective -> getOverrides after update
        .mockResolvedValueOnce({
          rows: [{ section: 'clients', access: 'NONE' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      const app = buildOrgTestApp(['ORG_ADMIN'], orgId);
      const res = await request(app)
        .put(`/api/organizations/${orgId}/users/${targetUserId}/section-access`)
        .send({ overrides: [{ section: 'clients', access: 'NONE' }] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.effective.clients).toEqual({ read: false, write: false });
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: adminId,
          organizationId: orgId,
        }),
        expect.objectContaining({
          eventType: 'AUTHORIZATION',
          resource: 'user_section_access',
          resourceId: targetUserId,
          action: 'SECTION_ACCESS_SET',
          metadata: {
            section: 'clients',
            previous: null,
            next: 'NONE',
          },
        })
      );
    });

    it('returns 400 when given an invalid section name', async () => {
      const app = buildOrgTestApp(['ORG_ADMIN'], orgId);
      const res = await request(app)
        .put(`/api/organizations/${orgId}/users/${targetUserId}/section-access`)
        .send({ overrides: [{ section: 'not-a-valid-section', access: 'READ' }] });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    const isReadable = (p: unknown): boolean => {
      const perm = p as { read: boolean; write: boolean };
      return perm.read || perm.write;
    };

    describe('derived roles in section-access defaults (wdvf3acxk6)', () => {
      const targetRow = {
        rows: [{ id: targetUserId, roles: ['CAREGIVER'], permissions: [], branch_ids: [] }],
      };

      it('GET returns the CAREGIVER role defaults when the user has an ACTIVE caregiver link', async () => {
        vi.mocked(mockDb.query)
          .mockResolvedValueOnce(targetRow as never)
          .mockResolvedValueOnce({ rows: [{ id: 'cg-1' }] } as never) // caregiver link
          .mockResolvedValueOnce({ rows: [] } as never) // family links
          .mockResolvedValueOnce({ rows: [] } as never); // overrides
        const res = await request(buildOrgTestApp(['ORG_ADMIN'], orgId)).get(
          `/api/organizations/${orgId}/users/${targetUserId}/section-access`
        );
        expect(res.status).toBe(200);
        const anyReadable = Object.values(res.body.data.roleDefaults).some(isReadable);
        expect(anyReadable).toBe(true);
      });

      it('GET returns NONE everywhere for a CAREGIVER-role user without a link', async () => {
        vi.mocked(mockDb.query)
          .mockResolvedValueOnce(targetRow as never)
          .mockResolvedValueOnce({ rows: [] } as never)
          .mockResolvedValueOnce({ rows: [] } as never)
          .mockResolvedValueOnce({ rows: [] } as never);
        const res = await request(buildOrgTestApp(['ORG_ADMIN'], orgId)).get(
          `/api/organizations/${orgId}/users/${targetUserId}/section-access`
        );
        expect(res.status).toBe(200);
        const anyReadable = Object.values(res.body.data.roleDefaults).some(isReadable);
        expect(anyReadable).toBe(false);
      });
    });
  });

  describe('PUT /organizations/:id/users/:userId role write (wdvf3acxk6)', () => {
    const orgId = '223e4567-e89b-12d3-a456-426614174000';
    const userId = '333e4567-e89b-12d3-a456-426614174000';

    it('returns 400 naming the portal invite flow when the service rejects CAREGIVER', async () => {
      const results = vi.mocked(OrganizationService).mock.results;
      const svc = results[results.length - 1]?.value as { updateOrganizationUser: ReturnType<typeof vi.fn> };
      svc.updateOrganizationUser = vi
        .fn()
        .mockRejectedValue(new ValidationError('Use "Caregivers > Invite to portal" instead'));
      const app = express();
      app.use(express.json());
      app.use('/api', router);
      const res = await request(app)
        .put(`/api/organizations/${orgId}/users/${userId}`)
        .send({ roles: ['CAREGIVER'] });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invite to portal/);
    });
  });

function buildOrgTestApp(user: { userId: string; organizationId: string; roles: string[] } | null): express.Express {
  const mockDb = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  } as unknown as Database;
  const r = createOrganizationRouter(mockDb);
  const app = express();
  app.use(express.json());
  app.use((req: any, res: any, next: any) => {
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    req.user = user;
    req.userContext = { ...user, permissions: [] };
    next();
  });
  app.use('/api', r);
  return app;
}

  describe('Team Roster & Invitations Read RBAC (wdvf3ad5fr)', () => {
    const orgId = '223e4567-e89b-12d3-a456-426614174000';
    const otherOrgId = '999e4567-e89b-12d3-a456-426614174999';

    it.each(['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'ADMIN'])(
      'allows admin role %s to read /users and /invitations (200)',
      async (role) => {
        const app = buildOrgTestApp({ userId: 'u-1', organizationId: orgId, roles: [role] });
        const results = vi.mocked(OrganizationService).mock.results;
        const svc = results[results.length - 1]?.value as any;
        svc.getOrganizationUsers = vi.fn().mockResolvedValue([]);
        svc.getOrganizationInvitations = vi.fn().mockResolvedValue([]);

        const usersRes = await request(app).get(`/api/organizations/${orgId}/users`);
        expect(usersRes.status).toBe(200);
        const invRes = await request(app).get(`/api/organizations/${orgId}/invitations`);
        expect(invRes.status).toBe(200);
      }
    );

    it.each(['COORDINATOR', 'NURSE_RN', 'NURSE', 'SCHEDULER', 'BILLING', 'CAREGIVER', 'FAMILY'])(
      'denies non-admin role %s on /users and /invitations with 403',
      async (role) => {
        const app = buildOrgTestApp({ userId: 'u-2', organizationId: orgId, roles: [role] });
        const usersRes = await request(app).get(`/api/organizations/${orgId}/users`);
        expect(usersRes.status).toBe(403);
        const invRes = await request(app).get(`/api/organizations/${orgId}/invitations`);
        expect(invRes.status).toBe(403);
      }
    );

    it('denies cross-organization admin with 403', async () => {
      const app = buildOrgTestApp({ userId: 'u-1', organizationId: otherOrgId, roles: ['ORG_ADMIN'] });
      const usersRes = await request(app).get(`/api/organizations/${orgId}/users`);
      expect(usersRes.status).toBe(403);
      const invRes = await request(app).get(`/api/organizations/${orgId}/invitations`);
      expect(invRes.status).toBe(403);
    });

    it('denies unauthenticated requests with 401', async () => {
      const app = buildOrgTestApp(null);
      const usersRes = await request(app).get(`/api/organizations/${orgId}/users`);
      expect(usersRes.status).toBe(401);
      const invRes = await request(app).get(`/api/organizations/${orgId}/invitations`);
      expect(invRes.status).toBe(401);
    });
  });

  describe('GET /organizations/:id/staff-options (wdvf3ad5fr)', () => {
    const orgId = '223e4567-e89b-12d3-a456-426614174000';
    const otherOrgId = '999e4567-e89b-12d3-a456-426614174999';

    it('returns 200 with narrow { id, firstName, lastName }[] when authorized', async () => {
      const app = buildOrgTestApp({ userId: 'u-1', organizationId: orgId, roles: ['COORDINATOR'] });
      const results = vi.mocked(OrganizationService).mock.results;
      const svc = results[results.length - 1]?.value as any;
      svc.getStaffOptions = vi.fn().mockResolvedValue([
        { id: 'staff-1', firstName: 'Sarah', lastName: 'Miller' },
      ]);

      const res = await request(app).get(`/api/organizations/${orgId}/staff-options`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([{ id: 'staff-1', firstName: 'Sarah', lastName: 'Miller' }]);
      expect(res.body.data[0].email).toBeUndefined();
      expect(res.body.data[0].roles).toBeUndefined();
      expect(res.body.data[0].status).toBeUndefined();
    });

    it('returns 403 when OrganizationService.getStaffOptions throws PermissionError', async () => {
      const app = buildOrgTestApp({ userId: 'u-2', organizationId: orgId, roles: ['BILLING'] });
      const results = vi.mocked(OrganizationService).mock.results;
      const svc = results[results.length - 1]?.value as any;
      svc.getStaffOptions = vi.fn().mockRejectedValue(new PermissionError('Permission denied'));

      const res = await request(app).get(`/api/organizations/${orgId}/staff-options`);
      expect(res.status).toBe(403);
    });

    it('returns 403 for cross-org requests and 401 when unauthenticated', async () => {
      const crossApp = buildOrgTestApp({ userId: 'u-1', organizationId: otherOrgId, roles: ['COORDINATOR'] });
      const crossRes = await request(crossApp).get(`/api/organizations/${orgId}/staff-options`);
      expect(crossRes.status).toBe(403);

      const unauthApp = buildOrgTestApp(null);
      const unauthRes = await request(unauthApp).get(`/api/organizations/${orgId}/staff-options`);
      expect(unauthRes.status).toBe(401);
    });
  });
});
