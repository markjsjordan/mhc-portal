/**
 * Authentication and user context middleware
 *
 * HIPAA-002: Populates req.userContext strictly from verified JWT claims (req.user).
 * Spoofable identity headers (X-User-Id, X-Organization-Id, X-User-Roles, X-User-Permissions)
 * are NEVER trusted outside of test mode (or when ALLOW_TEST_IDENTITY_HEADERS === 'false').
 */

import { Request, Response, NextFunction } from 'express';
import { UserContext, Role, JWTUtils, TokenPayload } from '@folkcare/core';

/**
 * Extend Express Request to include userContext
 */
declare module 'express' {
  interface Request {
    userContext?: UserContext;
  }
}

function isTestHeaderFallbackAllowed(): boolean {
  return (
    process.env['NODE_ENV'] === 'test' &&
    process.env['ALLOW_TEST_IDENTITY_HEADERS'] !== 'false'
  );
}

/**
 * Extract and verify JWT user context, falling back to X-User-* headers ONLY in test mode.
 */
export function authContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // 1. If req.user is already populated, use verified JWT claims
  if (req.user !== undefined) {
    req.userContext = {
      userId: req.user.userId,
      organizationId: req.user.organizationId,
      branchIds: req.user.branchIds,
      roles: req.user.roles,
      permissions: req.user.permissions,
    };
    next();
    return;
  }

  // 2. If Authorization Bearer token is present, verify it and populate context
  const authHeader = (req.headers as Record<string, string | undefined> | undefined)?.['authorization'];

  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token !== '') {
      try {
        const payload: TokenPayload = JWTUtils.verifyAccessToken(token);
        req.userContext = {
          userId: payload.userId,
          organizationId: payload.organizationId,
          branchIds: payload.branchIds,
          roles: payload.roles,
          permissions: payload.permissions,
        };
        next();
        return;
      } catch {
        // Invalid or expired token; do not populate userContext
      }
    }
  }

  // 3. NEVER trust X-User-* headers outside of test mode
  if (!isTestHeaderFallbackAllowed()) {
    req.userContext = undefined;
    next();
    return;
  }

  // Test-only header fallback for existing integration/unit tests
  const userId = req.header('X-User-Id') ?? 'system';
  const organizationIdHeader = req.header('X-Organization-Id');
  // Convert empty string to undefined to prevent UUID validation errors in PostgreSQL
  const organizationId =
    organizationIdHeader !== undefined && organizationIdHeader.trim() !== ''
      ? organizationIdHeader.trim()
      : undefined;
  const branchId = req.header('X-Branch-Id');
  const roles = (req.header('X-User-Roles') ?? 'CAREGIVER').split(',') as Role[];
  const permissions = (req.header('X-User-Permissions') ?? '').split(',').filter(Boolean);

  req.userContext = {
    userId,
    organizationId,
    branchIds: branchId !== undefined && branchId !== '' ? [branchId] : [],
    roles,
    permissions,
  };

  next();
}

/**
 * Require authentication middleware
 * Returns 401 if no valid user context
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.user !== undefined && req.userContext === undefined) {
    req.userContext = {
      userId: req.user.userId,
      organizationId: req.user.organizationId,
      branchIds: req.user.branchIds,
      roles: req.user.roles,
      permissions: req.user.permissions,
    };
  }

  if (req.userContext?.userId === undefined) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return;
  }
  next();
}
