import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { AuditService } from '@folkcare/core';

interface AuthenticatedUser {
  userId?: string;
  id?: string;
  organizationId?: string;
}

/**
 * Middleware that records HIPAA § 164.312(b) audit_events for authenticated
 * requests to ePHI-bearing routers.
 */
export function auditPhiRouteAccess(
  auditService: AuditService,
  resource: string
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      const user = (req as Request & { user?: AuthenticatedUser }).user;
      const userId = user?.userId ?? user?.id;
      const organizationId = user?.organizationId;
      if (
        userId === undefined ||
        userId === '' ||
        organizationId === undefined ||
        organizationId === ''
      ) {
        return;
      }

      const method = req.method.toUpperCase();
      const eventType =
        method === 'GET' || method === 'HEAD' ? 'DATA_ACCESS' : 'DATA_MODIFICATION';
      const paramId = req.params?.id;
      let resourceId = resource;
      if (typeof paramId === 'string' && paramId !== '') {
        resourceId = paramId;
      } else if (req.path !== '') {
        resourceId = req.path;
      }

      void auditService
        .logEvent(
          {
            userId,
            organizationId,
            roles: [],
            permissions: [],
          } as never,
          {
            eventType,
            resource,
            resourceId,
            action: `${method} ${req.path}`,
            result: res.statusCode < 400 ? 'SUCCESS' : 'FAILURE',
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            metadata: {
              statusCode: res.statusCode,
              method,
              path: req.originalUrl,
            },
          }
        )
        .catch(() => {
          // Best-effort: never crash the response lifecycle on audit write failure
        });
    });

    next();
  };
}
