/**
 * Audit Events API Routes
 * 
 * HIPAA § 164.312(b) Audit Controls: provides read-only access to immutable audit trail
 * for system activity monitoring and compliance reporting.
 */

import { Router, Request, Response } from 'express';
import { Database, AuthMiddleware, AuditService, PermissionService, PermissionError } from '@folkcare/core';
import type { UserContext } from '@folkcare/core';

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 100;

function parseBoundedInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

interface AuditEventQuery {
  eventType?: string;
  phiOnly?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: string;
  offset?: string;
}

export function createAuditEventsRouter(db: Database): Router {
  const router = Router();
  const authMiddleware = new AuthMiddleware(db);
  const auditService = new AuditService(db);
  const permissionService = new PermissionService();

  /**
   * @openapi
   * /api/audit-events:
   *   get:
   *     tags:
   *       - Audit Events
   *     summary: Get audit events (HIPAA audit log)
   *     description: Retrieve immutable audit trail events for compliance and security monitoring
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: eventType
   *         schema:
   *           type: string
   *           enum: [DATA_ACCESS, DATA_MODIFICATION, AUTHENTICATION, AUTHORIZATION, SECURITY, CONFIGURATION, COMPLIANCE]
   *         description: Filter by event type
   *       - in: query
   *         name: phiOnly
   *         schema:
   *           type: boolean
   *         description: Filter for ePHI access events only
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search in user names, emails, resources, and actions
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Filter events after this timestamp (ISO 8601)
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Filter events before this timestamp (ISO 8601)
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 100
   *           maximum: 1000
   *         description: Maximum number of events to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           default: 0
   *         description: Offset for pagination
   *     responses:
   *       200:
   *         description: Audit events retrieved successfully
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Insufficient permissions
   */
  router.get(
    '/',
    authMiddleware.requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const organizationId = req.user!.organizationId;
        const userId = req.user!.userId;
        const query = req.query as AuditEventQuery;
        const roles = req.user!.roles;

        // Service-layer, wildcard-aware permission check (audit-logs:read).
        // Restricted to SUPER_ADMIN / ORG_ADMIN (and AUDITOR); always org-scoped.
        const actorContext: UserContext = {
          userId,
          organizationId,
          roles,
          permissions: req.user!.permissions,
          branchIds: req.user!.branchIds,
        };
        const allowedRole = roles.some((role) => ['SUPER_ADMIN', 'ORG_ADMIN', 'AUDITOR'].includes(role));
        try {
          if (!allowedRole) {
            throw new PermissionError('Permission denied: audit-logs:read', { userId, permission: 'audit-logs:read' });
          }
          permissionService.requirePermission(actorContext, 'audit-logs:read');
        } catch (permError) {
          if (permError instanceof PermissionError) {
            res.status(403).json({ success: false, error: 'Insufficient permissions' });
            return;
          }
          throw permError;
        }
        const canSeeClientNames = permissionService.hasPermission(actorContext, 'clients:read');

        // Log this audit log access (HIPAA § 164.312(b) - audit the audit)
        await auditService.logEvent(
          actorContext,
          {
            eventType: 'SECURITY',
            resource: 'AuditLog',
            resourceId: 'system-audit-view',
            action: 'VIEW_AUDIT_LOGS',
            result: 'SUCCESS',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            metadata: {
              filters: {
                eventType: query.eventType,
                phiOnly: query.phiOnly,
                search: query.search,
                startDate: query.startDate,
                endDate: query.endDate,
              },
            },
          }
        );

        // Parse query parameters
        const limit = parseBoundedInt(query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
        const offset = parseBoundedInt(query.offset, 0, 0, Number.MAX_SAFE_INTEGER);

        // Build the SQL query
        const conditions: string[] = ['ae.organization_id = $1'];
        const params: (string | number)[] = [organizationId];
        let paramIndex = 2;

        // Event type filter
        if (query.eventType && query.eventType !== 'ALL') {
          conditions.push(`ae.event_type = $${paramIndex}`);
          params.push(query.eventType);
          paramIndex++;
        }

        // Date range filters
        if (query.startDate) {
          conditions.push(`ae.timestamp >= $${paramIndex}`);
          params.push(query.startDate);
          paramIndex++;
        }

        if (query.endDate) {
          conditions.push(`ae.timestamp <= $${paramIndex}`);
          params.push(query.endDate);
          paramIndex++;
        }

        // PHI-only filter: check metadata->>'phiAccessed'
        if (query.phiOnly === 'true') {
          conditions.push(`(ae.event_type = 'DATA_ACCESS' OR ae.metadata->>'phiAccessed' = 'true')`);
        }

        // Search filter: search in user fields, resource, action
        if (query.search && query.search.trim() !== '') {
          const escaped = query.search.toLowerCase().replace(/[%\\_]/g, (c) => `\\${c}`);
          const searchTerm = `%${escaped}%`;
          conditions.push(`(
            LOWER(u.first_name) LIKE $${paramIndex} OR
            LOWER(u.last_name) LIKE $${paramIndex} OR
            LOWER(u.email) LIKE $${paramIndex} OR
            LOWER(ae.resource) LIKE $${paramIndex} OR
            LOWER(ae.action) LIKE $${paramIndex}
          )`);
          params.push(searchTerm);
          paramIndex++;
        }

        const whereClause = conditions.join(' AND ');

        // Count total matching records
        const countQuery = `
          SELECT COUNT(*) as total
          FROM audit_events ae
          LEFT JOIN users u ON ae.user_id = u.id
          WHERE ${whereClause}
        `;
        const countResult = await db.query<{ total: string }>(countQuery, params);
        const total = Number.parseInt(countResult.rows[0]?.total ?? '0', 10);

        // Fetch paginated results
        const dataQuery = `
          SELECT
            ae.event_id,
            ae.timestamp,
            ae.event_type,
            ae.resource,
            ae.resource_id,
            ae.action,
            ae.result,
            ae.metadata,
            ae.ip_address,
            ae.user_agent,
            ae.user_id as user_id,
            u.first_name,
            u.last_name,
            u.email,
            u.roles
          FROM audit_events ae
          LEFT JOIN users u ON ae.user_id = u.id
          WHERE ${whereClause}
          ORDER BY ae.timestamp DESC
          LIMIT $${paramIndex}
          OFFSET $${paramIndex + 1}
        `;
        params.push(limit, offset);

        const result = await db.query(dataQuery, params);

        // Transform the results to match the frontend interface
        const events = result.rows.map((row) => {
          const rawMetadata: unknown = row['metadata'];
          const parsedMetadata: unknown = typeof rawMetadata === 'string' ? JSON.parse(rawMetadata) : rawMetadata;
          const metadata: Record<string, unknown> =
            typeof parsedMetadata === 'object' && parsedMetadata !== null
              ? (parsedMetadata as Record<string, unknown>)
              : {};

          // Extract role - roles can be an array
          const rolesRaw = row['roles'];
          let role = 'USER';
          if (Array.isArray(rolesRaw) && rolesRaw.length > 0) {
            role = String(rolesRaw[0]);
          } else if (typeof rolesRaw === 'string') {
            role = rolesRaw;
          }

          return {
            id: row['event_id'],
            timestamp: row['timestamp'],
            actor: {
              id: row['user_id'],
              name: row['first_name'] != null
                ? `${String(row['first_name'])} ${String(row['last_name'] ?? '')}`.trim()
                : String(row['user_id']),
              email: row['email'] ?? '',
              role,
            },
            action: row['action'],
            eventType: row['event_type'],
            resourceType: row['resource'],
            resourceId: row['resource_id'],
            clientName:
              canSeeClientNames && typeof metadata.clientName === 'string'
                ? metadata.clientName
                : undefined,
            phiAccessed: metadata.phiAccessed === true,
            result: row['result'],
            ipAddress: row['ip_address'] ?? 'N/A',
          };
        });

        res.json({
          success: true,
          data: {
            events,
            total,
            limit,
            offset,
          },
        });
      } catch (error) {
        console.error('[Audit Events] Get audit events error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve audit events',
        });
      }
    }
  );

  /**
   * Records that the audit log was exported (HIPAA § 164.312(b) - audit the audit).
   * The client only offers the download after this row is confirmed written.
   */
  router.post(
    '/export-log',
    authMiddleware.requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const organizationId = req.user!.organizationId;
        const userId = req.user!.userId;
        const roles = req.user!.roles;
        const ctx: UserContext = {
          userId,
          organizationId,
          roles,
          permissions: req.user!.permissions,
          branchIds: req.user!.branchIds,
        };
        const allowedRole = roles.some((role) => ['SUPER_ADMIN', 'ORG_ADMIN', 'AUDITOR'].includes(role));
        if (!allowedRole || !permissionService.hasPermission(ctx, 'audit-logs:read')) {
          res.status(403).json({ success: false, error: 'Insufficient permissions' });
          return;
        }
        const body = (req.body ?? {}) as { rowCount?: unknown; eventType?: unknown; phiOnly?: unknown };
        await auditService.logEvent(ctx, {
          eventType: 'SECURITY',
          resource: 'AuditLog',
          resourceId: 'system-audit-export',
          action: 'EXPORT_AUDIT_LOGS',
          result: 'SUCCESS',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          metadata: {
            rowCount: typeof body.rowCount === 'number' ? body.rowCount : undefined,
            eventType: typeof body.eventType === 'string' ? body.eventType : undefined,
            phiOnly: body.phiOnly === true,
          },
        });
        res.json({ success: true });
      } catch (error) {
        console.error('[Audit Events] Export log error:', error);
        res.status(500).json({ success: false, error: 'Failed to record audit log export' });
      }
    }
  );

  return router;
}
