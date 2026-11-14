import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { auditPhiRouteAccess } from '../audit-phi-middleware.js';

describe('auditPhiRouteAccess', () => {
  it('logs DATA_ACCESS on GET finish when user is authenticated', () => {
    const logEvent = vi.fn(async () => {});
    const mw = auditPhiRouteAccess({ logEvent } as never, 'evv');

    const req = {
      method: 'GET',
      path: '/visits/123',
      originalUrl: '/api/evv/visits/123',
      params: { id: '123' },
      ip: '127.0.0.1',
      get: () => 'vitest',
      user: { userId: 'user-1', organizationId: 'org-1' },
    } as never;

    const res = new EventEmitter() as EventEmitter & { statusCode: number };
    res.statusCode = 200;
    const next = vi.fn();

    mw(req, res as never, next);
    expect(next).toHaveBeenCalledOnce();

    res.emit('finish');
    expect(logEvent).toHaveBeenCalledWith(
      { userId: 'user-1', organizationId: 'org-1', roles: [], permissions: [] },
      expect.objectContaining({
        eventType: 'DATA_ACCESS',
        resource: 'evv',
        resourceId: '123',
        action: 'GET /visits/123',
        result: 'SUCCESS',
      })
    );
  });

  it('skips logging when user is unauthenticated', () => {
    const logEvent = vi.fn(async () => {});
    const mw = auditPhiRouteAccess({ logEvent } as never, 'billing');

    const req = {
      method: 'POST',
      path: '/claims',
      originalUrl: '/api/billing/claims',
      params: {},
      get: () => 'vitest',
    } as never;

    const res = new EventEmitter() as EventEmitter & { statusCode: number };
    res.statusCode = 401;
    const next = vi.fn();

    mw(req, res as never, next);
    res.emit('finish');
    expect(logEvent).not.toHaveBeenCalled();
  });
});
