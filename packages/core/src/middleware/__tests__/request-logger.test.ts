import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../../utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import logger from '../../utils/logger';
import { requestLogger } from '../request-logger';

describe('requestLogger PHI Leakage Prevention (wdvf3adf74)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('strips query parameters containing PHI from logged URLs and never logs req.body', () => {
    const req = {
      method: 'GET',
      url: '/api/clients?q=Jane+Doe&ssn=123-45-6789',
      originalUrl: '/api/clients?q=Jane+Doe&ssn=123-45-6789',
      ip: '127.0.0.1',
      body: { firstName: 'Jane', ssn: '123-45-6789' },
      user: { userId: 'user-1' },
      get: vi.fn().mockReturnValue('test-agent'),
    } as unknown as Request;

    const resEmitter = new EventEmitter();
    const res = Object.assign(resEmitter, {
      statusCode: 200,
    }) as unknown as Response;

    const next: NextFunction = vi.fn();

    requestLogger(req, res, next);
    resEmitter.emit('finish');

    expect(next).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledTimes(2);

    const incomingLog = vi.mocked(logger.info).mock.calls[0]?.[0] as Record<string, unknown>;
    const completedLog = vi.mocked(logger.info).mock.calls[1]?.[0] as Record<string, unknown>;

    expect(incomingLog.url).toBe('/api/clients');
    expect(completedLog.url).toBe('/api/clients');
    expect(JSON.stringify(incomingLog)).not.toContain('Jane');
    expect(JSON.stringify(incomingLog)).not.toContain('123-45-6789');
    expect(incomingLog).not.toHaveProperty('body');
    expect(completedLog).not.toHaveProperty('body');
  });
});
