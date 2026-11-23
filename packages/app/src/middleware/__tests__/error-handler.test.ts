/**
 * Tests for error handling middleware
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { errorHandler, notFoundHandler, type AppError } from '../error-handler.js';

describe('errorHandler', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/test',
      get: vi.fn((header: string): string | undefined => {
        if (header === 'user-agent') return 'test-agent';
        return undefined;
      }) as Request['get'],
      ip: '127.0.0.1',
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    mockNext = vi.fn();

    // Spy on console.error
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should handle 400-level client errors with specific message and sanitized details', () => {
    const err: AppError = {
      name: 'ValidationError',
      message: 'Invalid input',
      statusCode: 400,
      details: { errors: [{ field: 'email', message: 'Invalid format', value: 'jane@example.com' }] },
    };

    errorHandler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid input',
      details: { errors: [{ field: 'email', message: 'Invalid format' }] },
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('never leaks raw PHI details or SSNs in error responses or logs (wdvf3adf74)', () => {
    const err: AppError = {
      name: 'ValidationError',
      message: 'Failed for SSN 123-45-6789',
      statusCode: 400,
      stack: 'Error: Failed for SSN 123-45-6789\n    at handler.ts:10',
      details: {
        address: { line1: '123 Main St' },
        ssn: '123-45-6789',
      },
    };

    errorHandler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    const jsonPayload = vi.mocked(mockRes.json!).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(jsonPayload.error).toBe('Failed for SSN [SSN-REDACTED]');
    expect(jsonPayload.details).toBeUndefined();
    expect(jsonPayload.stack).toBeUndefined();
    expect(JSON.stringify(jsonPayload)).not.toContain('123 Main St');
    expect(JSON.stringify(jsonPayload)).not.toContain('123-45-6789');

    const loggedPayload = consoleErrorSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(JSON.stringify(loggedPayload)).not.toContain('123-45-6789');
    expect(JSON.stringify(loggedPayload)).not.toContain('123 Main St');
  });

  it('should handle 500-level server errors with generic message in production', () => {
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';

    const err: AppError = {
      name: 'DatabaseError',
      message: 'Connection failed to db.internal.server',
      statusCode: 500,
    };

    errorHandler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'An unexpected error occurred. Please try again later.',
    });

    process.env['NODE_ENV'] = originalEnv;
  });

  it('should handle 500-level server errors with specific message in development', () => {
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'development';

    const err: AppError = {
      name: 'DatabaseError',
      message: 'Connection failed',
      statusCode: 500,
    };

    errorHandler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Connection failed',
    });

    process.env['NODE_ENV'] = originalEnv;
  });

  it('should default to 500 status code when not specified', () => {
    const err: AppError = {
      name: 'Error',
      message: 'Something went wrong',
    };

    errorHandler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it('should use default error message for empty message', () => {
    const err: AppError = {
      name: 'Error',
      message: '',
      statusCode: 400,
    };

    errorHandler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Invalid request',
      })
    );
  });

  it('should log sanitized error details server-side', () => {
    const err: AppError = {
      name: 'TestError',
      message: 'Test error message',
      statusCode: 400,
      stack: 'Error stack trace',
      details: { errors: [{ field: 'status', message: 'Invalid' }] },
    };

    errorHandler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error occurred:',
      expect.objectContaining({
        method: 'GET',
        path: '/test',
        statusCode: 400,
        message: 'Test error message',
        stack: 'Error stack trace',
        details: [{ field: 'status', message: 'Invalid' }],
        userAgent: 'test-agent',
        ip: '127.0.0.1',
      })
    );
  });

  it('should not include details in production for server errors', () => {
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';

    const err: AppError = {
      name: 'Error',
      message: 'Server error',
      statusCode: 500,
      details: { sensitive: 'data' },
    };

    errorHandler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'An unexpected error occurred. Please try again later.',
    });

    process.env['NODE_ENV'] = originalEnv;
  });

  it('should map pg 22P02 invalid_text_representation error to 400', () => {
    const err: AppError = {
      name: 'DatabaseError',
      message: 'invalid input syntax for type uuid: "cg-201"',
      code: '22P02',
    };

    errorHandler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Invalid identifier format',
      })
    );
  });
});

describe('notFoundHandler', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  it('should return 404 with appropriate message', () => {
    notFoundHandler(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Resource not found',
    });
  });
});
