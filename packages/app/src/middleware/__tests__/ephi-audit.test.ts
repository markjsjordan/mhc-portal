import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { Request, Response, NextFunction } from 'express';
import { createEphiAuditMiddleware } from '../ephi-audit.js';

const logEventMock = vi.fn(async () => {});

vi.mock('@folkcare/core', () => ({
  AuditService: class {
    logEvent = logEventMock;
  },
}));

describe('createEphiAuditMiddleware', () => {
  beforeEach(() => {
    logEventMock.mockClear();
  });

  it('logs DATA_ACCESS on finish for authenticated ePHI GET routes', () => {
    const middleware = createEphiAuditMiddleware({} as never);
    const req = {
      method: 'GET',
      path: '/api/evv/visits',
      originalUrl: '/api/evv/visits?page=1',
      params: {},
      ip: '127.0.0.1',
      get: () => 'vitest-agent',
      user: { userId: 'u-1', organizationId: 'org-1', role: 'ADMIN' },
    } as unknown as Request;
    const res = new EventEmitter() as unknown as Response & EventEmitter;
    res.statusCode = 200;
    const next: NextFunction = vi.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    res.emit('finish');
    expect(logEventMock).toHaveBeenCalledTimes(1);
    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-1', organizationId: 'org-1' }),
      expect.objectContaining({
        eventType: 'DATA_ACCESS',
        resource: 'EVV',
        action: 'GET /api/evv/visits',
        result: 'SUCCESS',
      })
    );
  });

  it('skips non-ePHI routes', () => {
    const middleware = createEphiAuditMiddleware({} as never);
    const req = {
      method: 'GET',
      path: '/api/health',
      originalUrl: '/api/health',
      user: { userId: 'u-1', organizationId: 'org-1' },
    } as unknown as Request;
    const res = new EventEmitter() as unknown as Response & EventEmitter;
    const next: NextFunction = vi.fn();

    middleware(req, res, next);
    res.emit('finish');
    expect(logEventMock).not.toHaveBeenCalled();
  });
});
