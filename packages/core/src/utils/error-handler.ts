/**
 * Error handling utilities for MHC Portal API
 * Provides standardized error responses and logging
 */

import { Response } from 'express';

export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  statusCode: number;
}

/**
 * Handle application errors with standardized responses
 * @param error - The error object
 * @param res - Express response object
 * @param statusCode - HTTP status code (default: 500)
 */
export function handleError(
  error: unknown,
  res: Response,
  statusCode: number = 500,
): void {
  const errorMsg = error instanceof Error ? error.message : String(error);
  const errorCode = error instanceof Error && 'code' in error ? (error as Record<string, unknown>)['code'] : 'INTERNAL_ERROR';

  const response: ErrorResponse = {
    error: errorCode as string,
    message: errorMsg,
    statusCode,
  };

  // Log error for debugging
  if (statusCode === 500) {
    console.error('Server error:', {
      error,
      message: errorMsg,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  res.status(statusCode).json(response);
}

/**
 * Create a structured error for API responses
 */
export class APIError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = 'APIError';
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
