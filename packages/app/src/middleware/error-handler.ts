/**
 * Centralized error handling middleware
 */

import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
const UNIX_SENSITIVE_PATH_PATTERN =
  /\/(?:Users|home|var|app|opt|etc|srv|root|tmp|private|workspace|vercel)\/[^\s"'),:\]}]+/g;
const WINDOWS_PATH_PATTERN = /\b[A-Za-z]:\\[^\s"'),:\]}]+/g;

function scrubPhiText(text: string): string {
  return text.replace(SSN_PATTERN, '[SSN-REDACTED]');
}

export function sanitizeClientErrorText(text: string): string {
  const withoutPhi = scrubPhiText(text);
  const withoutStack = withoutPhi
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('at '))
    .join('\n');
  const withoutPaths = withoutStack
    .replace(UNIX_SENSITIVE_PATH_PATTERN, '[path]')
    .replace(WINDOWS_PATH_PATTERN, '[path]');
  return withoutPaths.trim();
}

function sanitizeErrorItem(item: unknown): { field: string; message: string } | null {
  if (typeof item === 'string') {
    const cleaned = sanitizeClientErrorText(item);
    return cleaned.length > 0 ? { field: '', message: cleaned } : null;
  }
  if (item === null || typeof item !== 'object') {
    return null;
  }
  const record = item as Record<string, unknown>;
  const field = typeof record['field'] === 'string' ? record['field'] : '';
  const message =
    typeof record['message'] === 'string' ? sanitizeClientErrorText(record['message']) : '';
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
  _isProduction: boolean,
  statusCode: number,
  details: unknown
): { details?: unknown } {
  if (statusCode >= 500) return {};
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
function resolveClientMessage(
  err: AppError,
  statusCode: number,
  isProduction: boolean,
  isPgInvalidTextRepresentation: boolean
): string {
  if (statusCode >= 400 && statusCode < 500) {
    if (isPgInvalidTextRepresentation) {
      return 'Invalid identifier format';
    }
    const sanitized = sanitizeClientErrorText(err.message);
    return sanitized.length > 0 ? sanitized : 'Invalid request';
  }
  if (isProduction) {
    return 'An unexpected error occurred. Please try again later.';
  }
  const sanitized = sanitizeClientErrorText(err.message);
  return sanitized.length > 0 ? sanitized : 'Internal server error';
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isPgInvalidTextRepresentation = err.code === '22P02';
  const statusCode = isPgInvalidTextRepresentation ? 400 : (err.statusCode ?? 500);
  const isProduction = process.env['NODE_ENV'] === 'production';
  const sanitizedDetails = sanitizeValidationErrors(err.details);
  
  // Log sanitized error details server-side for debugging (never sent to client, no raw PHI)
  console.error('Error occurred:', {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    statusCode,
    message: scrubPhiText(err.message),
    stack: err.stack !== undefined ? scrubPhiText(err.stack) : undefined,
    details: sanitizedDetails,
    // Include request context for debugging
    userAgent: req.get('user-agent'),
    ip: req.ip,
  });

  // Determine safe client-facing error message
  const clientMessage = resolveClientMessage(
    err,
    statusCode,
    isProduction,
    isPgInvalidTextRepresentation
  );

  res.status(statusCode).json({
    success: false,
    error: clientMessage,
    // Include only sanitized { field, message } validation errors (never submitted values/PHI).
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
