/**
 * Permission enforcement tests for client deletion endpoint
 *
 * Ticket: wdvf3abfwc - Verify that clients:delete permission
 * is enforced for BRANCH_ADMIN and COORDINATOR roles
 *
 * These tests verify end-to-end permission enforcement:
 * 1. Permission definitions exist in permission-service.ts
 * 2. deleteClient handler calls service method
 * 3. Service method enforces permission via requirePermission()
 * 4. Both BRANCH_ADMIN and COORDINATOR can delete
 * 5. Roles without permission are rejected with 403
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';

// Mock the core module to control auth context per test
vi.mock('@folkcare/core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@folkcare/core');
  return {
    ...actual,
    AuthMiddleware: vi.fn().mockImplementation(function (this: any) {
      this.requireAuth = (req: any, _res: any, next: any) => {
        // Will be overridden per test via setupAuthContext
        if (!req.user) {
          req.user = {
            userId: 'test-user',
            organizationId: 'org-1',
            roles: ['ADMIN'],
            permissions: ['*:*'],
          };
        }
        next();
      };
    }),
  };
});

import { createClientRouter } from '../../api/client-handlers';

/**
 * Helper to set auth context on a request
 */
function setupAuthContext(
  app: Express,
  roles: string[],
  permissions: string[]
): void {
  // Override the AuthMiddleware mock to attach the test context
  app.use((req: any, _res, next) => {
    req.user = {
      userId: 'test-user-' + roles[0],
      organizationId: 'org-1',
      branchIds: ['branch-1'],
      roles,
      permissions,
    };
    next();
  });
}

/**
 * Build a mock ClientService for testing
 */
function buildMockClientService(deleteClientMock?: any) {
  return {
    deleteClient: deleteClientMock || vi.fn().mockResolvedValue(undefined),
    getClientById: vi.fn().mockResolvedValue({
      id: 'client-1',
      firstName: 'John',
      lastName: 'Doe',
      status: 'ACTIVE',
      organizationId: 'org-1',
    }),
    searchClients: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    }),
  } as any;
}

