/**
 * PHI Access Audit Middleware (E6 / wdvf3adf65)
 *
 * Automatically records an immutable audit_logs entry whenever an authenticated
 * user accesses or modifies client, visit, care-plan, or EVV PHI endpoints.
 * Uses resource_id references only — never logs raw request/response bodies.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { Database, AuditLogService, type AuditLogAction } from '@folkcare/core';

interface PhiRouteRule {
  prefix: string;
  resourceType: string;
}

const PHI_ROUTE_RULES: readonly PhiRouteRule[] = [
  { prefix: '/api/clients', resourceType: 'client' },
  { prefix: '/api/visits', resourceType: 'visit' },
  { prefix: '/api/visit-notes', resourceType: 'visit_note' },
  { prefix: '/api/care-plans', resourceType: 'care_plan' },
  { prefix: '/api/scheduling', resourceType: 'visit' },
  { prefix: '/api/evv', resourceType: 'evv_visit' },
  { prefix: '/api/clinical', resourceType: 'clinical_record' },
];

export function mapHttpMethodToAuditAction(method: string): AuditLogAction {
  const upper = method.toUpperCase();
  if (upper === 'GET' || upper === 'HEAD') {
    return 'READ';
  }
  if (upper === 'DELETE') {
    return 'DELETE';
  }
  return 'WRITE';
}

export function resolvePhiResource(
  path: string
): { resourceType: string; resourceId: string } | null {
  const cleanPath = path.split('?')[0] ?? path;
  for (const rule of PHI_ROUTE_RULES) {
    if (cleanPath === rule.prefix || cleanPath.startsWith(`${rule.prefix}/`)) {
      const remainder = cleanPath.slice(rule.prefix.length).replace(/^\/+/, '');
      const firstSegment = remainder.split('/')[0];
      const resourceId =
        firstSegment !== undefined && firstSegment.length > 0
          ? firstSegment
          : 'collection';
      return { resourceType: rule.resourceType, resourceId };
    }
  }
  return null;
}

export function createPhiAccessAuditMiddleware(db: Database): RequestHandler {
  const auditLogService = new AuditLogService(db);

  return (req: Request, res: Response, next: NextFunction): void => {
    const requestPath = req.originalUrl !== '' ? req.originalUrl : req.path;
    const resolved = resolvePhiResource(requestPath);
    if (resolved === null) {
      next();
      return;
    }

    res.on('finish', () => {
      const user = req.user;
      if (user === undefined) {
        return;
      }

      const action = mapHttpMethodToAuditAction(req.method);
      const userAgentHeader = req.headers['user-agent'];
      const userAgent =
        typeof userAgentHeader === 'string' ? userAgentHeader : undefined;

      void auditLogService
        .logPhiAccess({
          organizationId: user.organizationId,
          userId: user.userId,
          resourceType: resolved.resourceType,
          resourceId: resolved.resourceId,
          action,
          ipAddress: req.ip,
          userAgent,
          metadata: {
            method: req.method.toUpperCase(),
            statusCode: res.statusCode,
          },
        })
        .catch((err: unknown) => {
          console.error('[PHI Audit Middleware] Failed to record audit log:', err);
        });
    });

    next();
  };
}
