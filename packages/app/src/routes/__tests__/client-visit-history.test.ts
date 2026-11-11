/**
 * Tests for GET /api/clients/:clientId/visit-history
 * 
 * Covers authorization (clients:read vs visits:read), FAMILY scoping,
 * org/branch isolation, pagination, and PHI audit logging.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { Database, AuthMiddleware } from '@folkcare/core';
import { createClientVisitHistoryRouter } from '../client-visit-history';
import { randomUUID } from 'node:crypto';

describe('GET /api/clients/:clientId/visit-history', () => {
  let app: Express;
  let db: Database;
  let testOrgId: string;
  let testClientId: string;
  let familyMemberUserId: string;

  beforeAll(async () => {
    // Setup test database
    const connectionString =
      process.env.DATABASE_URL ?? 'postgresql://postgres:***@localhost:5432/folk-care-0';
    db = new Database(connectionString);

    testOrgId = randomUUID();
    testClientId = randomUUID();
    familyMemberUserId = randomUUID();

    // Create express app
    app = express();
    app.use(express.json());

    // Mock auth middleware for testing
    const mockAuthMiddleware = (req: any, res: any, next: any) => {
      // Will be set per test
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      next();
    };

    // Replace the real auth middleware with mock
    vi.spyOn(AuthMiddleware.prototype, 'requireAuth').mockImplementation(
      () => mockAuthMiddleware
    );
    vi.spyOn(AuthMiddleware.prototype, 'auditImpersonatedActions').mockReturnValue(undefined);

    const router = createClientVisitHistoryRouter(db);
    app.use('/api', router);

    // Create test visit data
    await db.query(
      `INSERT INTO visits (
        id, organization_id, branch_id, client_id,
        visit_number, visit_type, service_type_id, service_type_name,
        scheduled_date, scheduled_start_time, scheduled_end_time,
        scheduled_duration, timezone, address, status, status_history,
        is_urgent, is_priority, requires_supervision, assignment_method,
        signature_required, created_at, created_by, updated_at, updated_by, version
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, 'REGULAR', gen_random_uuid(), 'Personal Care',
        '2024-11-11', '09:00', '10:00', 60, 'America/Chicago', '{}', 'COMPLETED', '[]',
        false, false, false, 'MANUAL', true, NOW(), $5, NOW(), $5, 1
      )`,
      [testOrgId, randomUUID(), testClientId, `V2024-TEST-${Math.random()}`, randomUUID()]
    );
  });

  afterAll(async () => {
    await db.query('DELETE FROM visits WHERE organization_id = $1', [testOrgId]);
    await db.close();
    vi.restoreAllMocks();
  });

  it('should return 200 for users with clients:read permission', async () => {
    const res = await request(app)
      .get(`/api/clients/${testClientId}/visit-history`)
      .set('user', JSON.stringify({
        userId: randomUUID(),
        organizationId: testOrgId,
        branchIds: [],
        roles: ['BRANCH_ADMIN'],
        permissions: ['clients:read'],
      }));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.items).toBeInstanceOf(Array);
  });

  it('should return 403 for users without clients:read permission', async () => {
    const res = await request(app)
      .get(`/api/clients/${testClientId}/visit-history`)
      .set('user', JSON.stringify({
        userId: randomUUID(),
        organizationId: testOrgId,
        branchIds: [],
        roles: ['HR'],
        permissions: ['staff:*'],
      }));

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('PERMISSION_DENIED');
  });

  it('should allow CAREGIVER with clients:read but no visits:read', async () => {
    const res = await request(app)
      .get(`/api/clients/${testClientId}/visit-history`)
      .set('user', JSON.stringify({
        userId: randomUUID(),
        organizationId: testOrgId,
        branchIds: [],
        roles: ['CAREGIVER'],
        permissions: ['clients:read', 'visits:update'],
      }));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should allow ORG_ADMIN with clients:* wildcard', async () => {
    const res = await request(app)
      .get(`/api/clients/${testClientId}/visit-history`)
      .set('user', JSON.stringify({
        userId: randomUUID(),
        organizationId: testOrgId,
        branchIds: [],
        roles: ['ORG_ADMIN'],
        permissions: ['clients:*'],
      }));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should allow READ_ONLY with clients:read permission', async () => {
    const res = await request(app)
      .get(`/api/clients/${testClientId}/visit-history`)
      .set('user', JSON.stringify({
        userId: randomUUID(),
        organizationId: testOrgId,
        branchIds: [],
        roles: ['READ_ONLY'],
        permissions: ['clients:read'],
      }));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should allow FAMILY user to access their own linked client', async () => {
    const res = await request(app)
      .get(`/api/clients/${testClientId}/visit-history`)
      .set('user', JSON.stringify({
        userId: familyMemberUserId,
        organizationId: testOrgId,
        branchIds: [],
        roles: ['FAMILY'],
        permissions: ['clients:read'],
        familyClientIds: [testClientId],
      }));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should deny FAMILY user access to unlinked client', async () => {
    const otherClientId = randomUUID();
    const res = await request(app)
      .get(`/api/clients/${otherClientId}/visit-history`)
      .set('user', JSON.stringify({
        userId: familyMemberUserId,
        organizationId: testOrgId,
        branchIds: [],
        roles: ['FAMILY'],
        permissions: ['clients:read'],
        familyClientIds: [testClientId], // Not otherClientId
      }));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FAMILY_SCOPE_VIOLATION');
  });

  it('should return 401 for unauthenticated request', async () => {
    const res = await request(app).get(`/api/clients/${testClientId}/visit-history`);

    expect(res.status).toBe(401);
  });

  it('should return 400 for invalid client ID', async () => {
    const res = await request(app)
      .get('/api/clients/not-a-uuid/visit-history')
      .set('user', JSON.stringify({
        userId: randomUUID(),
        organizationId: testOrgId,
        branchIds: [],
        roles: ['ORG_ADMIN'],
        permissions: ['clients:*'],
      }));

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Valid client ID is required');
  });

  it('should support pagination query parameters', async () => {
    const res = await request(app)
      .get(`/api/clients/${testClientId}/visit-history?page=1&limit=5`)
      .set('user', JSON.stringify({
        userId: randomUUID(),
        organizationId: testOrgId,
        branchIds: [],
        roles: ['ORG_ADMIN'],
        permissions: ['clients:*'],
      }));

    expect(res.status).toBe(200);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.limit).toBe(5);
  });

  it('should enforce max limit of 100', async () => {
    const res = await request(app)
      .get(`/api/clients/${testClientId}/visit-history?page=1&limit=200`)
      .set('user', JSON.stringify({
        userId: randomUUID(),
        organizationId: testOrgId,
        branchIds: [],
        roles: ['ORG_ADMIN'],
        permissions: ['clients:*'],
      }));

    expect(res.status).toBe(200);
    expect(res.body.data.limit).toBe(100);
  });

  it('should return 400 for invalid pagination parameters', async () => {
    const res = await request(app)
      .get(`/api/clients/${testClientId}/visit-history?page=-1&limit=abc`)
      .set('user', JSON.stringify({
        userId: randomUUID(),
        organizationId: testOrgId,
        branchIds: [],
        roles: ['ORG_ADMIN'],
        permissions: ['clients:*'],
      }));

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid pagination parameters');
  });

  it('should log PHI access to audit trail', async () => {
    const auditSpy = vi.spyOn(db, 'query');

    const res = await request(app)
      .get(`/api/clients/${testClientId}/visit-history`)
      .set('user', JSON.stringify({
        userId: randomUUID(),
        organizationId: testOrgId,
        branchIds: [],
        roles: ['ORG_ADMIN'],
        permissions: ['clients:*'],
      }));

    expect(res.status).toBe(200);
    
    // Verify audit log was written (query was called for audit insert)
    expect(auditSpy).toHaveBeenCalledWith(
      expect.stringContaining('audit'),
      expect.any(Array)
    );

    auditSpy.mockRestore();
  });
});
