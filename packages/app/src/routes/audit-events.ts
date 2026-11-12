/**
 * Audit Events API Routes
 * 
 * HIPAA § 164.312(b) Audit Controls: provides read-only access to immutable audit trail
 * for system activity monitoring and compliance reporting.
 */

import { Router, Request, Response } from 'express';
import { Database, AuthMiddleware, AuditService } from '@folkcare/core';

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
    authMiddleware.requireRole(['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN']),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const organizationId = req.user!.organizationId;
        const userId = req.user!.userId;
        const query = req.query as AuditEventQuery;

        // Log this audit log access (HIPAA § 164.312(b) - audit the audit)
        await auditService.logEvent(
          {
            userId,
            organizationId,
            roles: req.user!.roles || [],
            permissions: req.user!.permissions || [],
            branchIds: req.user!.branchIds || [],
          },
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
        const limit = Math.min(
          parseInt(query.limit ?? '100', 10),
          1000
        );
        const offset = parseInt(query.offset ?? '0', 10);

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
          conditions.push(`(ae.metadata->>'phiAccessed')::boolean = true`);
        }

        // Search filter: search in user fields, resource, action
        if (query.search && query.search.trim() !== '') {
          const searchTerm = `%${query.search.toLowerCase()}%`;
          conditions.push(`(
            LOWER(u.first_name) LIKE $${paramIndex} OR
            LOWER(u.last_name) LIKE $${paramIndex} OR
            LOWER(u.email) LIKE $${paramIndex} OR
            LOWER(ae.resource) LIKE $${paramIndex} OR
            LOWER(ae.action) LIKE $${paramIndex} OR
            LOWER(ae.metadata->>'clientName') LIKE $${paramIndex}
          )`);
          params.push(searchTerm);
          paramIndex++;
        }

        const whereClause = conditions.join(' AND ');

        // Count total matching records
        const countQuery = `
          SELECT COUNT(*) as total
          FROM audit_events ae
          JOIN users u ON ae.user_id = u.id
          WHERE ${whereClause}
        `;
        const countResult = await db.query<{ total: string }>(countQuery, params);
        const total = parseInt(countResult.rows[0]?.total ?? '0', 10);

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
            u.id as user_id,
            u.first_name,
            u.last_name,
            u.email,
            u.roles
          FROM audit_events ae
          JOIN users u ON ae.user_id = u.id
          WHERE ${whereClause}
          ORDER BY ae.timestamp DESC
          LIMIT $${paramIndex}
          OFFSET $${paramIndex + 1}
        `;
        params.push(limit, offset);

        const result = await db.query(dataQuery, params);

        // Transform the results to match the frontend interface
        const events = result.rows.map((row) => {
          const metadata = typeof row['metadata'] === 'string' 
            ? JSON.parse(row['metadata'])
            : (row['metadata'] ?? {});

          // Extract role - roles can be an array
          const rolesRaw = row['roles'];
          let role = 'USER';
          if (Array.isArray(rolesRaw) && rolesRaw.length > 0) {
            role = rolesRaw[0];
          } else if (typeof rolesRaw === 'string') {
            role = rolesRaw;
          }

          return {
            id: row['event_id'],
            timestamp: row['timestamp'],
            actor: {
              id: row['user_id'],
              name: `${row['first_name']} ${row['last_name']}`,
              email: row['email'],
              role,
            },
            action: row['action'],
            eventType: row['event_type'],
            resourceType: row['resource'],
            resourceId: row['resource_id'],
            clientName: metadata.clientName,
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

  return router;
}
