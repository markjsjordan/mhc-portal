/**
 * Demo Read-Only Middleware
 *
 * Blocks all write operations (POST, PUT, PATCH, DELETE) for demo accounts.
 * This protects the shared demo database from being modified by public users.
 *
 * Demo accounts are identified by email pattern: *@*.folkcare.example
 */

import type { Request, Response, NextFunction } from 'express';
import { JWTUtils } from '@folkcare/core';

/**
 * Check if an email belongs to a demo account
 */
export function isDemoEmail(email: string | undefined): boolean {
  if (email === undefined || email === '') return false;

  // State-specific demo emails: user@tx.folkcare.example
  if (/@[a-z]{2}\.folkcare\.example$/i.test(email)) {
    return true;
  }

  // Generic demo emails: user@folkcare.example
  if (/@folkcare\.example$/i.test(email)) {
    return true;
  }

  return false;
}

/**
 * Routes that are allowed even for demo users
 * These are either read operations or necessary for app functionality
 */
export const DEMO_WRITABLE_PATHS = [
  // Auth operations
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/auth/me',

  // CSRF token
  '/api/csrf-token',

  // Health checks
  '/api/health',

  // Public signup (for non-demo users creating real accounts)
  '/api/signup',
  '/api/organizations/register',
  '/api/invitations/accept',
];

const ALLOWED_ROUTES = DEMO_WRITABLE_PATHS;

function resolveRequestEmail(req: Request): string | undefined {
  const existingUser = (req as Request & { user?: { email?: string } }).user;
  if (existingUser?.email !== undefined && existingUser.email !== '') {
    return existingUser.email;
  }

  const authHeader =
    typeof req.header === 'function'
      ? req.header('Authorization') ?? req.headers?.['authorization']
      : req.headers?.['authorization'];

  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token !== '') {
      try {
        const payload = JWTUtils.verifyAccessToken(token);
        return payload.email;
      } catch {
        // Ignore invalid token here; route-level auth will reject it
      }
    }
  }

  return undefined;
}

/**
 * Middleware to enforce read-only mode for demo accounts
 */
export function demoReadOnlyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (process.env['DEMO_READ_ONLY'] === 'false') {
    next();
    return;
  }

  const email = resolveRequestEmail(req);

  // If no user or not a demo user, allow all operations
  if (!isDemoEmail(email)) {
    next();
    return;
  }

  // Allow safe methods (GET, HEAD, OPTIONS)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  // Allow specific routes that are necessary for app functionality
  const rawUrl = (req as { originalUrl?: string }).originalUrl;
  const path =
    typeof rawUrl === 'string' && rawUrl !== ''
      ? (rawUrl.split('?')[0] ?? req.path)
      : req.path;

  if (ALLOWED_ROUTES.some((route) => path === route || path.startsWith(route + '/'))) {
    next();
    return;
  }

  // Allow team member invitation management (URL generation, resend, revoke) for demo admins
  if (/^\/api\/organizations\/[^/]+\/invitations(?:\/|$)/.test(path)) {
    next();
    return;
  }

  // Block all other write operations for demo users
  console.warn(`🛡️  Blocked write operation for demo user: ${req.method} ${path} (${email})`);

  res.status(403).json({
    error: 'Demo Mode',
    message: 'This is a read-only demo. Create your own account to make changes.',
    code: 'DEMO_READ_ONLY',
  });
}

/**
 * Export for use in server.ts
 */
export default demoReadOnlyMiddleware;
