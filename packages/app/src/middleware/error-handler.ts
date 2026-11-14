/**
 * Centralized error handling middleware
 */

import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  details?: unknown;
}

function sanitizeErrorItem(item: unknown): { field: string; message: string } | null {
  if (typeof item === 'string') {
    return item.length > 0 ? { field: '', message: item } : null;
  }
  if (item === null || typeof item !== 'object') {
    return null;
  }
  const record = item as Record<string, unknown>;
  const field = typeof record['field'] === 'string' ? record['field'] : '';
  const message = typeof record['message'] === 'string' ? record['message'] : '';
  return field.length > 0 || message.length > 0 ? { field, message } : null;
}

function sanitizeValidationErrors(details: unknown): Array<{ field: string; message: string }> | undefined {
  if (details === null || typeof details !== 'object') return undefined;
  const rawErrors = (details as { errors?: unknown }).errors;
  if (!Array.isArray(rawErrors)) return undefined;

  const sanitized: Array<{ field: string; message: string }> = [];
  for (const item of rawErrors) {
    const entry = sanitizeErrorItem(item);
    if (entry !== null) {
      sanitized.push(entry);
    }
  }
  return sanitized.length > 0 ? sanitized : undefined;
}

function buildDetailsPayload(
  isProduction: boolean,
  statusCode: number,
  details: unknown
): { details?: unknown } {
  if (statusCode >= 500) return {};
  if (!isProduction) return { details };
  const sanitizedErrors = sanitizeValidationErrors(details);
  return sanitizedErrors !== undefined ? { details: { errors: sanitizedErrors } } : {};
}

/**
 * Global error handler middleware
 * Should be last in middleware chain
 * 
 * Security: Never exposes internal error details, stack traces, or file paths to clients
 * All detailed error information is logged server-side only for debugging
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const isProduction = process.env['NODE_ENV'] === 'production';
  
  // Log full error details server-side for debugging (never sent to client)
  console.error('Error occurred:', {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    statusCode,
    message: err.message,
    stack: err.stack,
    details: err.details,
    // Include request context for debugging
    userAgent: req.get('user-agent'),
    ip: req.ip,
  });

  // Determine safe client-facing error message
  let clientMessage: string;
  
  if (statusCode >= 400 && statusCode < 500) {
    // Client errors (4xx) - safe to send specific message
    clientMessage = err.message.length > 0 ? err.message : 'Invalid request';
  } else {
    // Server errors (5xx) - use generic message to avoid information disclosure
    if (isProduction) {
      clientMessage = 'An unexpected error occurred. Please try again later.';
    } else {
      clientMessage = err.message.length > 0 ? err.message : 'Internal server error';
    }
  }

  res.status(statusCode).json({
    success: false,
    error: clientMessage,
    // In development, include full details for 4xx. In production, include only
    // sanitized { field, message } validation errors (never submitted values/PHI).
    ...buildDetailsPayload(isProduction, statusCode, err.details),
  });
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: 'Resource not found',
  });
}
