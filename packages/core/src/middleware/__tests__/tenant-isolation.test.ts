/**
 * Tenant Isolation Middleware Tests
 * 
 * HIPAA-003: Validates cross-tenant access prevention
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { TenantIsolationMiddleware } from '../tenant-isolation';
import { Database } from '../../db/connection';

// Mock database
vi.mock('../../db/connection');
vi.mock('../../audit/audit-service');

describe('TenantIsolationMiddleware', () => {
  let middleware: TenantIsolationMiddleware;
  let mockDb: Database;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Setup mocks
    statusMock = vi.fn().mockReturnThis();
    jsonMock = vi.fn();

    mockDb = {
      query: vi.fn()
    } as unknown as Database;

    mockRes = {
      status: statusMock as unknown as Response['status'],
      json: jsonMock as unknown as Response['json']
    };

    mockNext = vi.fn();

    mockReq = {
      user: {
        userId: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-456',
        branchIds: ['branch-789'],
        roles: ['CAREGIVER'],
        permissions: ['clients:read'],
        tokenVersion: 1
      },
      params: {},
      headers: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' } as  unknown as Request['socket']
    };

    middleware = new TenantIsolationMiddleware(mockDb);
  });

  describe('validateResourceAccess', () => {
    it('should allow access when resource belongs to user organization', async () => {
      mockReq.params = { id: 'client-123' };
      
      (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ organization_id: 'org-456' }]
      });

      const handler = middleware.validateResourceAccess('client');
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should block access when resource belongs to different organization', async () => {
      mockReq.params = { id: 'client-999' };
      
      (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ organization_id: 'org-DIFFERENT' }]
      });

      const handler = middleware.validateResourceAccess('client');
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'client not found',
        code: 'RESOURCE_NOT_FOUND'
      });
    });

    it('should return 404 when resource does not exist', async () => {
      mockReq.params = { id: 'client-nonexistent' };
      
      (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: []
      });

      const handler = middleware.validateResourceAccess('client');
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'client not found',
        code: 'RESOURCE_NOT_FOUND'
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      mockReq.user = undefined;
      mockReq.params = { id: 'client-123' };

      const handler = middleware.validateResourceAccess('client');
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
    });

    it('should return 400 when resource ID parameter is missing', async () => {
      mockReq.params = {};

      const handler = middleware.validateResourceAccess('client');
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required parameter: id',
        code: 'MISSING_RESOURCE_ID'
      });
    });

    it('should support custom parameter names', async () => {
      mockReq.params = { visitId: 'visit-123' };
      
      (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ organization_id: 'org-456' }]
      });

      const handler = middleware.validateResourceAccess('visit', 'visitId');
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockReq.params = { id: 'client-123' };
      
      (mockDb.query as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database connection failed')
      );

      const handler = middleware.validateResourceAccess('client');
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    });
  });

  describe('validateBulkResourceAccess', () => {
    it('should allow access when all resources belong to user organization', async () => {
      const resourceIds = ['visit-1', 'visit-2', 'visit-3'];
      
      (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [
          { id: 'visit-1', organization_id: 'org-456' },
          { id: 'visit-2', organization_id: 'org-456' },
          { id: 'visit-3', organization_id: 'org-456' }
        ]
      });

      const handler = middleware.validateBulkResourceAccess(
        'visit',
        () => resourceIds
      );
      
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should block access when any resource belongs to different organization', async () => {
      const resourceIds = ['visit-1', 'visit-2', 'visit-3'];
      
      (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [
          { id: 'visit-1', organization_id: 'org-456' },
          { id: 'visit-2', organization_id: 'org-DIFFERENT' },
          { id: 'visit-3', organization_id: 'org-456' }
        ]
      });

      const handler = middleware.validateBulkResourceAccess(
        'visit',
        () => resourceIds
      );
      
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Some resources not found',
        code: 'RESOURCES_NOT_FOUND'
      });
    });

    it('should return 404 when some resources do not exist', async () => {
      const resourceIds = ['visit-1', 'visit-2', 'visit-3'];
      
      (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [
          { id: 'visit-1', organization_id: 'org-456' },
          { id: 'visit-2', organization_id: 'org-456' }
          // visit-3 not found
        ]
      });

      const handler = middleware.validateBulkResourceAccess(
        'visit',
        () => resourceIds
      );
      
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Some resources not found',
        code: 'RESOURCES_NOT_FOUND',
        missingCount: 1
      });
    });

    it('should return 400 when no resource IDs provided', async () => {
      const handler = middleware.validateBulkResourceAccess(
        'visit',
        () => []
      );
      
      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'No resource IDs provided',
        code: 'MISSING_RESOURCE_IDS'
      });
    });
  });

  describe('ensureOrgScope', () => {
    it('should not throw for query with organization_id', () => {
      const query = 'SELECT * FROM clients WHERE organization_id = $1';
      
      expect(() => {
        TenantIsolationMiddleware.ensureOrgScope('org-456', query);
      }).not.toThrow();
    });

    it('should throw for query without organization_id', () => {
      const query = 'SELECT * FROM clients WHERE id = $1';
      
      expect(() => {
        TenantIsolationMiddleware.ensureOrgScope('org-456', query);
      }).toThrow(/HIPAA-003 violation/);
    });
  });
});
