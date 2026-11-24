/**
 * Caregiver Assignments API Routes (E2 / wdvf3adf61)
 *
 * Endpoints mounted at `/api/assignments`:
 *  - POST   /                          Assign a caregiver to a visit (coordinator/admin)
 *  - POST   /bulk                      Bulk assign caregivers to visits (coordinator/admin)
 *  - GET    /                          List assignments (org-wide for coordinators, own-only for caregivers)
 *  - GET    /roster                    Roster view grouped by caregiver (coordinator/admin)
 *  - PUT    /:id/status                Update assignment status (PENDING_ACCEPTANCE | ACCEPTED | COMPLETED | CANCELLED)
 *  - DELETE /:id                       Unassign (cancel) an assignment (coordinator/admin)
 *  - GET    /availability/:caregiverId Get caregiver availability & specialties
 *  - PUT    /availability/:caregiverId Update caregiver availability & specialties
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { Database, AuthMiddleware } from '@folkcare/core';
import {
  AssignmentService,
  AssignmentConflictError,
  AssignmentNotFoundError,
  AssignmentForbiddenError,
  CreateAssignmentSchema,
  BulkAssignSchema,
  UpdateAssignmentStatusSchema,
  AssignmentQuerySchema,
  CaregiverAvailabilitySchema,
} from '../services/assignment-service.js';

const COORDINATOR_ROLES = new Set([
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'COORDINATOR',
  'CARE_COORDINATOR',
  'SCHEDULER',
]);

const UuidParamSchema = z.uuid('Invalid UUID parameter');

function isCoordinator(roles: string[]): boolean {
  return roles.some((role) => COORDINATOR_ROLES.has(role));
}

async function resolveCaregiverIdForUser(
  db: Database,
  organizationId: string,
  userId: string
): Promise<string | null> {
  const result = await db.query<{ id: string }>(
    `SELECT id FROM caregivers WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
    [organizationId, userId]
  );
  return result.rows[0]?.id ?? null;
}

export function createAssignmentsRouter(db: Database): Router {
  const router = Router();
  const authMiddleware = new AuthMiddleware(db);
  const service = new AssignmentService(db);

  // POST /api/assignments — single assignment
  router.post(
    '/',
    authMiddleware.requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const user = req.user!;
        if (!isCoordinator(user.roles)) {
          res.status(403).json({
            success: false,
            error: 'Insufficient permissions: coordinators and admins only',
          });
          return;
        }

        const parsed = CreateAssignmentSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: 'Invalid assignment payload',
            details: z.flattenError(parsed.error).fieldErrors,
          });
          return;
        }

        const result = await service.assignCaregiver(
          user.organizationId,
          user.userId,
          parsed.data
        );

        res.status(201).json({
          success: true,
          data: result.assignment,
          warnings: result.warnings,
        });
      } catch (error) {
        if (error instanceof AssignmentConflictError) {
          res.status(409).json({
            success: false,
            error: error.message,
            violations: error.violations,
          });
          return;
        }
        if (error instanceof AssignmentNotFoundError) {
          res.status(404).json({
            success: false,
            error: error.message,
          });
          return;
        }
        console.error('[Assignments] Failed to create assignment:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to create assignment',
        });
      }
    }
  );

  // POST /api/assignments/bulk — bulk assign
  router.post(
    '/bulk',
    authMiddleware.requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const user = req.user!;
        if (!isCoordinator(user.roles)) {
          res.status(403).json({
            success: false,
            error: 'Insufficient permissions: coordinators and admins only',
          });
          return;
        }

        const parsed = BulkAssignSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: 'Invalid bulk assignment payload',
            details: z.flattenError(parsed.error).fieldErrors,
          });
          return;
        }

        const result = await service.bulkAssign(
          user.organizationId,
          user.userId,
          parsed.data
        );

        res.status(201).json({
          success: true,
          data: result,
        });
      } catch (error) {
        console.error('[Assignments] Failed to bulk assign:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to bulk assign caregivers',
        });
      }
    }
  );

  // GET /api/assignments — list assignments (org-wide for coordinators, own for caregivers)
  router.get(
    '/',
    authMiddleware.requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const user = req.user!;
        const parsedQuery = AssignmentQuerySchema.safeParse(req.query);
        if (!parsedQuery.success) {
          res.status(400).json({
            success: false,
            error: 'Invalid assignment query parameters',
            details: z.flattenError(parsedQuery.error).fieldErrors,
          });
          return;
        }

        let caregiverFilterId: string | undefined;
        if (!isCoordinator(user.roles)) {
          const ownCaregiverId = await resolveCaregiverIdForUser(
            db,
            user.organizationId,
            user.userId
          );
          if (!ownCaregiverId) {
            res.json({
              success: true,
              data: [],
              meta: { total: 0 },
            });
            return;
          }
          caregiverFilterId = ownCaregiverId;
        }

        const result = await service.listAssignments(
          user.organizationId,
          parsedQuery.data,
          caregiverFilterId
        );

        res.json({
          success: true,
          data: result.assignments,
          meta: { total: result.total },
        });
      } catch (error) {
        console.error('[Assignments] Failed to list assignments:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to list assignments',
        });
      }
    }
  );

  // GET /api/assignments/roster — coordinator roster grouped by caregiver
  router.get(
    '/roster',
    authMiddleware.requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const user = req.user!;
        if (!isCoordinator(user.roles)) {
          res.status(403).json({
            success: false,
            error: 'Insufficient permissions: coordinators and admins only',
          });
          return;
        }

        const startDate =
          typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
        const endDate =
          typeof req.query.endDate === 'string' ? req.query.endDate : undefined;

        const roster = await service.getRoster(user.organizationId, startDate, endDate);

        res.json({
          success: true,
          data: roster,
        });
      } catch (error) {
        console.error('[Assignments] Failed to load roster:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to load caregiver roster',
        });
      }
    }
  );

  // PUT /api/assignments/:id/status — update assignment status
  router.put(
    '/:id/status',
    authMiddleware.requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const user = req.user!;
        const idParsed = UuidParamSchema.safeParse(req.params.id);
        if (!idParsed.success) {
          res.status(400).json({
            success: false,
            error: 'Invalid assignment ID',
          });
          return;
        }

        const bodyParsed = UpdateAssignmentStatusSchema.safeParse(req.body);
        if (!bodyParsed.success) {
          res.status(400).json({
            success: false,
            error: 'Invalid status payload',
            details: z.flattenError(bodyParsed.error).fieldErrors,
          });
          return;
        }

        let caregiverFilterId: string | undefined;
        if (!isCoordinator(user.roles)) {
          const ownCaregiverId = await resolveCaregiverIdForUser(
            db,
            user.organizationId,
            user.userId
          );
          if (!ownCaregiverId) {
            res.status(403).json({
              success: false,
              error: 'Caregiver profile not found for current user',
            });
            return;
          }
          caregiverFilterId = ownCaregiverId;
        }

        const updated = await service.updateStatus(
          user.organizationId,
          idParsed.data,
          user.userId,
          bodyParsed.data,
          caregiverFilterId
        );

        res.json({
          success: true,
          data: updated,
        });
      } catch (error) {
        if (error instanceof AssignmentNotFoundError) {
          res.status(404).json({
            success: false,
            error: error.message,
          });
          return;
        }
        if (error instanceof AssignmentForbiddenError) {
          res.status(403).json({
            success: false,
            error: error.message,
          });
          return;
        }
        console.error('[Assignments] Failed to update assignment status:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to update assignment status',
        });
      }
    }
  );

  // DELETE /api/assignments/:id — unassign (cancel)
  router.delete(
    '/:id',
    authMiddleware.requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const user = req.user!;
        if (!isCoordinator(user.roles)) {
          res.status(403).json({
            success: false,
            error: 'Insufficient permissions: coordinators and admins only',
          });
          return;
        }

        const idParsed = UuidParamSchema.safeParse(req.params.id);
        if (!idParsed.success) {
          res.status(400).json({
            success: false,
            error: 'Invalid assignment ID',
          });
          return;
        }

        const cancelled = await service.unassign(
          user.organizationId,
          idParsed.data,
          user.userId
        );

        res.json({
          success: true,
          data: cancelled,
        });
      } catch (error) {
        if (error instanceof AssignmentNotFoundError) {
          res.status(404).json({
            success: false,
            error: error.message,
          });
          return;
        }
        console.error('[Assignments] Failed to unassign:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to unassign caregiver',
        });
      }
    }
  );

  // GET /api/assignments/availability/:caregiverId
  router.get(
    '/availability/:caregiverId',
    authMiddleware.requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const user = req.user!;
        const idParsed = UuidParamSchema.safeParse(req.params.caregiverId);
        if (!idParsed.success) {
          res.status(400).json({
            success: false,
            error: 'Invalid caregiver ID',
          });
          return;
        }

        const availability = await service.getAvailability(
          user.organizationId,
          idParsed.data
        );

        res.json({
          success: true,
          data: availability ?? {
            weeklyHours: {},
            unavailableDates: [],
            serviceSpecialties: [],
          },
        });
      } catch (error) {
        console.error('[Assignments] Failed to get availability:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get caregiver availability',
        });
      }
    }
  );

  // PUT /api/assignments/availability/:caregiverId
  router.put(
    '/availability/:caregiverId',
    authMiddleware.requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const user = req.user!;
        if (!isCoordinator(user.roles)) {
          res.status(403).json({
            success: false,
            error: 'Insufficient permissions: coordinators and admins only',
          });
          return;
        }

        const idParsed = UuidParamSchema.safeParse(req.params.caregiverId);
        if (!idParsed.success) {
          res.status(400).json({
            success: false,
            error: 'Invalid caregiver ID',
          });
          return;
        }

        const bodyParsed = CaregiverAvailabilitySchema.safeParse(req.body);
        if (!bodyParsed.success) {
          res.status(400).json({
            success: false,
            error: 'Invalid availability payload',
            details: z.flattenError(bodyParsed.error).fieldErrors,
          });
          return;
        }

        const saved = await service.upsertAvailability(
          user.organizationId,
          idParsed.data,
          user.userId,
          bodyParsed.data
        );

        res.json({
          success: true,
          data: saved,
        });
      } catch (error) {
        console.error('[Assignments] Failed to update availability:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to update caregiver availability',
        });
      }
    }
  );

  return router;
}
