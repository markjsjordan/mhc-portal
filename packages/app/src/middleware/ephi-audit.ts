import type { Request, Response, NextFunction } from 'express';
import { AuditService, Database } from '@folkcare/core';
import type { UserContext } from '@folkcare/core';

const EPHI_ROUTE_PREFIXES = [
  '/api/visit-notes',
  '/api/mobile',
  '/api/evv',
  '/api/billing',
  '/api/payroll',
  '/api/shift-matching',
  '/api/analytics',
  '/api/compliance',
] as const;

function resolveResource(path: string): string {
  const segment = path.replace(/^\/api\//, '').split('/')[0] ?? 'UNKNOWN';
  return segment.toUpperCase().replace(/-/g, '_');
}

/**
 * Middleware that records HIPAA § 164.312(b) audit events for authenticated
 * requests to ePHI-bearing routes that do not otherwise emit per-handler
 * audit records.
 */
export function createEphiAuditMiddleware(db: Database) {
  const auditService = new AuditService(db);

  return (req: Request, res: Response, next: NextFunction): void => {
    const fullPath = req.originalUrl.split('?')[0] ?? req.path;
    const isEphiRoute = EPHI_ROUTE_PREFIXES.some((prefix) => fullPath.startsWith(prefix));
    if (!isEphiRoute) {
      next();
      return;
    }

    res.on('finish', () => {
      const user = (req as Request & { user?: UserContext }).user;
      if (user === undefined || user.userId === '' || user.organizationId === '') {
        return;
      }

      const eventType =
        req.method === 'GET' || req.method === 'HEAD' ? 'DATA_ACCESS' : 'DATA_MODIFICATION';

      void auditService
        .logEvent(user, {
          eventType,
          resource: resolveResource(fullPath),
          resourceId: req.params?.id ?? fullPath,
          action: `${req.method} ${fullPath}`,
          result: res.statusCode < 400 ? 'SUCCESS' : 'FAILURE',
          metadata: {
            phiAccessed: true,
            statusCode: res.statusCode,
            method: req.method,
          },
          ipAddress: req.ip,
          userAgent: typeof req.get === 'function' ? req.get('user-agent') : undefined,
        })
        .catch((err: unknown) => {
          console.error('Failed to record ePHI audit event:', err);
        });
    });

    next();
  };
}
