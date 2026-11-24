import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { Request, Response, Router } from 'express';
import type { Database } from '@folkcare/core';
import { createAuditLogsRouter } from '../audit-logs.js';
import {
  createPhiAccessAuditMiddleware,
  resolvePhiResource,
  mapHttpMethodToAuditAction,
} from '../../middleware/phi-access-audit.js';

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

interface MockRes {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockRes;
  json: (payload: unknown) => MockRes;
}

function makeRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function getRouteHandler(
  router: Router,
  path: string,
  method: 'get'
): (req: Request, res: Response) => Promise<void> {
  const stack = (router as unknown as { stack: Array<{ route?: { path: string; stack: Array<{ method: string; handle: (req: Request, res: Response) => Promise<void> }> } }> }).stack;
  const layer = stack.find(
    (l) => l.route?.path === path && l.route.stack.some((s) => s.method === method)
  );
  if (!layer?.route) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  }
  const routeLayers = layer.route.stack.filter((s) => s.method === method);
  return routeLayers[routeLayers.length - 1]!.handle;
}

describe('GET /api/audit/logs router (E6 / wdvf3adf65)', () => {
  it('forbids caregivers from exporting audit logs (403)', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const router = createAuditLogsRouter({ query } as unknown as Database);
    const handler = getRouteHandler(router, '/logs', 'get');

    const req = {
      user: {
        userId: USER_ID,
        organizationId: ORG_ID,
        roles: ['CAREGIVER'],
        permissions: [],
        branchIds: [],
      },
      query: {},
      headers: {},
      ip: '127.0.0.1',
    } as unknown as Request;
    const res = makeRes();

    await handler(req, res as unknown as Response);
    expect(res.statusCode).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('allows coordinators to query audit logs with filters and audits the access', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] }) // INSERT audit-the-audit
      .mockResolvedValueOnce({ rows: [{ total: '1' }] }) // COUNT
      .mockResolvedValueOnce({
        rows: [
          {
            id: '33333333-3333-3333-3333-333333333333',
            organization_id: ORG_ID,
            user_id: USER_ID,
            resource_type: 'client',
            resource_id: 'client-123',
            action: 'READ',
            timestamp: new Date('2026-11-23T12:00:00.000Z'),
            ip_address: '127.0.0.1',
            user_agent: 'Mozilla/5.0',
            metadata: { phiAccessed: true },
            retention_until: new Date('2033-11-23T12:00:00.000Z'),
          },
        ],
      });

    const router = createAuditLogsRouter({ query } as unknown as Database);
    const handler = getRouteHandler(router, '/logs', 'get');

    const req = {
      user: {
        userId: USER_ID,
        organizationId: ORG_ID,
        roles: ['COORDINATOR'],
        permissions: [],
        branchIds: [],
      },
      query: {
        resourceType: 'client',
        action: 'READ',
      },
      headers: { 'user-agent': 'Vitest/1.0' },
      ip: '127.0.0.1',
    } as unknown as Request;
    const res = makeRes();

    await handler(req, res as unknown as Response);
    expect(res.statusCode).toBe(200);
    expect(query).toHaveBeenCalledTimes(3);
    const body = res.body as { success: boolean; data: { total: number; logs: Array<{ resourceId: string }> } };
    expect(body.success).toBe(true);
    expect(body.data.total).toBe(1);
    expect(body.data.logs[0]?.resourceId).toBe('client-123');
  });

  it('returns 400 for invalid query parameters', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const router = createAuditLogsRouter({ query } as unknown as Database);
    const handler = getRouteHandler(router, '/logs', 'get');

    const req = {
      user: {
        userId: USER_ID,
        organizationId: ORG_ID,
        roles: ['ORG_ADMIN'],
        permissions: [],
        branchIds: [],
      },
      query: { action: 'BOGUS' },
      headers: {},
      ip: '127.0.0.1',
    } as unknown as Request;
    const res = makeRes();

    await handler(req, res as unknown as Response);
    expect(res.statusCode).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('PHI Access Audit Middleware (E6 / wdvf3adf65)', () => {
  it('resolves PHI resources and HTTP methods accurately', () => {
    expect(resolvePhiResource('/api/clients/client-123')).toEqual({
      resourceType: 'client',
      resourceId: 'client-123',
    });
    expect(resolvePhiResource('/api/visits/visit-456/complete')).toEqual({
      resourceType: 'visit',
      resourceId: 'visit-456',
    });
    expect(resolvePhiResource('/api/clients?page=1')).toEqual({
      resourceType: 'client',
      resourceId: 'collection',
    });
    expect(resolvePhiResource('/api/health')).toBeNull();

    expect(mapHttpMethodToAuditAction('GET')).toBe('READ');
    expect(mapHttpMethodToAuditAction('POST')).toBe('WRITE');
    expect(mapHttpMethodToAuditAction('PUT')).toBe('WRITE');
    expect(mapHttpMethodToAuditAction('DELETE')).toBe('DELETE');
  });

  it('logs READ when a coordinator views a client and WRITE when a caregiver completes a visit', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const middleware = createPhiAccessAuditMiddleware({ query } as unknown as Database);

    // 1. Coordinator views client
    const res1 = Object.assign(new EventEmitter(), { statusCode: 200 });
    const req1 = {
      method: 'GET',
      originalUrl: '/api/clients/client-999',
      path: '/api/clients/client-999',
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Chrome/120' },
      user: {
        userId: USER_ID,
        organizationId: ORG_ID,
        roles: ['COORDINATOR'],
        permissions: [],
        branchIds: [],
      },
    } as unknown as Request;

    const next1 = vi.fn();
    middleware(req1, res1 as unknown as Response, next1);
    expect(next1).toHaveBeenCalledTimes(1);
    res1.emit('finish');

    // 2. Caregiver completes visit
    const res2 = Object.assign(new EventEmitter(), { statusCode: 200 });
    const req2 = {
      method: 'POST',
      originalUrl: '/api/visits/visit-777/complete',
      path: '/api/visits/visit-777/complete',
      ip: '127.0.0.1',
      headers: { 'user-agent': 'MobileApp/2.0' },
      user: {
        userId: USER_ID,
        organizationId: ORG_ID,
        roles: ['CAREGIVER'],
        permissions: [],
        branchIds: [],
      },
    } as unknown as Request;

    const next2 = vi.fn();
    middleware(req2, res2 as unknown as Response, next2);
    expect(next2).toHaveBeenCalledTimes(1);
    res2.emit('finish');

    // Allow microtasks to flush
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(query).toHaveBeenCalledTimes(2);
    const [, params1] = query.mock.calls[0] as [string, unknown[]];
    expect(params1[3]).toBe('client');
    expect(params1[4]).toBe('client-999');
    expect(params1[5]).toBe('READ');

    const [, params2] = query.mock.calls[1] as [string, unknown[]];
    expect(params2[3]).toBe('visit');
    expect(params2[4]).toBe('visit-777');
    expect(params2[5]).toBe('WRITE');
  });
});
