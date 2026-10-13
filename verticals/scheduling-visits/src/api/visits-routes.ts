/**
 * Visits API Routes
 *
 * RESTful endpoints for visit management:
 * - Create ad-hoc visits (POST /api/visits)
 * - Check caregiver conflicts (POST /api/visits/check-conflicts)
 *
 * Phase 1 Implementation: Backend HTTP endpoint with validation and conflict checking
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { UUID, UserContext } from '@folkcare/core';
import { ScheduleRepository } from '../repository/schedule-repository.js';
import {
  CreateVisitInput,
  VisitStatus,
} from '../types/schedule.js';
import { Pool } from 'pg';

/**
 * Request validation schema for creating a single visit
 * Different from pattern creation - this is for ad-hoc visit creation
 */
export const CreateVisitRequestSchema = z.object({
  // Core visit details
  clientId: z.string().uuid('Invalid client ID'),
  serviceTypeId: z.string().uuid('Invalid service type ID'),
  serviceTypeName: z.string().min(1, 'Service type name required'),

  // Scheduling
  scheduledDate: z.string().date('Invalid date format, use YYYY-MM-DD'),
  scheduledStartTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Start time must be HH:MM'),
  scheduledEndTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'End time must be HH:MM'),
  timezone: z.string().default('America/New_York'),

  // Optional assignment
  assignedCaregiverId: z.string().uuid().optional().nullable(),

  // Optional metadata
  visitType: z
    .enum([
      'REGULAR',
      'INITIAL',
      'DISCHARGE',
      'RESPITE',
      'EMERGENCY',
      'MAKEUP',
      'SUPERVISION',
      'ASSESSMENT',
    ])
    .default('REGULAR'),
  notes: z.string().max(1000).optional(),

  // Conflict checking
  checkConflicts: z.boolean().default(true),
});

export type CreateVisitRequest = z.infer<typeof CreateVisitRequestSchema>;

/**
 * Response schema for visit creation
 */
export interface CreateVisitResponse {
  success: boolean;
  data: {
    id: string;
    visitNumber: string;
    clientId: string;
    serviceTypeName: string;
    scheduledDate: string;
    scheduledStartTime: string;
    scheduledEndTime: string;
    status: VisitStatus;
    createdAt: string;
  };
  message?: string;
}

/**
 * Error response for conflict checking
 */
export interface ConflictCheckResponse {
  hasConflicts: boolean;
  conflicts: Array<{
    visitId: string;
    caregiverName: string;
    scheduledStartTime: string;
    scheduledEndTime: string;
    clientName: string;
  }>;
  message?: string;
}

/**
 * Schema for checking conflicts
 */
export const CheckConflictsRequestSchema = z.object({
  caregiverId: z.string().uuid('Invalid caregiver ID'),
  scheduledDate: z.string().date('Invalid date format, use YYYY-MM-DD'),
  scheduledStartTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Start time must be HH:MM'),
  scheduledEndTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'End time must be HH:MM'),
});

export type CheckConflictsRequest = z.infer<
  typeof CheckConflictsRequestSchema
>;

/**
 * Middleware to validate request body against Zod schema
 */
function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors: Record<string, string> = {};
        for (const issue of error.issues) {
          const path = issue.path.join('.');
          formattedErrors[path] = issue.message;
        }
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: formattedErrors,
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Middleware to check permission
 */
function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userContext = req.user as UserContext | undefined;
    if (!userContext) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Check permission (this would be done properly via a permission service in full implementation)
    // For now, we'll allow SUPER_ADMIN and check basic roles
    if (
      userContext.permissions &&
      !userContext.permissions.includes(permission)
    ) {
      res.status(403).json({
        success: false,
        message: `Missing required permission: ${permission}`,
      });
      return;
    }
    next();
  };
}

