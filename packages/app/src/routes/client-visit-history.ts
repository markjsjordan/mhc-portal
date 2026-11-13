/**
 * Client Visit History API Routes
 * 
 * Provides visit history for client profiles - separate from visits:read permission,
 * gated on clients:read to allow field staff to see historical visits for their clients.
 * Returns minimum necessary fields (no internal notes, risk flags, or caregiver instructions).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Database, AuthMiddleware, UserContext, AuditService, isValidUUID } from '@folkcare/core';
import { ScheduleRepository } from '@folkcare/scheduling-visits';

/**
 * Extract user context from authenticated request
 */
function getUserContext(req: Request): UserContext {
  const user = req.user!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyUser = user as any;
  return {
    userId: user.userId,
    organizationId: user.organizationId,
    branchIds: user.branchIds ?? [],
    roles: user.roles,
    permissions: user.permissions,
    familyClientIds: anyUser.familyClientIds as string[] | undefined,
  };
}

/**
 * Check if user has clients:read permission
 */
function hasClientReadPermission(context: UserContext): boolean {
  return context.permissions.some((perm) => {
    return perm === '*:*' || perm === 'clients:*' || perm === 'clients:read';
  });
}

export function createClientVisitHistoryRouter(db: Database): Router {
  const router = Router();
  const authMiddleware = new AuthMiddleware(db);
  const auditService = new AuditService(db);
  const scheduleRepository = new ScheduleRepository(db.getPool());

  // All routes require authentication
  router.use(authMiddleware.requireAuth);
  if (authMiddleware.auditImpersonatedActions) {
    router.use((req: Request, res: Response, next: NextFunction) => 
      authMiddleware.auditImpersonatedActions(req, res, next)
    );
  }

  /**
   * GET /api/clients/:clientId/visit-history
   * 
   * Get paginated visit history for a specific client.
   * 
   * Authorization:
   * - Requires clients:read permission (NOT visits:read)
   * - FAMILY users can only access their own linked clients
   * - Organization and branch scoping enforced server-side
   * 
   * Audit:
   * - Logs PHI access for every successful read
   * 
   * Query params:
   * - page: Page number (default: 1)
   * - limit: Items per page (default: 20, max: 100)
   * - status: Optional visit status filter (e.g. COMPLETED, CANCELLED)
   * 
   * Response:
   * - items: Array of visit history entries (minimum necessary fields)
   * - total: Total number of visits
   * - page: Current page
   * - limit: Items per page
   * - totalPages: Total number of pages
   */
  router.get(
    '/clients/:clientId/visit-history',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const context = getUserContext(req);
        const { clientId } = req.params;
        const pageParam = req.query.page as string | undefined;
        const limitParam = req.query.limit as string | undefined;

        // Validate clientId
        if (!clientId || !isValidUUID(clientId)) {
          res.status(400).json({
            success: false,
            error: 'Valid client ID is required',
          });
          return;
        }

        // Check clients:read permission
        if (!hasClientReadPermission(context)) {
          res.status(403).json({
            success: false,
            error: 'Access denied: clients:read permission required',
            code: 'PERMISSION_DENIED',
          });
          return;
        }

        // FAMILY scoping: can only access their own linked clients
        if (context.roles.includes('FAMILY')) {
          const familyClientIds = context.familyClientIds ?? [];
          if (!familyClientIds.includes(clientId)) {
            res.status(403).json({
              success: false,
              error: 'Access denied: You can only view visit history for your own linked clients',
              code: 'FAMILY_SCOPE_VIOLATION',
            });
            return;
          }
        }

        // Validate organization context
        if (!context.organizationId) {
          res.status(400).json({
            success: false,
            error: 'Organization context is required',
          });
          return;
        }

        // Parse pagination
        const page = pageParam ? parseInt(pageParam, 10) : 1;
        const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 20;

        if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) {
          res.status(400).json({
            success: false,
            error: 'Invalid pagination parameters',
          });
          return;
        }

        // Optional status filter (e.g. COMPLETED, CANCELLED, NO_SHOW_CLIENT)
        const statusParam = req.query.status as string | undefined;
        if (statusParam !== undefined && !/^[A-Z_]{1,40}$/.test(statusParam)) {
          res.status(400).json({
            success: false,
            error: 'Invalid status filter',
          });
          return;
        }

        // Fetch visit history with org and branch scoping
        const result = await scheduleRepository.getClientVisitHistory(
          clientId,
          context.organizationId,
          context.branchIds.length > 0 ? context.branchIds : undefined,
          { page, limit },
          statusParam
        );

        // Audit PHI access (HIPAA requirement)
        await auditService.logEvent(context, {
          eventType: 'DATA_ACCESS',
          resource: 'clients',
          resourceId: clientId,
          action: 'VIEW_VISIT_HISTORY',
          result: 'SUCCESS',
          metadata: {
            visitCount: result.items.length,
            page,
            limit,
            status: statusParam,
            ipAddress: req.ip,
          },
          ipAddress: req.ip,
        });

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
