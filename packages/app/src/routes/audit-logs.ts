/**
 * Audit Logs API Routes (E6 / wdvf3adf65)
 *
 * Exposes `GET /api/audit/logs` for coordinators and admins to query and
 * export immutable HIPAA audit logs by date range, user, resource type,
 * and action (READ / WRITE / DELETE).
 */

import { Router, type Request, type Response } from 'express';
import {
  Database,
  AuthMiddleware,
  AuditLogService,
  AuditLogQuerySchema,
} from '@folkcare/core';

const ALLOWED_AUDIT_ROLES = new Set([
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'COORDINATOR',
  'CARE_COORDINATOR',
  'AUDITOR',
]);

export function createAuditLogsRouter(db: Database): Router {
  const router = Router();
  const authMiddleware = new AuthMiddleware(db);
  const auditLogService = new AuditLogService(db);

  router.get(
    '/logs',
    authMiddleware.requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const user = req.user!;
        const hasAllowedRole = user.roles.some((role) =>
          ALLOWED_AUDIT_ROLES.has(role)
        );

        if (!hasAllowedRole) {
          res.status(403).json({
            success: false,
            error: 'Insufficient permissions: coordinators and admins only',
          });
          return;
        }

        const parsedQuery = AuditLogQuerySchema.safeParse(req.query);
        if (!parsedQuery.success) {
          res.status(400).json({
            success: false,
            error: 'Invalid audit log query parameters',
            details: parsedQuery.error.flatten().fieldErrors,
          });
          return;
        }

        const userAgentHeader = req.headers['user-agent'];
        const userAgent =
          typeof userAgentHeader === 'string' ? userAgentHeader : undefined;

        // Audit-the-audit (HIPAA § 164.312(b))
        await auditLogService.record({
          organizationId: user.organizationId,
          userId: user.userId,
          resourceType: 'audit_log',
          resourceId: 'query',
          action: 'READ',
          ipAddress: req.ip,
          userAgent,
          metadata: {
            filters: {
              startDate: parsedQuery.data.startDate,
              endDate: parsedQuery.data.endDate,
              userId: parsedQuery.data.userId,
              resourceType: parsedQuery.data.resourceType,
              action: parsedQuery.data.action,
            },
          },
        });

        const result = await auditLogService.queryLogs(
          user.organizationId,
          parsedQuery.data
        );

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        console.error('[Audit Logs] Failed to query audit logs:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve audit logs',
        });
      }
    }
  );

  return router;
}
