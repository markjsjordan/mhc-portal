/**
 * Centralized error handling middleware
 */

import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  details?: unknown;
  code?: string;
}

/** Postgres SQLSTATE invalid_text_representation (e.g. malformed uuid input). */
const PG_INVALID_TEXT_REPRESENTATION = '22P02';

/**
 * Determine the safe client-facing error message.
 * 4xx: specific message; 5xx: generic in production to avoid information disclosure;
 * pg 22P02: fixed message (driver text contains the submitted value).
 */
function resolveClientMessage(
  err: AppError,
  statusCode: number,
  isInvalidIdentifier: boolean,
  isProduction: boolean
): string {
  if (isInvalidIdentifier) {
    return 'Invalid identifier format';
  }
  if (statusCode >= 400 && statusCode < 500) {
    return err.message.length > 0 ? err.message : 'Invalid request';
  }
  if (isProduction) {
    return 'An unexpected error occurred. Please try again later.';
  }
  return err.message.length > 0 ? err.message : 'Internal server error';
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
  const isInvalidIdentifier =
    err.statusCode === undefined && err.code === PG_INVALID_TEXT_REPRESENTATION;
  const statusCode = isInvalidIdentifier ? 400 : (err.statusCode ?? 500);
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

  const clientMessage = resolveClientMessage(err, statusCode, isInvalidIdentifier, isProduction);

  res.status(statusCode).json({
    success: false,
    error: clientMessage,
    // Only include error details in development and only for client errors
    ...((!isProduction && statusCode < 500) ? {
      details: err.details,
      // Note: Stack traces NEVER sent to client, even in development
      // Use server logs for debugging
    } : {}),
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
