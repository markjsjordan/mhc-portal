/**
 * Portal Access Routes Integration & Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import type { Database } from '@folkcare/core';
import { createCaregiverRouter } from '../caregivers.js';
import { createPortalAccessRouter } from '../portal-access.js';
import { createOrganizationRouter } from '../organizations.js';

let mockUserContext = {
  userId: 'user-admin-1',
  organizationId: 'org-1',
  branchIds: ['b-1'],
  roles: ['ORG_ADMIN'],
  permissions: ['caregivers:read', 'caregivers:update', 'clients:read', 'clients:update'],
};

vi.mock('@folkcare/caregiver-staff', () => ({
  CaregiverService: vi.fn().mockImplementation(() => ({})),
  CredentialExpirationService: vi.fn().mockImplementation(() => ({})),
  ExclusionListService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@folkcare/core', async () => {
  const actual = await vi.importActual('@folkcare/core');
  return {
    ...actual,
    createEmailService: vi.fn(() => ({
      sendInvitation: vi.fn().mockImplementation(async () => {}),
    })),
    AuthMiddleware: vi.fn().mockImplementation(function () {
      return {
        requireAuth: (req: any, _res: any, next: any) => {
          req.user = { ...mockUserContext };
          next();
        },
        requireSameOrganization: () => (_req: any, _res: any, next: any) => next(),
        requireRole: () => (_req: any, _res: any, next: any) => next(),
        auditImpersonatedActions: (_req: any, _res: any, next: any) => next(),
      };
    }),
  };
});

describe('Portal Access API Routes', () => {
  let mockDb: any;
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserContext = {
      userId: 'user-admin-1',
      organizationId: 'org-1',
      branchIds: ['b-1'],
      roles: ['ORG_ADMIN'],
      permissions: ['caregivers:read', 'caregivers:update', 'clients:read', 'clients:update'],
    };

    mockDb = {
      query: vi.fn(),
      transaction: vi.fn((fn: any) => fn({ query: vi.fn().mockResolvedValue({ rows: [] }) })),
      getPool: vi.fn().mockReturnValue({}),
    };

    app = express();
    app.use(express.json());
    app.use('/api/caregivers', createCaregiverRouter(mockDb as unknown as Database));
    app.use('/api', createPortalAccessRouter(mockDb as unknown as Database));
    app.use('/api', createOrganizationRouter(mockDb as unknown as Database));
  });

  describe('Caregiver Portal Access Endpoints', () => {
    it('GET /api/caregivers/:id/portal-access returns 200 with summary for caller with caregivers:update', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'user-1',
              portal_access_status: 'ACTIVE',
              portal_invited_at: new Date('2026-11-01T00:00:00Z'),
              portal_activated_at: new Date('2026-11-02T00:00:00Z'),
              portal_revoked_at: null,
              portal_revoked_reason: 'Prior reason',
              last_login_at: new Date('2026-11-05T00:00:00Z'),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/caregivers/cg-1/portal-access');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        status: 'ACTIVE',
        invitedAt: '2026-11-01T00:00:00.000Z',
        activatedAt: '2026-11-02T00:00:00.000Z',
        revokedAt: null,
        revokedReason: 'Prior reason',
        inviteExpiresAt: null,
        lastLoginAt: '2026-11-05T00:00:00.000Z',
        linked: true,
      });
      expect(res.body.data.token).toBeUndefined();
    });

    it('GET /api/caregivers/:id/portal-access hides revokedReason for read-only caller', async () => {
      mockUserContext.roles = ['AUDITOR'];
      mockUserContext.permissions = ['caregivers:read'];
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: null,
              portal_access_status: 'REVOKED',
              portal_invited_at: null,
              portal_activated_at: null,
              portal_revoked_at: new Date('2026-11-03T00:00:00Z'),
              portal_revoked_reason: 'Confidential misconduct',
              last_login_at: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/caregivers/cg-1/portal-access');
      expect(res.status).toBe(200);
      expect(res.body.data.revokedReason).toBeNull();
      expect(res.body.data.status).toBe('REVOKED');
      expect(res.body.data.linked).toBe(false);
    });

    it('GET /api/caregivers/:id/portal-access succeeds for role holding wildcard permission', async () => {
      mockUserContext.roles = ['ORG_ADMIN'];
      mockUserContext.permissions = ['caregivers:*'];
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: null,
              portal_access_status: 'NONE',
              portal_invited_at: null,
              portal_activated_at: null,
              portal_revoked_at: null,
              portal_revoked_reason: null,
              last_login_at: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/caregivers/cg-1/portal-access');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/caregivers/:id/portal-access returns 403 when lacking caregiver read/update permissions', async () => {
      mockUserContext.roles = ['CAREGIVER'];
      mockUserContext.permissions = ['clients:read'];

      const res = await request(app).get('/api/caregivers/cg-1/portal-access');
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/caregivers/:id/portal-invite returns 409 for TERMINATED caregiver', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            employment_status: 'TERMINATED',
            email: 'cg@example.com',
            first_name: 'John',
            last_name: 'Doe',
          },
        ],
      });

      const res = await request(app).post('/api/caregivers/cg-1/portal-invite');
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('TERMINATED');
    });

    it('POST /api/caregivers/:id/portal-invite returns 400 when caregiver has no email', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            employment_status: 'ACTIVE',
            email: '  ',
            first_name: 'John',
            last_name: 'Doe',
          },
        ],
      });

      const res = await request(app).post('/api/caregivers/cg-1/portal-invite');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('email');
    });

    it('POST /api/caregivers/:id/portal-revoke returns 400 for missing or empty reason', async () => {
      const res = await request(app)
        .post('/api/caregivers/cg-1/portal-revoke')
        .send({ reason: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Family Portal Access Endpoints', () => {
    it('GET /api/clients/:clientId/family-portal-access returns 200 with list of family members', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'client-1', organization_id: 'org-1' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'fm-1',
              first_name: 'Jane',
              last_name: 'Doe',
              relationship: 'Daughter',
              email: 'jane@example.com',
              portal_access_level: 'VIEW_DETAILED',
              portal_access_status: 'ACTIVE',
              portal_invited_at: new Date('2026-11-01T00:00:00Z'),
              portal_activated_at: new Date('2026-11-02T00:00:00Z'),
              portal_revoked_at: null,
              portal_revoked_reason: null,
              user_id: 'user-jane',
              last_login_at: new Date('2026-11-04T00:00:00Z'),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/clients/client-1/family-portal-access');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        familyMemberId: 'fm-1',
        firstName: 'Jane',
        lastName: 'Doe',
        relationship: 'Daughter',
        email: 'jane@example.com',
        portalAccessLevel: 'VIEW_DETAILED',
        status: 'ACTIVE',
        linked: true,
      });
      expect(res.body.data[0].token).toBeUndefined();
    });

    it('GET /api/clients/:clientId/family-portal-access returns 403 when lacking client permissions', async () => {
      mockUserContext.roles = [];
      mockUserContext.permissions = ['caregivers:read'];
      const res = await request(app).get('/api/clients/client-1/family-portal-access');
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/family-members/:id/portal-invite returns 409 when client is DISCHARGED or DECEASED', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'fm-1',
            email: 'jane@example.com',
            first_name: 'Jane',
            last_name: 'Doe',
            client_id: 'c-1',
            client_organization_id: 'org-1',
            client_status: 'DISCHARGED',
          },
        ],
      });

      const res = await request(app).post('/api/family-members/fm-1/portal-invite');
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('DISCHARGED');
    });

    it('POST /api/family-members/:id/portal-revoke returns 400 when reason is missing', async () => {
      const res = await request(app)
        .post('/api/family-members/fm-1/portal-revoke')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Organization Users & Portal Invite Acceptance', () => {
    it('GET /api/organizations/:id/users includes linkedCaregiverId and linkedFamilyClientCount', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'u-1',
              first_name: 'Alice',
              last_name: 'Smith',
              email: 'alice@example.com',
              roles: ['CAREGIVER'],
              status: 'ACTIVE',
              created_at: new Date('2026-11-01T00:00:00Z'),
            },
            {
              id: 'u-2',
              first_name: 'Bob',
              last_name: 'Jones',
              email: 'bob@example.com',
              roles: ['FAMILY'],
              status: 'ACTIVE',
              created_at: new Date('2026-11-01T00:00:00Z'),
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'cg-100', user_id: 'u-1' }],
        })
        .mockResolvedValueOnce({
          rows: [{ user_id: 'u-2', client_count: 2 }],
        });

      const res = await request(app).get('/api/organizations/org-1/users');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].linkedCaregiverId).toBe('cg-100');
      expect(res.body.data[0].linkedFamilyClientCount).toBe(0);
      expect(res.body.data[1].linkedCaregiverId).toBeNull();
      expect(res.body.data[1].linkedFamilyClientCount).toBe(2);
    });

    it('POST /api/portal-invitations/accept validates token in body', async () => {
      const res = await request(app)
        .post('/api/portal-invitations/accept')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