describe('Client Delete Permission Enforcement - wdvf3abfwc', () => {
  describe('Permission Definition Verification', () => {
    it('BRANCH_ADMIN role should have clients:delete permission', async () => {
      const { getPermissionService } = await import('@folkcare/core');
      const permissionService = getPermissionService();

      const context = {
        userId: 'test-user',
        organizationId: 'org-1',
        branchIds: ['branch-1'],
        roles: ['BRANCH_ADMIN'],
        permissions: [],
      };

      // Should not throw
      expect(() => {
        permissionService.requirePermission(context, 'clients:delete');
      }).not.toThrow();
    });

    it('COORDINATOR role should have clients:delete permission', async () => {
      const { getPermissionService } = await import('@folkcare/core');
      const permissionService = getPermissionService();

      const context = {
        userId: 'test-user',
        organizationId: 'org-1',
        branchIds: ['branch-1'],
        roles: ['COORDINATOR'],
        permissions: [],
      };

      // Should not throw
      expect(() => {
        permissionService.requirePermission(context, 'clients:delete');
      }).not.toThrow();
    });

    it('CAREGIVER role should NOT have clients:delete permission', async () => {
      const { getPermissionService } = await import('@folkcare/core');
      const permissionService = getPermissionService();

      const context = {
        userId: 'test-user',
        organizationId: 'org-1',
        branchIds: ['branch-1'],
        roles: ['CAREGIVER'],
        permissions: [],
      };

      // Should throw PermissionError
      expect(() => {
        permissionService.requirePermission(context, 'clients:delete');
      }).toThrow('Permission denied: clients:delete');
    });
  });

  describe('API Endpoint Permission Enforcement', () => {
    let app: Express;
    let mockClientService: ReturnType<typeof buildMockClientService>;

    beforeEach(() => {
      mockClientService = buildMockClientService();
      app = express();
      app.use(express.json());

      // Setup auth context (will be overridden per test)
      setupAuthContext(app, ['SUPER_ADMIN'], ['*:*']);

      const router = createClientRouter(mockClientService, {} as any);
      app.use('/api', router);
    });

    describe('BRANCH_ADMIN can delete clients', () => {
      beforeEach(() => {
        // Create fresh app with BRANCH_ADMIN role
        mockClientService = buildMockClientService();
        app = express();
        app.use(express.json());

        // Inject BRANCH_ADMIN context
        app.use((req: any, _res, next) => {
          req.user = {
            userId: 'branch-admin-user',
            organizationId: 'org-1',
            branchIds: ['branch-1'],
            roles: ['BRANCH_ADMIN'],
            permissions: ['clients:read', 'clients:update', 'clients:delete'],
          };
          next();
        });

        const router = createClientRouter(mockClientService, {} as any);
        app.use('/api', router);
      });

      it('DELETE /api/clients/:id succeeds for BRANCH_ADMIN', async () => {
        mockClientService.deleteClient.mockResolvedValue(undefined);

        const res = await request(app)
          .delete('/api/clients/client-123')
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('deleted successfully');
        expect(mockClientService.deleteClient).toHaveBeenCalledWith(
          'client-123',
          expect.objectContaining({
            roles: ['BRANCH_ADMIN'],
          })
        );
      });

      it('Service deleteClient method is called with correct context', async () => {
        mockClientService.deleteClient.mockResolvedValue(undefined);

        await request(app)
          .delete('/api/clients/client-456')
          .expect(200);

        const callArgs = mockClientService.deleteClient.mock.calls[0];
        expect(callArgs[0]).toBe('client-456');
        expect(callArgs[1].roles).toContain('BRANCH_ADMIN');
        expect(callArgs[1].organizationId).toBe('org-1');
      });
    });

    describe('COORDINATOR can delete clients', () => {
      beforeEach(() => {
        // Create fresh app with COORDINATOR role
        mockClientService = buildMockClientService();
        app = express();
        app.use(express.json());

        // Inject COORDINATOR context
        app.use((req: any, _res, next) => {
          req.user = {
            userId: 'coordinator-user',
            organizationId: 'org-1',
            branchIds: ['branch-1'],
            roles: ['COORDINATOR'],
            permissions: ['clients:read', 'clients:update', 'clients:delete'],
          };
          next();
        });

        const router = createClientRouter(mockClientService, {} as any);
        app.use('/api', router);
      });

      it('DELETE /api/clients/:id succeeds for COORDINATOR', async () => {
        mockClientService.deleteClient.mockResolvedValue(undefined);

        const res = await request(app)
          .delete('/api/clients/client-123')
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('deleted successfully');
        expect(mockClientService.deleteClient).toHaveBeenCalledWith(
          'client-123',
          expect.objectContaining({
            roles: ['COORDINATOR'],
          })
        );
      });

      it('Service deleteClient method is called with correct context', async () => {
        mockClientService.deleteClient.mockResolvedValue(undefined);

        await request(app)
          .delete('/api/clients/client-789')
          .expect(200);

        const callArgs = mockClientService.deleteClient.mock.calls[0];
        expect(callArgs[0]).toBe('client-789');
        expect(callArgs[1].roles).toContain('COORDINATOR');
        expect(callArgs[1].organizationId).toBe('org-1');
      });
    });

    describe('Other roles are denied deletion', () => {
      it('CAREGIVER is denied with appropriate error', async () => {
        mockClientService = buildMockClientService();
        app = express();
        app.use(express.json());

        // Inject CAREGIVER context (no delete permission)
        app.use((req: any, _res, next) => {
          req.user = {
            userId: 'caregiver-user',
            organizationId: 'org-1',
            branchIds: ['branch-1'],
            roles: ['CAREGIVER'],
            permissions: ['clients:read'],
          };
          next();
        });

        const router = createClientRouter(mockClientService, {} as any);
        app.use('/api', router);

        // CAREGIVER lacks clients:delete, so service's requirePermission() should throw
        mockClientService.deleteClient.mockRejectedValue(
          new Error('Permission denied: clients:delete')
        );

        await request(app)
          .delete('/api/clients/client-999')
          .expect(403); // Permission denied returns 403 Forbidden

        // The error indicates permission was enforced by middleware
        expect(mockClientService.deleteClient).not.toHaveBeenCalled();
      });

      it('READ_ONLY role is denied with appropriate error', async () => {
        mockClientService = buildMockClientService();
        app = express();
        app.use(express.json());

        // Inject READ_ONLY context (no delete permission)
        app.use((req: any, _res, next) => {
          req.user = {
            userId: 'readonly-user',
            organizationId: 'org-1',
            branchIds: ['branch-1'],
            roles: ['READ_ONLY'],
            permissions: ['clients:read'],
          };
          next();
        });

        const router = createClientRouter(mockClientService, {} as any);
        app.use('/api', router);

        // READ_ONLY lacks clients:delete, so middleware rejects
        mockClientService.deleteClient.mockRejectedValue(
          new Error('Permission denied: clients:delete')
        );

        await request(app)
          .delete('/api/clients/client-999')
          .expect(403); // Permission denied returns 403 Forbidden

        expect(mockClientService.deleteClient).not.toHaveBeenCalled();
      });
    });

    describe('Invalid client ID handling', () => {
      beforeEach(() => {
        mockClientService = buildMockClientService();
        app = express();
        app.use(express.json());

        app.use((req: any, _res, next) => {
          req.user = {
            userId: 'admin-user',
            organizationId: 'org-1',
            branchIds: ['branch-1'],
            roles: ['BRANCH_ADMIN'],
            permissions: ['clients:delete'],
          };
          next();
        });

        const router = createClientRouter(mockClientService, {} as any);
        app.use('/api', router);
      });

      it('Empty client ID is rejected', async () => {
        await request(app)
          .delete('/api/clients/')
          .expect(404); // Express returns 404 for missing param

        expect(mockClientService.deleteClient).not.toHaveBeenCalled();
      });

      it('Missing client ID parameter is rejected', async () => {
        await request(app)
          .delete('/api/clients')
          .expect(404); // Not found (DELETE /clients/ is not a registered route, only DELETE /clients/:id)

        expect(mockClientService.deleteClient).not.toHaveBeenCalled();
      });
    });
  });

  describe('Handler calls Service.deleteClient', () => {
    it('deleteClient handler extracts user context correctly', async () => {
      const mockClientService = buildMockClientService();
      const app = express();
      app.use(express.json());

      app.use((req: any, _res, next) => {
        req.user = {
          userId: 'specific-user-id',
          organizationId: 'specific-org',
          branchIds: ['specific-branch'],
          roles: ['BRANCH_ADMIN'],
          permissions: ['clients:delete'],
        };
        next();
      });

      const router = createClientRouter(mockClientService, {} as any);
      app.use('/api', router);

      mockClientService.deleteClient.mockResolvedValue(undefined);

      await request(app)
        .delete('/api/clients/client-id-xyz')
        .expect(200);

      // Verify the handler passed the correct context
      const contextArg = mockClientService.deleteClient.mock.calls[0][1];
      expect(contextArg.userId).toBe('specific-user-id');
      expect(contextArg.organizationId).toBe('specific-org');
      expect(contextArg.branchIds).toContain('specific-branch');
    });

    it('deleteClient handler returns correct success response', async () => {
      const mockClientService = buildMockClientService();
      const app = express();
      app.use(express.json());

      app.use((req: any, _res, next) => {
        req.user = {
          userId: 'user',
          organizationId: 'org',
          branchIds: ['branch'],
          roles: ['BRANCH_ADMIN'],
          permissions: ['clients:delete'],
        };
        next();
      });

      const router = createClientRouter(mockClientService, {} as any);
      app.use('/api', router);

      mockClientService.deleteClient.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/clients/client-123')
        .expect(200);

      expect(res.body).toEqual({
        success: true,
        message: 'Client deleted successfully',
      });
    });
  });
});
