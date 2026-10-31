/**
 * HIPAA-003: Tenant Isolation Middleware
 * HIPAA-003: Prevents cross-tenant data access (IDOR vulnerabilities)
 * 
 * Validates that users can only access resources belonging to their organization
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Database } from '../db/connection';
import { AuditService, CreateAuditEvent } from '../audit/audit-service';
import { UserContext } from '../types/base';

// Resource type to table mapping
const RESOURCE_TABLE_MAP: Record<string, string> = {
  client: 'clients',
  caregiver: 'caregivers',
  visit: 'visits',
  schedule: 'schedules',
  staff: 'staff',
  user: 'users',
  branch: 'branches',
  invoice: 'invoices',
  payment: 'payments',
  document: 'documents',
  note: 'notes',
  assessment: 'assessments',
  care_plan: 'care_plans',
  task: 'tasks',
  medication: 'medications',
  contact: 'emergency_contacts',
  authorization: 'authorizations',
  lab_result: 'lab_results',
  vital_sign: 'vital_signs',
};

export type ResourceType = keyof typeof RESOURCE_TABLE_MAP;

interface DbRow {
  id: string;
  organization_id: string;
}

export class TenantIsolationMiddleware {
  constructor(
    private db: Database,
    private auditService?: AuditService
  ) {}

  /**
   * Validate that a single resource belongs to the user's organization
   * @param resourceType - Type of resource to validate
   * @param paramName - Parameter name (defaults to 'id')
   * @returns Express middleware
   */
  validateResourceAccess(
    resourceType: ResourceType,
    paramName: string = 'id'
  ): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Check authentication
        const user = req.user;
        if (user?.organizationId === undefined) {
          res.status(401).json({
            success: false,
            error: 'Unauthorized',
            code: 'UNAUTHORIZED',
          });
          return;
        }

        // Get resource ID from params
         
        const params = req.params as Record<string, string>;
        // eslint-disable-next-line security/detect-object-injection
        const resourceId = params[paramName];
        if (resourceId === undefined || resourceId === '') {
          res.status(400).json({
            success: false,
            error: `Missing ${paramName} parameter`,
            code: 'MISSING_PARAMETER',
          });
          return;
        }

        // Validate resource ownership
        const tableName = RESOURCE_TABLE_MAP[resourceType];
        if (tableName === '' || tableName === undefined) {
          throw new Error(`Unknown resource type: ${resourceType}`);
        }

        const result = await this.db.query(
          `SELECT organization_id FROM ${tableName} 
           WHERE id = $1 AND deleted_at IS NULL`,
          [resourceId]
        );

        if (result.rows.length === 0) {
          // Resource doesn't exist - return 404
          res.status(404).json({
            success: false,
            error: `${resourceType} not found`,
            code: 'RESOURCE_NOT_FOUND',
          });
          return;
        }

        const row = result.rows[0] as unknown as DbRow;
        const resourceOrgId = String(row.organization_id);

        if (resourceOrgId !== user.organizationId) {
          // Cross-tenant access attempt - audit and block
          await this.logViolation(req, resourceType, resourceId, resourceOrgId);

          res.status(404).json({
            success: false,
            error: `${resourceType} not found`,
            code: 'RESOURCE_NOT_FOUND',
          });
          return;
        }

        // Access granted
        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Validate bulk resource access
   * @param resourceType - Type of resources to validate
   * @param idsSource - Function to extract IDs from request
   * @returns Express middleware
   */
  validateBulkResourceAccess(
    resourceType: ResourceType,
    idsSource: (req: Request) => string[]
  ): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Check authentication
        const user = req.user;
        if (user?.organizationId === undefined) {
          res.status(401).json({
            success: false,
            error: 'Unauthorized',
            code: 'UNAUTHORIZED',
          });
          return;
        }

        // Extract IDs
        const ids = idsSource(req);
        if (ids.length === 0) {
          res.status(400).json({
            success: false,
            error: 'No resource IDs provided',
            code: 'MISSING_IDS',
          });
          return;
        }

        // Validate all resources belong to user's organization
        // eslint-disable-next-line security/detect-object-injection
        const tableName = RESOURCE_TABLE_MAP[resourceType];
        if (tableName === '' || tableName === undefined) {
          throw new Error(`Unknown resource type: ${resourceType}`);
        }

        const result = await this.db.query(
          `SELECT id, organization_id FROM ${tableName}
           WHERE id = ANY($1) AND deleted_at IS NULL`,
          [ids]
        );

        // Check if all IDs were found
        if (result.rows.length !== ids.length) {
          res.status(404).json({
            success: false,
            error: `Some ${resourceType}s not found`,
            code: 'RESOURCES_NOT_FOUND',
          });
          return;
        }

        // Check if all belong to user's organization
        const userOrgId = user.organizationId;
        const dbRows = result.rows as unknown as DbRow[];
        const violations = dbRows.filter(
          (row) => String(row.organization_id) !== userOrgId
        );

        if (violations.length > 0) {
          // Log violations
          for (const violation of violations) {
            await this.logViolation(
              req,
              resourceType,
              String(violation.id),
              String(violation.organization_id)
            );
          }

          res.status(404).json({
            success: false,
            error: `Some ${resourceType}s not found`,
            code: 'RESOURCES_NOT_FOUND',
          });
          return;
        }

        // Access granted
        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Ensure a query includes organization_id scope
   * @param query - SQL query to validate
   * @throws Error if query doesn't include organization_id
   */
  static ensureOrgScope(query: string): void {
    const normalizedQuery = query.toLowerCase().replace(/\s+/g, ' ');
    
    if (!normalizedQuery.includes('organization_id')) {
      throw new Error(
        'HIPAA-003 violation: Query missing organization_id scope. ' +
        'All queries must filter by organization_id to prevent cross-tenant data access.'
      );
    }
  }

  /**
   * Log cross-tenant access violation
   */
  private async logViolation(
    req: Request,
    resourceType: string,
    resourceId: string,
    resourceOrganizationId: string
  ): Promise<void> {
    const user = req.user;
    if (this.auditService === undefined || user === undefined) {
      return;
    }

    try {
      const context: UserContext = {
        userId: user.userId,
        organizationId: user.organizationId,
        roles: user.roles,
        permissions: user.permissions,
        branchIds: user.branchIds,
      };

      const event: CreateAuditEvent = {
        eventType: 'SECURITY',
        resource: resourceType,
        resourceId,
        action: 'CROSS_TENANT_ACCESS_ATTEMPT',
        result: 'FAILURE',
        metadata: {
          userOrganizationId: user.organizationId,
          resourceOrganizationId,
          method: req.method,
          path: req.path,
          severity: 'HIGH',
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      };

      await this.auditService.logEvent(context, event);
    } catch (error) {
      console.error('Failed to log security violation:', error);
    }
  }
}