export function createVisitsRoutes(pool: Pool): Router {
  const router = Router();
  const repository = new ScheduleRepository(pool);

  /**
   * POST /api/visits
   *
   * Create a new ad-hoc visit (not from pattern)
   *
   * Authorization: 'schedules:create' permission
   *
   * Request Body:
   * {
   *   clientId: string (UUID)
   *   serviceTypeId: string (UUID)
   *   serviceTypeName: string
   *   scheduledDate: string (YYYY-MM-DD)
   *   scheduledStartTime: string (HH:MM)
   *   scheduledEndTime: string (HH:MM)
   *   timezone: string (optional, default: America/New_York)
   *   assignedCaregiverId?: string (UUID)
   *   visitType?: enum (default: REGULAR)
   *   notes?: string
   *   checkConflicts?: boolean (default: true)
   * }
   *
   * Response (201 Created):
   * {
   *   success: true
   *   data: {
   *     id: string (UUID)
   *     visitNumber: string
   *     clientId: string
   *     serviceTypeName: string
   *     scheduledDate: string
   *     scheduledStartTime: string
   *     scheduledEndTime: string
   *     status: "DRAFT"
   *     createdAt: string (ISO 8601)
   *   }
   * }
   *
   * Error Responses:
   * - 400 Bad Request: Validation error (invalid input)
   * - 401 Unauthorized: Missing or invalid auth token
   * - 403 Forbidden: Missing schedules:create permission
   * - 409 Conflict: Caregiver has scheduling conflict (if checkConflicts=true)
   * - 500 Internal Server Error: Database or service error
   */
  router.post(
    '/visits',
    requirePermission('schedules:create'),
    validateRequest(CreateVisitRequestSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const validated = req.body as CreateVisitRequest;
        const userContext = req.user as UserContext;

        // Check organization context
        if (!userContext.organizationId) {
          res.status(403).json({
            success: false,
            message: 'Organization context required',
          });
          return;
        }

        // Validate time format and logic
        const timeParts = validated.scheduledStartTime.split(':');
        const startHour = parseInt(timeParts[0] || '0', 10);
        const startMin = parseInt(timeParts[1] || '0', 10);
        
        const endTimeParts = validated.scheduledEndTime.split(':');
        const endHour = parseInt(endTimeParts[0] || '0', 10);
        const endMin = parseInt(endTimeParts[1] || '0', 10);
        
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        if (endMinutes <= startMinutes) {
          res.status(400).json({
            success: false,
            message: 'End time must be after start time',
          });
          return;
        }

        // Check date is not in the past (allow same day scheduling)
        const visitDate = new Date(validated.scheduledDate + 'T00:00:00Z');
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        if (visitDate < today) {
          res.status(400).json({
            success: false,
            message: 'Cannot create visit for past dates',
          });
          return;
        }

        // Get client's branch - for now we'll use a default branch from the organization
        // In a full implementation, this would fetch from client-demographics service
        let branchId: UUID;
        try {
          // Try to get the primary branch for the organization
          const branchQuery = `
            SELECT id FROM branches 
            WHERE organization_id = $1 
            LIMIT 1
          `;
          const branchResult = await pool.query(branchQuery, [
            userContext.organizationId,
          ]);

          if (branchResult.rows.length === 0) {
            res.status(400).json({
              success: false,
              message:
                'No branches found for organization. Please create a branch first.',
            });
            return;
          }

          branchId = branchResult.rows[0].id;
        } catch (dbError) {
          console.error('Error fetching branch:', dbError);
          res.status(500).json({
            success: false,
            message: 'Failed to retrieve organization branch',
          });
          return;
        }

        // Check for caregiver conflicts if caregiver is assigned
        if (
          validated.assignedCaregiverId &&
          validated.checkConflicts !== false
        ) {
          try {
            const conflicts = await repository.getConflictingVisits(
              validated.assignedCaregiverId,
              visitDate,
              validated.scheduledStartTime,
              validated.scheduledEndTime
            );

            if (conflicts.length > 0) {
              res.status(409).json({
                success: false,
                message:
                  'Caregiver has scheduling conflicts during this time',
                conflicts: conflicts.map((c) => ({
                  visitId: c.id,
                  caregiverName: `${c.caregiverFirstName} ${c.caregiverLastName}`,
                  scheduledStartTime: c.scheduledStartTime,
                  scheduledEndTime: c.scheduledEndTime,
                  clientName: `${c.clientFirstName} ${c.clientLastName}`,
                })),
              });
              return;
            }
          } catch (conflictError) {
            console.error('Error checking conflicts:', conflictError);
            // Don't fail the entire request if conflict check fails
            // Log but continue
          }
        }

        // Prepare visit creation input
        const createInput: CreateVisitInput = {
          organizationId: userContext.organizationId,
          branchId,
          clientId: validated.clientId,
          visitType: (validated.visitType || 'REGULAR') as 'REGULAR' | 'INITIAL' | 'DISCHARGE' | 'RESPITE' | 'EMERGENCY' | 'MAKEUP' | 'SUPERVISION' | 'ASSESSMENT',
          serviceTypeId: validated.serviceTypeId,
          serviceTypeName: validated.serviceTypeName,
          scheduledDate: visitDate,
          scheduledStartTime: validated.scheduledStartTime,
          scheduledEndTime: validated.scheduledEndTime,
          timezone: validated.timezone || 'America/New_York',
          address: {
            line1: '',
            city: '',
            state: '',
            postalCode: '',
            country: 'US',
          },
          clientInstructions: validated.notes,
        };

        // Create the visit
        let visitId: string;
        let visitNumber: string;
        let createdAt: Date;
        
        try {
          const visit = await repository.createVisit(createInput, userContext);
          visitId = visit.id;
          visitNumber = visit.visitNumber;
          createdAt = visit.createdAt;
        } catch (createError) {
          console.error('Error creating visit:', createError);
          res.status(500).json({
            success: false,
            message: 'Failed to create visit',
          });
          return;
        }

        // Format response
        const response: CreateVisitResponse = {
          success: true,
          data: {
            id: visitId,
            visitNumber,
            clientId: validated.clientId,
            serviceTypeName: validated.serviceTypeName,
            scheduledDate: validated.scheduledDate,
            scheduledStartTime: validated.scheduledStartTime,
            scheduledEndTime: validated.scheduledEndTime,
            status: 'UNASSIGNED' as VisitStatus,
            createdAt: createdAt.toISOString(),
          },
        };

        res.status(201).json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/visits/check-conflicts
   *
   * Check for scheduling conflicts when assigning a caregiver
   *
   * Authorization: 'schedules:create' permission
   *
   * Request Body:
   * {
   *   caregiverId: string (UUID)
   *   scheduledDate: string (YYYY-MM-DD)
   *   scheduledStartTime: string (HH:MM)
   *   scheduledEndTime: string (HH:MM)
   * }
   *
   * Response (200 OK):
   * {
   *   hasConflicts: boolean
   *   conflicts: [ { visitId, caregiverName, scheduledStartTime, scheduledEndTime, clientName }, ... ]
   * }
   */
  router.post(
    '/visits/check-conflicts',
    requirePermission('schedules:create'),
    validateRequest(CheckConflictsRequestSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const validated = req.body as CheckConflictsRequest;

        const visitDate = new Date(validated.scheduledDate + 'T00:00:00Z');

        const conflicts = await repository.getConflictingVisits(
          validated.caregiverId,
          visitDate,
          validated.scheduledStartTime,
          validated.scheduledEndTime
        );

        const response: ConflictCheckResponse = {
          hasConflicts: conflicts.length > 0,
          conflicts: conflicts.map((c) => ({
            visitId: c.id,
            caregiverName: `${c.caregiverFirstName} ${c.caregiverLastName}`,
            scheduledStartTime: c.scheduledStartTime,
            scheduledEndTime: c.scheduledEndTime,
            clientName: `${c.clientFirstName} ${c.clientLastName}`,
          })),
        };

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
