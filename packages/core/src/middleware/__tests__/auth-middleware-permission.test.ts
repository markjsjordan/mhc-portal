import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { AuthMiddleware } from '../auth-middleware.js';
import type { Database } from '../../db/connection.js';

describe('AuthMiddleware - Permission Resolution with Wildcards', () => {
  let mockDb: Database;
  let authMiddleware: AuthMiddleware;
  let mockAuditService: any;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    } as unknown as Database;

    authMiddleware = new AuthMiddleware(mockDb);
    mockAuditService = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    };
    (authMiddleware as any).auditService = mockAuditService;
  });

  it('allows access for SUPER_ADMIN role possessing *:* wildcard', () => {
    const middleware = authMiddleware.requirePermission(['clients:delete']);

    const req = {
      user: {
        userId: 'admin-1',
        organizationId: 'org-1',
        roles: ['SUPER_ADMIN'],
        permissions: ['*:*'],
        branchIds: [],
      },
      path: '/api/clients/123',
      method: 'DELETE',
      headers: {},
      socket: {},
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(mockAuditService.logEvent).not.toHaveBeenCalled();
  });

  it('allows access for role with resource wildcard (e.g., BRANCH_ADMIN with caregivers:*)', () => {
    const middleware = authMiddleware.requirePermission(['caregivers:delete']);

    const req = {
      user: {
        userId: 'branch-admin-1',
        organizationId: 'org-1',
        roles: ['BRANCH_ADMIN'],
        permissions: ['caregivers:*', 'clients:read'],
        branchIds: ['b1'],
      },
      path: '/api/caregivers/123',
      method: 'DELETE',
      headers: {},
      socket: {},
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(mockAuditService.logEvent).not.toHaveBeenCalled();
  });

  it('allows access when user context has explicit resource wildcard clients:* without role having clients:delete', () => {
    const middleware = authMiddleware.requirePermission(['clients:delete']);

    const req = {
      user: {
        userId: 'user-1',
        organizationId: 'org-1',
        roles: ['CAREGIVER'], // CAREGIVER does not have clients:delete
        permissions: ['clients:*'],
        branchIds: [],
      },
      userContext: {
        userId: 'user-1',
        organizationId: 'org-1',
        roles: ['CAREGIVER'],
        permissions: ['clients:*'],
        branchIds: [],
      },
      path: '/api/clients/123',
      method: 'DELETE',
      headers: {},
      socket: {},
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(mockAuditService.logEvent).not.toHaveBeenCalled();
  });

  it('blocks access with 403 and logs an AUTHORIZATION audit event when permission is missing', () => {
    const middleware = authMiddleware.requirePermission(['billing:create']);

    const req = {
      user: {
        userId: 'user-2',
        organizationId: 'org-1',
        roles: ['READ_ONLY'],
        permissions: ['clients:read', 'reports:read'],
        branchIds: [],
      },
      path: '/api/billing/invoices',
      method: 'POST',
      headers: {
        'user-agent': 'vitest-test-agent',
      },
      ip: '127.0.0.1',
      socket: {},
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    const next = vi.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'INSUFFICIENT_PERMISSIONS',
      })
    );

    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-2',
        organizationId: 'org-1',
      }),
      expect.objectContaining({
        eventType: 'AUTHORIZATION',
        resource: '/api/billing/invoices',
        resourceId: 'user-2',
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        result: 'FAILURE',
        metadata: expect.objectContaining({
          requiredPermissions: ['billing:create'],
          method: 'POST',
          path: '/api/billing/invoices',
        }),
      })
    );
  });
});
