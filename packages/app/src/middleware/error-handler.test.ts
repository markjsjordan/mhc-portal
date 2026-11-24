import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { errorHandler, type AppError } from './error-handler.js';

function createMockRes(): Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json } as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

describe('errorHandler', () => {
  const originalEnv = process.env['NODE_ENV'];

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env['NODE_ENV'] = originalEnv;
    vi.restoreAllMocks();
  });

  it('includes sanitized details.errors for 4xx ValidationError in production without echoing submitted values', () => {
    process.env['NODE_ENV'] = 'production';
    const err: AppError = new Error('Invalid caregiver data');
    err.statusCode = 400;
    err.details = {
      submittedValue: '0123456789',
      errors: [
        { field: 'primaryPhone.number', message: 'Invalid phone number format', value: '0123456789' },
      ],
    };

    const req = { method: 'POST', path: '/api/caregivers', get: () => 'test-agent', ip: '127.0.0.1' } as unknown as Request;
    const res = createMockRes();

    errorHandler(err, req, res, vi.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0]?.[0];
    expect(body).toEqual({
      success: false,
      error: 'Invalid caregiver data',
      details: {
        errors: [{ field: 'primaryPhone.number', message: 'Invalid phone number format' }],
      },
    });
    expect(JSON.stringify(body)).not.toContain('0123456789');
  });

  it('masks 5xx errors and omits details in production', () => {
    process.env['NODE_ENV'] = 'production';
    const err: AppError = new Error('Database connection string leaked');
    err.statusCode = 500;
    err.details = { errors: [{ field: 'internal', message: 'secret' }] };

    const req = { method: 'GET', path: '/api/caregivers', get: () => 'test-agent', ip: '127.0.0.1' } as unknown as Request;
    const res = createMockRes();

    errorHandler(err, req, res, vi.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'An unexpected error occurred. Please try again later.',
    });
  });

  it('strips stack frames and sensitive file paths from client-facing error messages', () => {
    process.env['NODE_ENV'] = 'production';
    const err: AppError = new Error(
      'Failed to parse upload at /Users/admin/folkcare/packages/app/src/routes/uploads.ts:42\n    at Object.handle (/app/dist/server.js:12:5)'
    );
    err.statusCode = 400;

    const req = { method: 'POST', path: '/api/uploads', get: () => 'test-agent', ip: '127.0.0.1' } as unknown as Request;
    const res = createMockRes();

    errorHandler(err, req, res, vi.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0]?.[0] as { success: boolean; error: string; stack?: unknown };
    expect(body.success).toBe(false);
    expect(body.stack).toBeUndefined();
    expect(body.error).not.toContain('/Users/');
    expect(body.error).not.toContain('/app/dist/');
    expect(body.error).not.toContain('at Object.handle');
    expect(body.error).toContain('[path]');
  });

  it('strips Windows paths and SSNs from validation error items', () => {
    process.env['NODE_ENV'] = 'development';
    const err: AppError = new Error('Validation failed');
    err.statusCode = 422;
    err.details = {
      errors: [
        { field: 'ssn', message: 'Invalid SSN 123-45-6789 in C:\\Users\\ops\\import.csv' },
      ],
    };

    const req = { method: 'POST', path: '/api/clients', get: () => 'test-agent', ip: '127.0.0.1' } as unknown as Request;
    const res = createMockRes();

    errorHandler(err, req, res, vi.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(422);
    const body = res.json.mock.calls[0]?.[0] as { details?: { errors: Array<{ message: string }> } };
    const msg = body.details?.errors[0]?.message ?? '';
    expect(msg).toContain('[SSN-REDACTED]');
    expect(msg).not.toContain('123-45-6789');
    expect(msg).not.toContain('C:\\Users\\');
  });
});
