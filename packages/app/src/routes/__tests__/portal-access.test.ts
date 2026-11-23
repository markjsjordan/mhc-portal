/**
 * Portal Access Routes Integration & Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import type { Database } from '@folkcare/core';
import { AuditService } from '@folkcare/core';
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

const mockSendInvitation = vi.fn<(...args: any[]) => Promise<any>>().mockImplementation(async () => {});

vi.mock('@folkcare/core', async () => {
  const actual = await vi.importActual('@folkcare/core');
  return {
    ...actual,
    ADMIN_ROLES: (actual as any).ADMIN_ROLES ?? ['ADMIN', 'ORG_ADMIN'],
    createEmailService: vi.fn(() => ({
      sendInvitation: mockSendInvitation,
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
    vi.spyOn(AuditService.prototype, 'logEvent').mockResolvedValue(undefined as never);
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

      const res = await request(app).get('/api/caregivers/55555555-5555-4555-8555-555555555551/portal-access');
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

      const res = await request(app).get('/api/caregivers/55555555-5555-4555-8555-555555555551/portal-access');
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

      const res = await request(app).get('/api/caregivers/55555555-5555-4555-8555-555555555551/portal-access');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/caregivers/:id/portal-access returns 403 when lacking caregiver read/update permissions', async () => {
      mockUserContext.roles = ['CAREGIVER'];
      mockUserContext.permissions = ['clients:read'];

      const res = await request(app).get('/api/caregivers/55555555-5555-4555-8555-555555555551/portal-access');
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

      const res = await request(app).post('/api/caregivers/55555555-5555-4555-8555-555555555551/portal-invite');
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

      const res = await request(app).post('/api/caregivers/55555555-5555-4555-8555-555555555551/portal-invite');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('email');
    });

    it('POST /api/caregivers/:id/portal-invite success case: sendInvitation resolves → emailSent: true, emailError: null', async () => {
      const caregiverId = '55555555-5555-4555-8555-555555555551';
      mockSendInvitation.mockImplementationOnce(async () => {});
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              employment_status: 'ACTIVE',
              email: 'cg@example.com',
              first_name: 'John',
              last_name: 'Doe',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: caregiverId,
              organization_id: 'org-1',
              email: 'cg@example.com',
              first_name: 'John',
              last_name: 'Doe',
              employment_status: 'ACTIVE',
              deleted_at: null,
            },
          ],
        })
        .mockResolvedValue({
          rows: [
            {
              name: 'MHC Portal',
              first_name: 'Admin',
              last_name: 'User',
              portal_access_status: 'INVITED',
              expires_at: new Date('2026-11-27T00:00:00Z'),
            },
          ],
        });

      const res = await request(app).post(`/api/caregivers/${caregiverId}/portal-invite`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.emailSent).toBe(true);
      expect(res.body.data.emailError).toBeNull();
      expect(res.body.data.inviteUrl).toBeTruthy();
    });

    it('POST /api/caregivers/:id/portal-invite failure case: sendInvitation rejects → emailSent: false, emailError: message', async () => {
      const caregiverId = '55555555-5555-4555-8555-555555555551';
      mockSendInvitation.mockRejectedValueOnce(new Error('Resend API error'));
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              employment_status: 'ACTIVE',
              email: 'cg@example.com',
              first_name: 'John',
              last_name: 'Doe',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: caregiverId,
              organization_id: 'org-1',
              email: 'cg@example.com',
              first_name: 'John',
              last_name: 'Doe',
              employment_status: 'ACTIVE',
              deleted_at: null,
            },
          ],
        })
        .mockResolvedValue({
          rows: [
            {
              name: 'MHC Portal',
              first_name: 'Admin',
              last_name: 'User',
              portal_access_status: 'INVITED',
              expires_at: new Date('2026-11-27T00:00:00Z'),
            },
          ],
        });

      const res = await request(app).post(`/api/caregivers/${caregiverId}/portal-invite`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.emailSent).toBe(false);
      expect(res.body.data.emailError).toBe('Resend API error');
      expect(res.body.data.inviteUrl).toBeTruthy();
    });

    it('POST /api/caregivers/:id/portal-invite sendEmail: false omits emailSent and emailError', async () => {
      const caregiverId = '55555555-5555-4555-8555-555555555551';
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              employment_status: 'ACTIVE',
              email: 'cg@example.com',
              first_name: 'John',
              last_name: 'Doe',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: caregiverId,
              organization_id: 'org-1',
              email: 'cg@example.com',
              first_name: 'John',
              last_name: 'Doe',
              employment_status: 'ACTIVE',
              deleted_at: null,
            },
          ],
        })
        .mockResolvedValue({
          rows: [
            {
              name: 'MHC Portal',
              first_name: 'Admin',
              last_name: 'User',
              portal_access_status: 'INVITED',
              expires_at: new Date('2026-11-27T00:00:00Z'),
            },
          ],
        });

      const res = await request(app)
        .post(`/api/caregivers/${caregiverId}/portal-invite`)
        .send({ sendEmail: false });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).not.toHaveProperty('emailSent');
      expect(res.body.data).not.toHaveProperty('emailError');
      expect(res.body.data.inviteUrl).toBeTruthy();
    });

    it('POST /api/caregivers/:id/portal-revoke returns 400 for missing or empty reason', async () => {
      const res = await request(app)
        .post('/api/caregivers/55555555-5555-4555-8555-555555555551/portal-revoke')
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

    it('POST /api/clients/:clientId/family-members creates family member with default VIEW_BASIC and consent', async () => {
      mockDb.query
        // 1. client lookup
        .mockResolvedValueOnce({
          rows: [{ id: 'client-1', organization_id: 'org-1', branch_id: 'branch-1', status: 'ACTIVE' }],
        })
        // 2. duplicate check
        .mockResolvedValueOnce({ rows: [] })
        // 3. insert family_members
        .mockResolvedValueOnce({ rows: [{ id: 'fm-new-1' }] })
        // 4. insert family_consent
        .mockResolvedValueOnce({ rows: [{ id: 'consent-1' }] })
        // 5. getFamilyMemberPortalRow
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'fm-new-1',
              first_name: 'Bob',
              last_name: 'Smith',
              relationship: 'SPOUSE',
              relationship_note: null,
              email: 'bob@example.com',
              phone_number: '',
              is_primary_contact: false,
              portal_access_level: 'VIEW_BASIC',
              portal_access_status: 'NONE',
              portal_invited_at: null,
              portal_activated_at: null,
              portal_revoked_at: null,
              portal_revoked_reason: null,
              user_id: null,
              last_login_at: null,
            },
          ],
        })
        // 8. getLatestPendingInviteExpiresAt
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post('/api/clients/client-1/family-members')
        .send({
          firstName: 'Bob',
          lastName: 'Smith',
          relationship: 'SPOUSE',
          email: 'BOB@EXAMPLE.COM',
          consent: {
            consentGiven: true,
            authorizedBy: 'CLIENT',
            authorizerName: 'John Smith',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        familyMemberId: 'fm-new-1',
        firstName: 'Bob',
        lastName: 'Smith',
        relationship: 'SPOUSE',
        email: 'bob@example.com',
        portalAccessLevel: 'VIEW_BASIC',
        status: 'NONE',
      });
    });

    it('POST /api/clients/:clientId/family-members returns 400 for invalid email, missing consent, or unconfirmed elevated access', async () => {
      const badEmail = await request(app)
        .post('/api/clients/client-1/family-members')
        .send({
          firstName: 'Bob',
          lastName: 'Smith',
          relationship: 'SPOUSE',
          email: 'not-an-email',
          consent: { consentGiven: true, authorizedBy: 'CLIENT', authorizerName: 'John Smith' },
        });
      expect(badEmail.status).toBe(400);

      const noConsent = await request(app)
        .post('/api/clients/client-1/family-members')
        .send({
          firstName: 'Bob',
          lastName: 'Smith',
          relationship: 'SPOUSE',
          email: 'bob@example.com',
          consent: { consentGiven: false, authorizedBy: 'CLIENT', authorizerName: 'John Smith' },
        });
      expect(noConsent.status).toBe(400);

      const unconfirmedElevated = await request(app)
        .post('/api/clients/client-1/family-members')
        .send({
          firstName: 'Bob',
          lastName: 'Smith',
          relationship: 'SPOUSE',
          email: 'bob@example.com',
          portalAccessLevel: 'VIEW_MEDICAL',
          confirmElevatedAccess: false,
          consent: { consentGiven: true, authorizedBy: 'CLIENT', authorizerName: 'John Smith' },
        });
      expect(unconfirmedElevated.status).toBe(400);
    });

    it('POST /api/clients/:clientId/family-members returns 403 when lacking clients:update', async () => {
      mockUserContext.roles = [];
      mockUserContext.permissions = ['clients:read'];
      const res = await request(app)
        .post('/api/clients/client-1/family-members')
        .send({});
      expect(res.status).toBe(403);
    });

    it('POST /api/clients/:clientId/family-members returns 404 for wrong-org client', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'client-1', organization_id: 'other-org', branch_id: 'b-1', status: 'ACTIVE' }],
      });
      const res = await request(app)
        .post('/api/clients/client-1/family-members')
        .send({
          firstName: 'Bob',
          lastName: 'Smith',
          relationship: 'SPOUSE',
          email: 'bob@example.com',
          consent: { consentGiven: true, authorizedBy: 'CLIENT', authorizerName: 'John Smith' },
        });
      expect(res.status).toBe(404);
    });

    it('POST /api/clients/:clientId/family-members returns 409 for DISCHARGED client', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'client-1', organization_id: 'org-1', branch_id: 'b-1', status: 'DISCHARGED' }],
      });
      const res = await request(app)
        .post('/api/clients/client-1/family-members')
        .send({
          firstName: 'Bob',
          lastName: 'Smith',
          relationship: 'SPOUSE',
          email: 'bob@example.com',
          consent: { consentGiven: true, authorizedBy: 'CLIENT', authorizerName: 'John Smith' },
        });
      expect(res.status).toBe(409);
    });

    it('POST /api/clients/:clientId/family-members returns 409 for duplicate email on same client', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: 'client-1', organization_id: 'org-1', branch_id: 'b-1', status: 'ACTIVE' }],
        })
        .mockResolvedValueOnce({ rows: [{ id: 'existing-fm', status: 'ACTIVE' }] });
      const res = await request(app)
        .post('/api/clients/client-1/family-members')
        .send({
          firstName: 'Bob',
          lastName: 'Smith',
          relationship: 'SPOUSE',
          email: 'bob@example.com',
          consent: { consentGiven: true, authorizedBy: 'CLIENT', authorizerName: 'John Smith' },
        });
      expect(res.status).toBe(409);
    });

    it('PATCH /api/family-members/:id updates portalAccessLevel and returns 400 for unconfirmed elevated access', async () => {
      const badRes = await request(app)
        .patch('/api/family-members/fm-1')
        .send({ portalAccessLevel: 'FULL_ACCESS', confirmElevatedAccess: false });
      expect(badRes.status).toBe(400);

      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'fm-1',
              client_id: 'client-1',
              portal_access_level: 'VIEW_BASIC',
              client_organization_id: 'org-1',
              client_status: 'ACTIVE',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'fm-1',
              first_name: 'Jane',
              last_name: 'Doe',
              relationship: 'CHILD',
              relationship_note: null,
              email: 'jane@example.com',
              phone_number: '',
              is_primary_contact: false,
              portal_access_level: 'VIEW_DETAILED',
              portal_access_status: 'ACTIVE',
              portal_invited_at: null,
              portal_activated_at: null,
              portal_revoked_at: null,
              portal_revoked_reason: null,
              user_id: null,
              last_login_at: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValue({ rows: [] });

      const okRes = await request(app)
        .patch('/api/family-members/fm-1')
        .send({ portalAccessLevel: 'VIEW_DETAILED' });
      expect(okRes.status).toBe(200);
      expect(okRes.body.data.portalAccessLevel).toBe('VIEW_DETAILED');
    });

    it('DELETE /api/family-members/:id soft-deletes family member and revokes consent', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'fm-1',
              client_id: 'client-1',
              portal_access_status: 'NONE',
              client_organization_id: 'org-1',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE family_members status = INACTIVE
        .mockResolvedValueOnce({ rows: [] }) // UPDATE family_consent revoked_at
        .mockResolvedValue({ rows: [] });

      const res = await request(app).delete('/api/family-members/fm-1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
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
          rows: [{ id: '55555555-5555-4555-8555-55555555555100', user_id: 'u-1' }],
        })
        .mockResolvedValueOnce({
          rows: [{ user_id: 'u-2', client_count: 2 }],
        });

      const res = await request(app).get('/api/organizations/org-1/users');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].linkedCaregiverId).toBe('55555555-5555-4555-8555-55555555555100');
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
