/**
 * wdvf3acxjt: client portal invite / revoke / suspend / status routes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import type { Database } from '@folkcare/core';
import { createPortalAccessRouter } from '../portal-access.js';

let mockUserContext: Record<string, unknown> = {};
const sendInvitation = vi.fn().mockResolvedValue('sent');

vi.mock('@folkcare/core', async () => {
  const actual = await vi.importActual('@folkcare/core');
  return {
    ...actual,
    createEmailService: vi.fn(() => ({ sendInvitation })),
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

const ORG = 'org-1';
const staff = {
  userId: 'user-admin-1',
  organizationId: ORG,
  branchIds: ['b-1'],
  roles: ['ORG_ADMIN'],
  permissions: ['clients:read', 'clients:update'],
};

describe('Client portal access routes', () => {
  let mockDb: any;
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserContext = { ...staff };
    mockDb = {
      query: vi.fn(),
      transaction: vi.fn((fn: any) => fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) })),
      getPool: vi.fn().mockReturnValue({}),
    };
    app = express();
    app.use(express.json());
    app.use('/api', createPortalAccessRouter(mockDb as unknown as Database));
  });

  const clientRow = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: 'c-1',
    email: 'client@example.com',
    first_name: 'Cli',
    last_name: 'Ent',
    organization_id: ORG,
    status: 'ACTIVE',
    ...over,
  });

  describe('POST /api/clients/:id/portal-invite', () => {
    it('invites and emails a client with a valid email (200)', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [clientRow()] }) // route client check
        .mockResolvedValueOnce({ rows: [clientRow()] }) // service client check
        .mockResolvedValue({ rows: [{ name: 'MHC Portal', first_name: 'A', last_name: 'B' }] });
      const res = await request(app).post('/api/clients/c-1/portal-invite');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeTruthy();
      expect(sendInvitation).toHaveBeenCalledWith(expect.objectContaining({ recipientEmail: 'client@example.com' }));
    });

    it('requires clients:update (403, no DB access)', async () => {
      mockUserContext = { ...staff, roles: ['READ_ONLY'], permissions: ['clients:read'] };
      const res = await request(app).post('/api/clients/c-1/portal-invite');
      expect(res.status).toBe(403);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('a CLIENT-role user cannot invite (403)', async () => {
      mockUserContext = { ...staff, roles: ['CLIENT'], permissions: ['clients:read'], directClientId: 'c-1' };
      const res = await request(app).post('/api/clients/c-1/portal-invite');
      expect(res.status).toBe(403);
    });

    it('returns 404 for a client of another organization', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [clientRow({ organization_id: 'org-2' })] });
      const res = await request(app).post('/api/clients/c-1/portal-invite');
      expect(res.status).toBe(404);
    });

    it.each(['DISCHARGED', 'DECEASED'])('returns 409 for %s clients', async (status) => {
      mockDb.query.mockResolvedValueOnce({ rows: [clientRow({ status })] });
      const res = await request(app).post('/api/clients/c-1/portal-invite');
      expect(res.status).toBe(409);
      expect(res.body.error).toContain(status);
      expect(sendInvitation).not.toHaveBeenCalled();
    });

    it.each([null, '', '   '])('returns 400 for missing/blank email (%j)', async (email) => {
      mockDb.query.mockResolvedValueOnce({ rows: [clientRow({ email })] });
      const res = await request(app).post('/api/clients/c-1/portal-invite');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/valid email/);
      expect(sendInvitation).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/clients/:id/portal-revoke and portal-suspend', () => {
    it.each(['portal-revoke', 'portal-suspend'])('%s requires a reason (400)', async (action) => {
      const res = await request(app).post(`/api/clients/c-1/${action}`).send({});
      expect(res.status).toBe(400);
    });

    it.each(['portal-revoke', 'portal-suspend'])('%s requires clients:update (403)', async (action) => {
      mockUserContext = { ...staff, roles: ['READ_ONLY'], permissions: ['clients:read'] };
      const res = await request(app).post(`/api/clients/c-1/${action}`).send({ reason: 'x' });
      expect(res.status).toBe(403);
    });

    it('revoke succeeds for same-org client', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ organization_id: ORG }] })
        .mockResolvedValueOnce({ rows: [{ id: 'c-1', user_id: null, portal_access_status: 'INVITED' }] });
      const res = await request(app).post('/api/clients/c-1/portal-revoke').send({ reason: 'moved' });
      expect(res.status).toBe(200);
    });

    it('revoke of another organization\'s client is 404 and writes nothing', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ organization_id: 'org-2' }] });
      const res = await request(app).post('/api/clients/c-1/portal-revoke').send({ reason: 'moved' });
      expect(res.status).toBe(404);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('suspend succeeds for ACTIVE same-org client and 409 otherwise', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'c-1', organization_id: ORG, user_id: null, portal_access_status: 'ACTIVE' }],
      });
      expect((await request(app).post('/api/clients/c-1/portal-suspend').send({ reason: 'hold' })).status).toBe(200);

      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'c-1', organization_id: ORG, user_id: null, portal_access_status: 'INVITED' }],
      });
      expect((await request(app).post('/api/clients/c-1/portal-suspend').send({ reason: 'hold' })).status).toBe(409);
    });
  });

  describe('GET /api/clients/:id/portal-access', () => {
    it('returns status for staff with clients:update', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'c-1', organization_id: ORG, email: 'client@example.com', status: 'ACTIVE', user_id: null,
            portal_access_status: 'INVITED', portal_invited_at: new Date('2026-11-01T00:00:00Z'),
            portal_activated_at: null, portal_revoked_at: null, portal_revoked_reason: null,
          }],
        })
        .mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/clients/c-1/portal-access');
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ clientId: 'c-1', status: 'INVITED', linked: false });
    });

    it('is denied to CLIENT users and users without clients:update (403)', async () => {
      mockUserContext = { ...staff, roles: ['CLIENT'], permissions: ['clients:read'], directClientId: 'c-1' };
      expect((await request(app).get('/api/clients/c-1/portal-access')).status).toBe(403);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('404s for another organization', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'c-1', organization_id: 'org-2' }] });
      expect((await request(app).get('/api/clients/c-1/portal-access')).status).toBe(404);
    });
  });
});
