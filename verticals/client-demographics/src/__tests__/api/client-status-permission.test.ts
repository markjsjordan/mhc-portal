/**
 * Permission and validation tests for PATCH /api/clients/:id/status
 *
 * Ticket: wdvf3adqpj - Edit Client manual status dropdown (admin-only)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express, NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { PermissionError, ValidationError } from '@folkcare/core';
import { MANUALLY_SETTABLE_CLIENT_STATUSES } from '../../types/client';

vi.mock('@folkcare/core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@folkcare/core');
  return {
    ...actual,
    AuthMiddleware: vi.fn().mockImplementation(function (this: any) {
      this.requireAuth = (req: any, _res: any, next: any) => {
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

const VALID_CLIENT_ID = '11111111-1111-4111-8111-111111111111';

function buildApp(roles: string[], mockClientService: any): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = {
      userId: `user-${roles[0] ?? 'none'}`,
      organizationId: 'org-1',
      branchIds: ['branch-1'],
      roles,
      permissions: [],
    };
    next();
  });
  app.use('/api', createClientRouter(mockClientService, {} as any));
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode =
      err instanceof PermissionError
        ? 403
        : err instanceof ValidationError
          ? 400
          : err.statusCode || 500;
    res.status(statusCode).json({ success: false, error: err.message });
  });
  return app;
}

describe('Client Status Update Permission & Validation - wdvf3adqpj', () => {
  let mockClientService: { updateClientStatus: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockClientService = {
      updateClientStatus: vi.fn().mockImplementation(async (id: string, status: string) => ({
        id,
        status,
        firstName: 'Jane',
        lastName: 'Doe',
        organizationId: 'org-1',
      })),
    };
  });

  describe('Admin roles succeed on all 5 manually-settable statuses', () => {
    it.each(['SUPER_ADMIN', 'ORG_ADMIN', 'ADMIN', 'BRANCH_ADMIN'])(
      'allows %s to update client status',
      async (role) => {
        const app = buildApp([role], mockClientService);
        for (const status of MANUALLY_SETTABLE_CLIENT_STATUSES) {
          const res = await request(app)
            .patch(`/api/clients/${VALID_CLIENT_ID}/status`)
            .send({ status });

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          expect(res.body.data.status).toBe(status);
        }
        expect(mockClientService.updateClientStatus).toHaveBeenCalledTimes(
          MANUALLY_SETTABLE_CLIENT_STATUSES.length
        );
      }
    );
  });

  describe('Non-admin roles receive 403', () => {
    it.each(['COORDINATOR', 'CAREGIVER', 'SCHEDULER', 'READ_ONLY'])(
      'rejects %s with 403 and does not call service',
      async (role) => {
        const app = buildApp([role], mockClientService);
        const res = await request(app)
          .patch(`/api/clients/${VALID_CLIENT_ID}/status`)
          .send({ status: 'INACTIVE' });

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(mockClientService.updateClientStatus).not.toHaveBeenCalled();
      }
    );
  });

  describe('Status and reason validation', () => {
    it.each([
      ['PENDING_INTAKE', { status: 'PENDING_INTAKE' }],
      ['INQUIRY', { status: 'INQUIRY' }],
      ['invalid value', { status: 'DELETED' }],
      ['omitted status', {}],
      ['non-string reason', { status: 'DISCHARGED', reason: 123 }],
    ])('returns 400 for %s', async (_label, body) => {
      const app = buildApp(['ORG_ADMIN'], mockClientService);
      const res = await request(app)
        .patch(`/api/clients/${VALID_CLIENT_ID}/status`)
        .send(body);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(mockClientService.updateClientStatus).not.toHaveBeenCalled();
    });
  });
});
