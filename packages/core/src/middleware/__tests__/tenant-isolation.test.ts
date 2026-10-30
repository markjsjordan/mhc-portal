/**
 * HIPAA-003: Validates cross-tenant access prevention
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { TenantIsolationMiddleware } from '../tenant-isolation';
import { TokenPayload } from '../../utils/jwt-utils';

// Extend Request type for testing
interface TestRequest extends Partial<Request> {
  user?: TokenPayload;
  params?: Record<string, string>;
  body?: any;
}

describe('TenantIsolationMiddleware', () => {
  let middleware: TenantIsolationMiddleware;
  let mockDb: any;
  let mockAuditService: any;
  let mockReq: TestRequest;
  let mockRes: Partial<Response>;
  let mockNext: any;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    };

    mockAuditService = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    };

    middleware = new TenantIsolationMiddleware(mockDb, mockAuditService);

    mockReq = {
      user: {
        userId: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
        branchIds: ['branch-1'],
        roles: ['admin'],
        permissions: [],
        tokenVersion: 1,
      },
      params: {},
      body: {},
      method: 'GET',
      path: '/api/clients/client-123',
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('Mozilla/5.0'),
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe('validateResourceAccess', () => {
    it('should allow access when resource belongs to user organization', async () => {
      mockReq.params = { id: 'client-123' };
      mockDb.query.mockResolvedValue({
        rows: [{ organization_id: 'org-123' }],
      });

      const handler = middleware.validateResourceAccess('client');
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT organization_id FROM clients'),
        ['client-123']
      );
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block access when resource belongs to different organization', async () => {
      mockReq.params = { id: 'client-999' };
      mockDb.query.mockResolvedValue({
        rows: [{ organization_id: 'org-456' }],
      });

      const handler = middleware.validateResourceAccess('client');
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          organizationId: 'org-123',
        }),
        expect.objectContaining({
          action: 'CROSS_TENANT_ACCESS_ATTEMPT',
          result: 'FAILURE',
          metadata: expect.objectContaining({
            severity: 'HIGH',
          }),
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'client not found',
        code: 'RESOURCE_NOT_FOUND',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 404 when resource does not exist', async () => {
      mockReq.params = { id: 'client-nonexistent' };
      mockDb.query.mockResolvedValue({
        rows: [],
      });

      const handler = middleware.validateResourceAccess('client');
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'client not found',
        code: 'RESOURCE_NOT_FOUND',
      });
      expect(mockAuditService.logEvent).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when user is not authenticated', async () => {
      mockReq.user = undefined;
      mockReq.params = { id: 'client-123' };

      const handler = middleware.validateResourceAccess('client');
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
      expect(mockDb.query).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when resource ID parameter is missing', async () => {
      mockReq.params = {};

      const handler = middleware.validateResourceAccess('client');
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing id parameter',
        code: 'MISSING_PARAMETER',
      });
      expect(mockDb.query).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should support custom parameter names', async () => {
      mockReq.params = { visitId: 'visit-123' };
      mockDb.query.mockResolvedValue({
        rows: [{ organization_id: 'org-123' }],
      });

      const handler = middleware.validateResourceAccess('visit', 'visitId');
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT organization_id FROM visits'),
        ['visit-123']
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockReq.params = { id: 'client-123' };
      const dbError = new Error('Database connection failed');
      mockDb.query.mockRejectedValue(dbError);

      const handler = middleware.validateResourceAccess('client');
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });

  describe('validateBulkResourceAccess', () => {
    it('should allow access when all resources belong to user organization', async () => {
      mockReq.body = { visitIds: ['visit-1', 'visit-2', 'visit-3'] };
      mockDb.query.mockResolvedValue({
        rows: [
          { id: 'visit-1', organization_id: 'org-123' },
          { id: 'visit-2', organization_id: 'org-123' },
          { id: 'visit-3', organization_id: 'org-123' },
        ],
      });

      const handler = middleware.validateBulkResourceAccess(
        'visit',
        (req) => req.body.visitIds
      );
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block access when any resource belongs to different organization', async () => {
      mockReq.body = { visitIds: ['visit-1', 'visit-2', 'visit-3'] };
      mockDb.query.mockResolvedValue({
        rows: [
          { id: 'visit-1', organization_id: 'org-123' },
          { id: 'visit-2', organization_id: 'org-456' },
          { id: 'visit-3', organization_id: 'org-123' },
        ],
      });

      const handler = middleware.validateBulkResourceAccess(
        'visit',
        (req) => req.body.visitIds
      );
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAuditService.logEvent).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 404 when not all IDs are found', async () => {
      mockReq.body = { ids: ['caregiver-1', 'caregiver-2', 'caregiver-3'] };
      mockDb.query.mockResolvedValue({
        rows: [
          { id: 'caregiver-1', organization_id: 'org-123' },
          { id: 'caregiver-2', organization_id: 'org-123' },
        ],
      });

      const handler = middleware.validateBulkResourceAccess(
        'caregiver',
        (req) => req.body.ids
      );
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when no IDs provided', async () => {
      mockReq.body = { ids: [] };

      const handler = middleware.validateBulkResourceAccess(
        'caregiver',
        (req) => req.body.ids
      );
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'No resource IDs provided',
        code: 'MISSING_IDS',
      });
    });
  });

  describe('ensureOrgScope', () => {
    it('should pass when query includes organization_id', () => {
      const query = 'SELECT * FROM clients WHERE organization_id = $1';
      
      expect(() => {
        TenantIsolationMiddleware.ensureOrgScope(query);
      }).not.toThrow();
    });

    it('should throw when query missing organization_id', () => {
      const query = 'SELECT * FROM clients WHERE id = $1';
      
      expect(() => {
        TenantIsolationMiddleware.ensureOrgScope(query);
      }).toThrow(/HIPAA-003 violation/);
    });
  });
});
