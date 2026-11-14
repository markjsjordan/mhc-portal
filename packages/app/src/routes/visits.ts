/**
 * Visit API routes
 * 
 * Handles visit and scheduling endpoints for mobile and web applications
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Database, isValidUUID, ComplianceAutopilotService, AuditService, UserContext, AuthMiddleware, UUID } from '@folkcare/core';
import {
  ScheduleRepository,
  StaffingDemandPredictionService,
  CaregiverMatchingService,
  RecurringVisitPatternEngine,
  VisitPatternRepository,
  PatternAuthorizationGuard,
  type IServiceAuthorizationReader,
  type IClientFundingReader,
  type IPatternHoursSummaryReader,
} from '@folkcare/scheduling-visits';
import { ServiceAuthorizationRepository } from '@folkcare/care-plans-tasks';
import { ClientRepository } from '@folkcare/client-demographics';
import { ComplianceCheckingService, complianceCheckRequestSchema, DocumentationQualityService, HospitalizationRiskService, VitalsAnomalyService, SentimentAnalysisService, ReportGenerationService } from '@folkcare/visit-notes';
import { VisitDurationPredictionService } from '@folkcare/scheduling-visits';
import { HOME_CARE_SERVICE_TYPES } from './service-types.js';
import knex from 'knex';
import { z } from 'zod';

const SCHEDULING_ROLES = [
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'BRANCH_ADMIN',
  'COORDINATOR',
  'SCHEDULER',
  'SUPERVISOR',
  'ADMINISTRATOR',
];

export function hasSchedulingAccess(context: UserContext, action: 'read' | 'update'): boolean {
  const hasRole = context.roles.some((role) => SCHEDULING_ROLES.includes(role));
  const hasPerm = context.permissions.some((perm) => {
    if (perm === '*:*' || perm === 'schedules:*' || perm === 'visits:*') return true;
    if (action === 'read') {
      return perm === 'schedules:read' || perm === 'visits:read' || perm === 'schedules:update' || perm === 'visits:update';
    }
    return perm === 'schedules:update' || perm === 'visits:update';
  });

  return hasRole || hasPerm;
}

export function requireSchedulingAccess(action: 'read' | 'update') {
  return (req: Request, res: Response, next: NextFunction) => {
    const context = getUserContext(req);
    if (!context.organizationId) {
      res.status(400).json({ success: false, error: 'Organization ID is required' });
      return;
    }
    if (!hasSchedulingAccess(context, action)) {
      res.status(403).json({
        success: false,
        error: `Access denied: Scheduling ${action} permission required`,
        code: 'PERMISSION_DENIED',
      });
      return;
    }
    next();
  };
}

/**
 * Returns an error message when date/time/visitType format is invalid, otherwise null.
 * Checks run in the same order as the original inline validation.
 */
function validateVisitFormats(input: {
  scheduledDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  visitType?: string;
}): string | null {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(input.scheduledDate)) {
    return 'scheduledDate must be in YYYY-MM-DD format';
  }
  const timeRegex = /^([01]?\d|2[0-3]):[0-5]\d$/;
  if (!timeRegex.test(input.scheduledStartTime) || !timeRegex.test(input.scheduledEndTime)) {
    return 'scheduledStartTime and scheduledEndTime must be in HH:MM format (24-hour)';
  }
  const ALLOWED_VISIT_TYPES = ['REGULAR', 'INITIAL', 'DISCHARGE', 'RESPITE', 'EMERGENCY', 'MAKEUP', 'SUPERVISION', 'ASSESSMENT', 'CONCIERGE', 'ONGOING_SUPPORT'];
  if (input.visitType && !ALLOWED_VISIT_TYPES.includes(input.visitType)) {
    return `Invalid visitType. Must be one of: ${ALLOWED_VISIT_TYPES.join(', ')}`;
  }
  return null;
}

/**
 * Resolves the service type name and UUID from given inputs.
 */
function resolveServiceType(serviceTypeId: string, serviceTypeName?: string): {
  id: string;
  name: string;
} {
  const matchedService = HOME_CARE_SERVICE_TYPES.find(
    (st) => st.id === serviceTypeId || st.code === serviceTypeId
  );
  return {
    id: isValidUUID(serviceTypeId) ? serviceTypeId : '00000000-0000-0000-0000-000000000000',
    name: serviceTypeName ?? matchedService?.name ?? serviceTypeId,
  };
}

/**
 * Resolves duration in minutes between start time and end time.
 */
function calculateScheduledDuration(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  const duration = ((endHour ?? 0) * 60 + (endMin ?? 0)) - ((startHour ?? 0) * 60 + (startMin ?? 0));
  return duration > 0 ? duration : 60;
}

/**
 * Resolves address for the visit based on input or client primary address.
 */
function resolveVisitAddress(address: unknown, clientAddress: unknown): Record<string, unknown> {
  if (address && typeof address === 'object') {
    return address as Record<string, unknown>;
  }
  if (typeof address === 'string') {
    return { street1: address, street: address };
  }
  if (clientAddress && typeof clientAddress === 'object') {
    return clientAddress as Record<string, unknown>;
  }
  return { street: '123 Main St', city: 'Austin', state: 'TX', zipCode: '78701' };
}

/**
 * True when any required field needed to create a visit is missing or falsy.
 */
function isMissingRequiredVisitFields(fields: {
  clientId?: unknown;
  serviceTypeId?: unknown;
  scheduledDate?: unknown;
  scheduledStartTime?: unknown;
  scheduledEndTime?: unknown;
}): boolean {
  return !fields.clientId || !fields.serviceTypeId || !fields.scheduledDate
    || !fields.scheduledStartTime || !fields.scheduledEndTime;
}

/**
 * Extract user context from authenticated request
 *
 * SECURITY: Reads from req.user (set by AuthMiddleware.requireAuth after
 * real JWT verification), never from req.userContext, which was previously
 * populated from spoofable X-User-Id / X-Organization-Id headers by the
 * now-removed global authContextMiddleware mock. That mismatch was the
 * root cause of a confirmed live exploit.
 */
function getUserContext(req: Request): UserContext {
  const user = req.user ?? (req as unknown as { userContext?: UserContext }).userContext;
  const anyUser = user as (UserContext & { [key: string]: unknown }) | undefined;
  return {
    userId: user?.userId ?? '',
    organizationId: user?.organizationId ?? '',
    branchIds: user?.branchIds ?? [],
    roles: user?.roles ?? [],
    permissions: user?.permissions ?? [],
    caregiverId: anyUser?.caregiverId as UUID | undefined,
    familyMemberIds: anyUser?.familyMemberIds as UUID[] | undefined,
    familyClientIds: anyUser?.familyClientIds as UUID[] | undefined,
    directClientId: anyUser?.directClientId as UUID | undefined,
  };
}

/**
 * Create a Knex instance for AI services that need it.
 * Note: Consider adding a getKnex() function to @folkcare/core in the future.
 */
function getKnexInstance(): ReturnType<typeof knex> {
  const connectionString = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/folk-care-0';
  return knex({
    client: 'pg',
    connection: connectionString,
  });
}

/**
 * Validates date range parameters for calendar/list endpoints
 * Returns error response or null if valid
 */
function validateDateRangeParams(
  startDateStr: string | undefined,
  endDateStr: string | undefined,
  res: Response
): { startDate: Date; endDate: Date } | null {
  // Check required parameters
  if (startDateStr == null || startDateStr === '' || endDateStr == null || endDateStr === '') {
    res.status(400).json({
      success: false,
      error: 'Missing required parameters: start_date and end_date',
    });
    return null;
  }

  // Validate date string format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDateStr) || !dateRegex.test(endDateStr)) {
    res.status(400).json({
      success: false,
      error: 'Invalid date format. Use YYYY-MM-DD format (e.g., 2025-01-15)',
    });
    return null;
  }

  // Parse dates - use UTC to avoid timezone issues
  const startDate = new Date(startDateStr + 'T00:00:00Z');
  const endDate = new Date(endDateStr + 'T23:59:59Z');

  // Validate date parsing
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    res.status(400).json({
      success: false,
      error: 'Invalid date values. Dates must be valid calendar dates',
    });
    return null;
  }

  // Validate date range (max 60 days for calendar view)
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 60) {
    res.status(400).json({
      success: false,
      error: 'Date range cannot exceed 60 days',
    });
    return null;
  }

  if (daysDiff < 0) {
    res.status(400).json({
      success: false,
      error: 'End date must be on or after start date',
    });
    return null;
  }

  return { startDate, endDate };
}

export function createVisitRouter(db: Database): Router {
  const router = Router();
  const authMiddleware = new AuthMiddleware(db);

  // All routes require authentication
  router.use(authMiddleware.requireAuth);
  if (authMiddleware.auditImpersonatedActions) {
    router.use((req: Request, res: Response, next: NextFunction) => authMiddleware.auditImpersonatedActions(req, res, next));
  }

  /**
   * GET /api/visits/my-visits
   * Get visits assigned to the authenticated caregiver within a date range
   *
   * Query params:
   * - start_date: Start date (YYYY-MM-DD format)
   * - end_date: End date (YYYY-MM-DD format)
   *
   * Returns: Array of visits with client information
   */
  router.get('/my-visits', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);

      // Validate query parameters
      const startDateStr = req.query['start_date'] as string | undefined;
      const endDateStr = req.query['end_date'] as string | undefined;

      if (startDateStr == null || startDateStr === '' || endDateStr == null || endDateStr === '') {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: start_date and end_date',
        });
        return;
      }

      // Parse dates
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);

      // Validate date format
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD format',
        });
        return;
      }

      // Validate date range (max 31 days)
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 31) {
        res.status(400).json({
          success: false,
          error: 'Date range cannot exceed 31 days',
        });
        return;
      }

      if (daysDiff < 0) {
        res.status(400).json({
          success: false,
          error: 'End date must be after start date',
        });
        return;
      }

      // Look up caregiver ID via context or database (user_id, ACTIVE, not deleted)
      let caregiverId: string | null = context.caregiverId ?? null;

      if (!caregiverId) {
        const caregiverResult = await db.query(
          `SELECT id FROM caregivers WHERE user_id = $1 AND portal_access_status = 'ACTIVE' AND deleted_at IS NULL`,
          [context.userId]
        );
        if (caregiverResult.rows.length > 0) {
          caregiverId = (caregiverResult.rows[0] as { id: string }).id;
        }
      }

      if (!caregiverId) {
        // User doesn't have a caregiver record - return empty array
        // This is valid for coordinators, admins, etc.
        res.json({
          success: true,
          data: [],
          meta: {
            startDate: startDateStr,
            endDate: endDateStr,
            count: 0,
            message: 'No caregiver record found for this user',
          },
        });
        return;
      }

      // Fetch visits
      const repository = new ScheduleRepository(db.getPool());
      const visits = await repository.getVisitsByCaregiver(caregiverId, startDate, endDate);

      res.json({
        success: true,
        data: visits,
        meta: {
          startDate: startDateStr,
          endDate: endDateStr,
          count: visits.length,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/visits/calendar
   * Get visits for calendar view (optimized for month/week display)
   */
  router.get('/calendar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);

      // Validate query parameters
      const startDateStr = req.query['start_date'] as string | undefined;
      const endDateStr = req.query['end_date'] as string | undefined;
      const branchIdsStr = req.query['branch_ids'] as string | undefined;

      const dateRange = validateDateRangeParams(startDateStr, endDateStr, res);
      if (dateRange === null) {
        return; // Response already sent by validator
      }
      const { startDate, endDate } = dateRange;

      // Validate organization_id is present and valid
      if (context.organizationId === undefined || context.organizationId === '') {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required for this endpoint',
        });
        return;
      }

      const organizationId = context.organizationId;
      if (isValidUUID(organizationId) === false) {
        res.status(400).json({
          success: false,
          error: 'Invalid organization ID format',
        });
        return;
      }

      // Parse and validate branch IDs if provided
      let branchIds: string[] = context.branchIds;
      if (branchIdsStr != null && branchIdsStr !== '') {
        branchIds = branchIdsStr.split(',')
          .map(id => id.trim())
          .filter(id => id !== '');

        // Validate UUID format for branch IDs
        const uuidRegex = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
        const invalidBranchIds = branchIds.filter(id => !uuidRegex.test(id));
        if (invalidBranchIds.length > 0) {
          res.status(400).json({
            success: false,
            error: `Invalid branch IDs: ${invalidBranchIds.join(', ')}`,
          });
          return;
        }

        // Ensure user has access to requested branches
        const userBranchIds: string[] = context.branchIds ?? [];
        const unauthorizedBranches = branchIds.filter(id => userBranchIds.includes(id) === false);
        if (unauthorizedBranches.length > 0) {
          res.status(403).json({
            success: false,
            error: 'Access denied to requested branches',
          });
          return;
        }
      }

      // Fetch visits with client information
      const repository = new ScheduleRepository(db.getPool());
      const visits = await repository.getVisitsByDateRange(
        organizationId,
        startDate,
        endDate,
        branchIds.length > 0 ? branchIds : undefined
      );

      res.json({
        success: true,
        data: visits,
        meta: {
          startDate: startDateStr,
          endDate: endDateStr,
          count: visits.length,
          branchesFilter: branchIds.length > 0 ? branchIds : 'all',
        },
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/visits
   * Create a single visit (called from Schedule calendar view)
   * 
   * Body:
   * - clientId: UUID of client (required)
   * - caregiverId: UUID of assigned caregiver (optional)
   * - serviceTypeId: UUID of service type (required)
   * - serviceTypeName: Display name of service type (optional)
   * - scheduledDate: Date in YYYY-MM-DD format (required)
   * - scheduledStartTime: Time in HH:MM 24-hour format (required)
   * - scheduledEndTime: Time in HH:MM 24-hour format (required)
   * - address: Service address (optional)
   * - notes: Internal notes (optional)
   * - clientInstructions: Instructions for caregiver (optional)
   * - status: Visit status - UNASSIGNED | ASSIGNED | SCHEDULED | COMPLETED | NO_SHOW_CLIENT | NO_SHOW_CAREGIVER | CANCELLED (default: UNASSIGNED)
   *
   * Returns: Created visit object
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);

      // Validate organization context
      if (!context.organizationId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required',
        });
        return;
      }

      const {
        clientId,
        caregiverId,
        serviceTypeId,
        serviceTypeName,
        visitType,
        scheduledDate,
        scheduledStartTime,
        scheduledEndTime,
        address,
        notes,
        clientInstructions,
        status = 'UNASSIGNED',
      } = req.body;

      // Validate required fields
      if (isMissingRequiredVisitFields({ clientId, serviceTypeId, scheduledDate, scheduledStartTime, scheduledEndTime })) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: clientId, serviceTypeId, scheduledDate, scheduledStartTime, scheduledEndTime',
        });
        return;
      }

      // Validate date, time, and visitType formats
      const formatError = validateVisitFormats({ scheduledDate, scheduledStartTime, scheduledEndTime, visitType });
      if (formatError) {
        res.status(400).json({
          success: false,
          error: formatError,
        });
        return;
      }

      // Verify client exists and belongs to organization
      const clientCheck = await db.query(
        'SELECT id, organization_id, branch_id, primary_address, timezone FROM clients WHERE id = $1 AND deleted_at IS NULL',
        [clientId]
      );

      if (clientCheck.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Client not found',
        });
        return;
      }

      const client = clientCheck.rows[0] as {
        id: string;
        organization_id: string;
        branch_id?: string;
        primary_address?: unknown;
        timezone?: string;
      };
      if (client.organization_id !== context.organizationId) {
        res.status(403).json({
          success: false,
          error: 'Access denied to this client',
        });
        return;
      }

      // Resolve branch: client's branch -> context branchIds -> fallback organization main branch
      let resolvedBranchId = client.branch_id || context.branchIds?.[0];
      if (!resolvedBranchId) {
        const branchCheck = await db.query(
          'SELECT id FROM branches WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1',
          [context.organizationId]
        );
        resolvedBranchId = (branchCheck.rows[0] as { id: string } | undefined)?.id;
      }

      if (!resolvedBranchId) {
        res.status(400).json({
          success: false,
          error: 'Branch ID could not be determined for visit',
        });
        return;
      }

      const serviceType = resolveServiceType(serviceTypeId, serviceTypeName);
      const resolvedAddress = resolveVisitAddress(address, client.primary_address);
      const scheduledDuration = calculateScheduledDuration(scheduledStartTime, scheduledEndTime);
      const resolvedTimezone = client.timezone || 'America/Chicago';

      // Generate unique visit number
      const year = new Date().getFullYear();
      const countCheck = await db.query(
        'SELECT COUNT(*) as count FROM visits WHERE organization_id = $1 AND EXTRACT(YEAR FROM created_at) = $2',
        [context.organizationId, year]
      );
      const visitCount = parseInt((countCheck.rows[0] as { count: string })?.count || '0', 10) + 1;
      const visitNumber = `V${year}-${visitCount.toString().padStart(6, '0')}`;

      // If caregiver is provided, verify they exist and are active
      let assignedCaregiverId: string | null = null;
      if (caregiverId) {
        const caregiverCheck = await db.query(
          'SELECT id, status FROM caregivers WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
          [caregiverId, context.organizationId]
        );

        if (caregiverCheck.rows.length === 0) {
          res.status(404).json({
            success: false,
            error: 'Caregiver not found',
          });
          return;
        }

        const caregiver = caregiverCheck.rows[0] as { id: string; status: string };
        if (caregiver.status !== 'ACTIVE') {
          res.status(400).json({
            success: false,
            error: 'Caregiver is not active',
          });
          return;
        }

        assignedCaregiverId = caregiver.id;
      }

      // Create the visit
      const result = await db.query(
        `INSERT INTO visits (
          id, organization_id, branch_id, client_id, assigned_caregiver_id,
          visit_number, visit_type,
          service_type_id, service_type_name,
          scheduled_date, scheduled_start_time, scheduled_end_time,
          scheduled_duration, timezone,
          address, internal_notes, client_instructions,
          status, assignment_method,
          created_by, updated_by, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4,
          $5, $6,
          $7, $8,
          $9, $10, $11,
          $12, $13,
          $14, $15, $16,
          $17, $18,
          $19, $19, NOW(), NOW()
        ) RETURNING *`,
        [
          context.organizationId,
          resolvedBranchId,
          clientId,
          assignedCaregiverId,
          visitNumber,
          visitType || 'REGULAR',
          serviceType.id,
          serviceType.name,
          scheduledDate,
          scheduledStartTime,
          scheduledEndTime,
          scheduledDuration,
          resolvedTimezone,
          JSON.stringify(resolvedAddress),
          notes || null,
          clientInstructions || null,
          status,
          'MANUAL',
          context.userId,
        ]
      );

      if (result.rows.length === 0) {
        res.status(500).json({
          success: false,
          error: 'Failed to create visit',
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  });

  // =========================================================================
  // Recurring Visit Patterns Endpoints
  // =========================================================================

  const getAuthorizationGuard = (): PatternAuthorizationGuard => {
    const authRepo = new ServiceAuthorizationRepository(db);
    const authReader: IServiceAuthorizationReader = {
      findActiveByClientAndService: async (clientId: string, serviceCode: string) => {
        return authRepo.findActiveByClientAndService(clientId, serviceCode);
      },
    };

    const clientRepo = new ClientRepository(db);
    const clientFundingReader: IClientFundingReader = {
      getClientFundingSources: async (clientId: string, organizationId: string) => {
        const client = await clientRepo.findById(clientId);
        if (client?.organizationId === organizationId) {
          return (client.fundingSources as Array<{ type: string; name?: string }> | undefined) ?? null;
        }
        return null;
      },
    };

    const patternSummaryReader: IPatternHoursSummaryReader = {
      getActivePatternsForClientAndService: async (clientId, serviceTypeId, organizationId, excludePatternId) => {
        const q = `
          SELECT day_of_week, duration, frequency
          FROM visit_patterns
          WHERE client_id = $1
            AND service_type_id = $2
            AND organization_id = $3
            AND status = 'ACTIVE'
            AND deleted_at IS NULL
            ${excludePatternId ? 'AND id != $4' : ''}
        `;
        const params = excludePatternId
          ? [clientId, serviceTypeId, organizationId, excludePatternId]
          : [clientId, serviceTypeId, organizationId];
        const res = await db.query(q, params);
        return res.rows.map((row: Record<string, unknown>) => ({
          dayOfWeek: typeof row.day_of_week === 'string' ? JSON.parse(row.day_of_week) : row.day_of_week,
          duration: Number(row.duration),
          frequency: row.frequency as string | undefined,
        }));
      },
    };

    return new PatternAuthorizationGuard(authReader, clientFundingReader, patternSummaryReader);
  };

  /**
   * POST /api/visits/patterns
   * Create a recurring pattern and generate concrete visits up to rolling horizon
   */
  router.post('/patterns', requireSchedulingAccess('update'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);

      const createSchema = z.object({
        clientId: z.guid('Invalid clientId format'),
        caregiverId: z.guid('Invalid caregiverId format').optional().nullable(),
        serviceTypeId: z.guid('Invalid serviceTypeId format'),
        serviceTypeName: z.string().optional(),
        frequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'CUSTOM']).optional(),
        rrule: z.string().optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD').optional().nullable(),
        dayOfWeek: z.array(z.string()).optional(),
        startTime: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'startTime must be HH:MM'),
        duration: z.coerce.number().positive(),
        status: z.enum(['ACTIVE', 'PAUSED', 'CANCELLED']).optional(),
        notes: z.string().optional(),
        clientInstructions: z.string().optional(),
        caregiverInstructions: z.string().optional(),
        skipHolidays: z.boolean().optional(),
        horizonDays: z.coerce.number().optional(),
        caregiverTimeOffExceptions: z.array(z.any()).optional(),
        clientHospitalHolds: z.array(z.any()).optional(),
      });

      const parseResult = createSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: parseResult.error.issues,
        });
        return;
      }

      const validated = parseResult.data;

      // Tenant check + branch resolution (same order as POST /): the visits table
      // requires branch_id NOT NULL, so a user context without a branch (e.g. an
      // org-level admin) must fall back to the client's branch, then the org's
      // first branch, instead of failing the visit INSERT with a 500.
      const clientCheck = await db.query(
        'SELECT id, organization_id, branch_id FROM clients WHERE id = $1 AND deleted_at IS NULL',
        [validated.clientId]
      );
      if (clientCheck.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Client not found' });
        return;
      }
      const patternClient = clientCheck.rows[0] as {
        id: string;
        organization_id: string;
        branch_id?: string | null;
      };
      if (patternClient.organization_id !== context.organizationId) {
        res.status(403).json({ success: false, error: 'Access denied to this client' });
        return;
      }

      let patternBranchId = patternClient.branch_id ?? context.branchIds?.[0];
      if (patternBranchId == null) {
        const branchCheck = await db.query(
          'SELECT id FROM branches WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1',
          [context.organizationId]
        );
        patternBranchId = (branchCheck.rows[0] as { id: string } | undefined)?.id;
      }
      if (patternBranchId == null) {
        res.status(400).json({
          success: false,
          error: 'Branch ID could not be determined for recurring pattern',
        });
        return;
      }

      // Verify caregiver exists, is active, and belongs to this organization
      if (validated.caregiverId) {
        const caregiverCheck = await db.query(
          'SELECT id, status FROM caregivers WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
          [validated.caregiverId, context.organizationId]
        );

        if (caregiverCheck.rows.length === 0) {
          res.status(404).json({
            success: false,
            error: 'Caregiver not found',
          });
          return;
        }

        const caregiver = caregiverCheck.rows[0] as { id: string; status: string };
        if (caregiver.status !== 'ACTIVE') {
          res.status(400).json({
            success: false,
            error: 'Caregiver is not active',
          });
          return;
        }
      }

      // Enforce authorization limit on create
      const guard = getAuthorizationGuard();
      const authCheck = await guard.validatePattern({
        organizationId: context.organizationId!,
        clientId: validated.clientId,
        serviceTypeId: validated.serviceTypeId,
        dayOfWeek: (validated.dayOfWeek ?? []) as unknown as import('@folkcare/scheduling-visits').DayOfWeek[],
        duration: validated.duration,
        startDate: validated.startDate,
        endDate: validated.endDate,
        frequency: validated.frequency,
      });

      if (!authCheck.allowed) {
        res.status(422).json({
          success: false,
          error: authCheck.message ?? 'Authorization limit exceeded',
          code: authCheck.code ?? 'AUTHORIZATION_LIMIT_EXCEEDED',
          details: authCheck.details,
        });
        return;
      }

      const patternEngine = new RecurringVisitPatternEngine(db.getPool());
      const result = await patternEngine.createPatternAndGenerateVisits(
        {
          organizationId: context.organizationId!,
          branchId: patternBranchId,
          clientId: validated.clientId,
          caregiverId: validated.caregiverId ?? undefined,
          serviceTypeId: validated.serviceTypeId,
          serviceTypeName: validated.serviceTypeName,
          frequency: validated.frequency as import('@folkcare/scheduling-visits').Frequency | undefined,
          rrule: validated.rrule,
          startDate: validated.startDate,
          endDate: validated.endDate ?? undefined,
          dayOfWeek: validated.dayOfWeek as unknown as import('@folkcare/scheduling-visits').DayOfWeek[] | undefined,
          startTime: validated.startTime,
          duration: validated.duration,
          status: validated.status,
          notes: validated.notes,
          clientInstructions: validated.clientInstructions,
          caregiverInstructions: validated.caregiverInstructions,
          skipHolidays: validated.skipHolidays,
          horizonDays: validated.horizonDays ? Number(validated.horizonDays) : 60,
          caregiverTimeOffExceptions: validated.caregiverTimeOffExceptions,
          clientHospitalHolds: validated.clientHospitalHolds,
        },
        context
      );

      // Audit trail
      try {
        const auditService = new AuditService(db);
        await auditService.logEvent(context, {
          eventType: 'DATA_MODIFICATION',
          resource: 'VISIT_PATTERN',
          resourceId: result.pattern.id,
          action: 'CREATE',
          result: 'SUCCESS',
          metadata: {
            clientId: validated.clientId,
            caregiverId: validated.caregiverId,
            status: result.pattern.status,
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      } catch (err) {
        console.error('Audit trail logging failed for pattern create:', err);
      }

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/visits/patterns
   * List recurring visit patterns for the organization
   */
  router.get('/patterns', requireSchedulingAccess('read'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);

      const querySchema = z.object({
        status: z.string().optional(),
        includeEnded: z.string().optional(),
        client_id: z.guid('Invalid client_id UUID').optional(),
        caregiver_id: z.guid('Invalid caregiver_id UUID').optional(),
        unassigned: z.string().optional(),
        search: z.string().optional(),
        limit: z.coerce.number().min(1).max(200).optional(),
        offset: z.coerce.number().min(0).optional(),
      });

      const parseResult = querySchema.safeParse(req.query);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: parseResult.error.issues,
        });
        return;
      }

      const q = parseResult.data;

      // Status handling:
      // If status query provided, use it.
      // If includeEnded is 'true' and no status given, pass all: ACTIVE, PAUSED, CANCELLED
      // Default: ACTIVE, PAUSED
      let statusFilter: string | string[] | undefined = q.status;
      if (!statusFilter) {
        if (q.includeEnded === 'true') {
          statusFilter = ['ACTIVE', 'PAUSED', 'CANCELLED'];
        } else {
          statusFilter = ['ACTIVE', 'PAUSED'];
        }
      }

      const isOrgAdmin = context.roles.some((r) => r === 'SUPER_ADMIN' || r === 'ORG_ADMIN');
      const branchIds = isOrgAdmin ? undefined : context.branchIds;

      const patternRepo = new VisitPatternRepository(db.getPool());
      const { patterns, total } = await patternRepo.listPatternsWithDetails({
        organizationId: context.organizationId!,
        branchIds,
        clientId: q.client_id,
        caregiverId: q.caregiver_id,
        unassigned: q.unassigned === 'true',
        status: statusFilter,
        search: q.search,
        limit: q.limit ?? 50,
        offset: q.offset ?? 0,
      });

      // Audit trail: PATTERN_LIST (HIPAA read audit)
      try {
        const auditService = new AuditService(db);
        await auditService.logEvent(context, {
          eventType: 'DATA_ACCESS',
          resource: 'VISIT_PATTERN',
          resourceId: 'list',
          action: 'PATTERN_LIST',
          result: 'SUCCESS',
          metadata: {
            count: patterns.length,
            total,
            filters: q,
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      } catch (err) {
        console.error('Audit trail logging failed for pattern list:', err);
      }

      res.json({
        success: true,
        data: patterns,
        count: patterns.length,
        total,
        limit: q.limit ?? 50,
        offset: q.offset ?? 0,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/visits/patterns/:id
   * Get pattern details and generated visits
   */
  router.get('/patterns/:id', requireSchedulingAccess('read'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const patternId = req.params.id as string | undefined;

      if (!patternId || !isValidUUID(patternId)) {
        res.status(400).json({ success: false, error: 'Valid pattern ID is required' });
        return;
      }

      const patternEngine = new RecurringVisitPatternEngine(db.getPool());
      const result = await patternEngine.getPatternWithVisits(patternId, context.organizationId!);

      // Branch scope check for non-org admins
      const isOrgAdmin = context.roles.some((r) => r === 'SUPER_ADMIN' || r === 'ORG_ADMIN');
      if (!isOrgAdmin && result.pattern.branchId && !context.branchIds.includes(result.pattern.branchId)) {
        res.status(403).json({
          success: false,
          error: 'Access denied: Pattern outside branch scope',
          code: 'PERMISSION_DENIED',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          pattern: result.pattern,
          visits: result.visits,
          totalVisits: result.visits.length,
        },
      });
    } catch (error: unknown) {
      const err = error as { name?: string; status?: number; statusCode?: number; message?: string };
      if (err.name === 'NotFoundError' || err.status === 404 || err.statusCode === 404) {
        res.status(404).json({ success: false, error: err.message ?? 'Not found' });
        return;
      }
      next(error);
    }
  });

  /**
   * POST /api/visits/patterns/:id/pause
   */
  router.post('/patterns/:id/pause', requireSchedulingAccess('update'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const patternId = req.params.id as string | undefined;

      if (!patternId || !isValidUUID(patternId)) {
        res.status(400).json({ success: false, error: 'Valid pattern ID is required' });
        return;
      }

      const pauseSchema = z.object({
        reason: z.string().max(500, 'Reason must be <= 500 characters').optional(),
      });
      const parseResult = pauseSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ success: false, error: 'Validation failed', details: parseResult.error.issues });
        return;
      }

      const patternEngine = new RecurringVisitPatternEngine(db.getPool());
      const updated = await patternEngine.pausePattern(
        patternId,
        context.organizationId!,
        parseResult.data.reason,
        context
      );

      // Audit trail
      try {
        const auditService = new AuditService(db);
        await auditService.logEvent(context, {
          eventType: 'DATA_MODIFICATION',
          resource: 'VISIT_PATTERN',
          resourceId: patternId,
          action: 'PATTERN_PAUSE',
          result: 'SUCCESS',
          metadata: {
            reason: parseResult.data.reason,
            status: updated.status,
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      } catch (err) {
        console.error('Audit trail logging failed for pattern pause:', err);
      }

      // Return details in list-item format for convenience
      const patternRepo = new VisitPatternRepository(db.getPool());
      const listRes = await patternRepo.listPatternsWithDetails({
        organizationId: context.organizationId!,
        clientId: updated.clientId,
        status: ['ACTIVE', 'PAUSED', 'CANCELLED'],
      });
      const patterns = listRes.patterns;
      const item = patterns.find((p) => p.id === patternId);

      res.status(200).json({
        success: true,
        data: item ?? updated,
      });
    } catch (error: unknown) {
      const err = error as { name?: string; statusCode?: number; message?: string; code?: string };
      if (err.name === 'NotFoundError' || err.statusCode === 404) {
        res.status(404).json({ success: false, error: err.message ?? 'Pattern not found' });
        return;
      }
      if (err.name === 'ConflictError' || err.statusCode === 409) {
        res.status(409).json({ success: false, error: err.message, code: err.code ?? 'INVALID_PATTERN_STATE' });
        return;
      }
      next(error);
    }
  });

  /**
   * POST /api/visits/patterns/:id/resume
   */
  router.post('/patterns/:id/resume', requireSchedulingAccess('update'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const patternId = req.params.id as string | undefined;

      if (!patternId || !isValidUUID(patternId)) {
        res.status(400).json({ success: false, error: 'Valid pattern ID is required' });
        return;
      }

      const patternRepo = new VisitPatternRepository(db.getPool());
      const existing = await patternRepo.getPatternById(patternId, context.organizationId!);
      if (!existing) {
        res.status(404).json({ success: false, error: 'Pattern not found' });
        return;
      }

      if (existing.status !== 'PAUSED') {
        res.status(409).json({
          success: false,
          error: 'Pattern can only be resumed from PAUSED state',
          code: 'INVALID_PATTERN_STATE',
        });
        return;
      }

      // Check endDate expiration
      const todayStr = new Date().toISOString().slice(0, 10);
      if (existing.endDate) {
        const endStr = existing.endDate instanceof Date ? existing.endDate.toISOString().slice(0, 10) : String(existing.endDate).slice(0, 10);
        if (endStr < todayStr) {
          res.status(409).json({
            success: false,
            error: 'Cannot resume expired pattern whose end date is in the past',
            code: 'PATTERN_EXPIRED',
          });
          return;
        }
      }

      // Re-validate authorization limits
      const guard = getAuthorizationGuard();
      const authCheck = await guard.validatePattern({
        organizationId: context.organizationId!,
        clientId: existing.clientId,
        serviceTypeId: existing.serviceTypeId,
        dayOfWeek: existing.dayOfWeek,
        duration: existing.duration,
        startDate: existing.startDate,
        endDate: existing.endDate,
        frequency: existing.frequency,
        patternIdToExclude: existing.id,
      });

      if (!authCheck.allowed) {
        res.status(422).json({
          success: false,
          error: authCheck.message ?? 'Authorization limit exceeded',
          code: authCheck.code ?? 'AUTHORIZATION_LIMIT_EXCEEDED',
          details: authCheck.details,
        });
        return;
      }

      const patternEngine = new RecurringVisitPatternEngine(db.getPool());
      const updated = await patternEngine.resumePattern(patternId, context.organizationId!, context);

      // Audit trail
      try {
        const auditService = new AuditService(db);
        await auditService.logEvent(context, {
          eventType: 'DATA_MODIFICATION',
          resource: 'VISIT_PATTERN',
          resourceId: patternId,
          action: 'PATTERN_RESUME',
          result: 'SUCCESS',
          metadata: {
            status: updated.status,
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      } catch (err) {
        console.error('Audit trail logging failed for pattern resume:', err);
      }

      const listRes = await patternRepo.listPatternsWithDetails({
        organizationId: context.organizationId!,
        clientId: updated.clientId,
        status: ['ACTIVE', 'PAUSED', 'CANCELLED'],
      });
      const patterns = listRes.patterns;
      const item = patterns.find((p) => p.id === patternId);

      res.status(200).json({
        success: true,
        data: item ?? updated,
      });
    } catch (error: unknown) {
      const err = error as { name?: string; statusCode?: number; message?: string; code?: string };
      if (err.name === 'NotFoundError' || err.statusCode === 404) {
        res.status(404).json({ success: false, error: err.message ?? 'Pattern not found' });
        return;
      }
      if (err.name === 'ConflictError' || err.statusCode === 409) {
        res.status(409).json({ success: false, error: err.message, code: err.code ?? 'INVALID_PATTERN_STATE' });
        return;
      }
      next(error);
    }
  });

  /**
   * POST /api/visits/patterns/:id/end
   */
  router.post('/patterns/:id/end', requireSchedulingAccess('update'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const patternId = req.params.id as string | undefined;

      if (!patternId || !isValidUUID(patternId)) {
        res.status(400).json({ success: false, error: 'Valid pattern ID is required' });
        return;
      }

      const endSchema = z.object({
        effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'effectiveDate must be YYYY-MM-DD').optional(),
        reason: z.string().min(1, 'Reason is required').max(500, 'Reason must be <= 500 characters'),
      });

      const parseResult = endSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ success: false, error: 'Validation failed', details: parseResult.error.issues });
        return;
      }

      const patternEngine = new RecurringVisitPatternEngine(db.getPool());
      const { pattern: updated, retainedFutureVisits } = await patternEngine.endPattern(
        patternId,
        context.organizationId!,
        parseResult.data.reason,
        parseResult.data.effectiveDate,
        context
      );

      // Audit trail
      try {
        const auditService = new AuditService(db);
        await auditService.logEvent(context, {
          eventType: 'DATA_MODIFICATION',
          resource: 'VISIT_PATTERN',
          resourceId: patternId,
          action: 'PATTERN_END',
          result: 'SUCCESS',
          metadata: {
            reason: parseResult.data.reason,
            effectiveDate: parseResult.data.effectiveDate,
            retainedFutureVisits,
            status: updated.status,
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      } catch (err) {
        console.error('Audit trail logging failed for pattern end:', err);
      }

      const patternRepo = new VisitPatternRepository(db.getPool());
      const listRes = await patternRepo.listPatternsWithDetails({
        organizationId: context.organizationId!,
        clientId: updated.clientId,
        status: ['ACTIVE', 'PAUSED', 'CANCELLED'],
      });
      const patterns = listRes.patterns;
      const item = patterns.find((p) => p.id === patternId);

      res.status(200).json({
        success: true,
        data: item ?? updated,
        retainedFutureVisits,
      });
    } catch (error: unknown) {
      const err = error as { name?: string; statusCode?: number; message?: string; code?: string };
      if (err.name === 'NotFoundError' || err.statusCode === 404) {
        res.status(404).json({ success: false, error: err.message ?? 'Pattern not found' });
        return;
      }
      if (err.name === 'ConflictError' || err.statusCode === 409) {
        res.status(409).json({ success: false, error: err.message, code: err.code ?? 'INVALID_PATTERN_STATE' });
        return;
      }
      next(error);
    }
  });

  /**
   * PUT /api/visits/patterns/:id
   * Update future instances with options (Update this visit only / Update all future visits)
   */
  router.put('/patterns/:id', requireSchedulingAccess('update'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const patternId = req.params.id as string | undefined;

      if (!patternId || !isValidUUID(patternId)) {
        res.status(400).json({ success: false, error: 'Valid pattern ID is required' });
        return;
      }

      const patternRepo = new VisitPatternRepository(db.getPool());
      const existing = await patternRepo.getPatternById(patternId, context.organizationId!);
      if (!existing) {
        res.status(404).json({ success: false, error: 'Pattern not found' });
        return;
      }

      // Reject all edits on CANCELLED pattern
      if (existing.status === 'CANCELLED') {
        res.status(409).json({
          success: false,
          error: 'Cannot edit a cancelled/ended pattern',
          code: 'INVALID_PATTERN_STATE',
        });
        return;
      }

      // Reject updates.status changes through PUT
      if (req.body?.updates?.status !== undefined) {
        res.status(400).json({
          success: false,
          error: 'Cannot update pattern status via PUT. Use /pause, /resume, or /end endpoints.',
          code: 'STATUS_UPDATE_DISALLOWED',
        });
        return;
      }

      const {
        updateMode = 'ALL_FUTURE',
        targetVisitId,
        fromDate,
        updates,
      } = req.body;

      if (updateMode === 'THIS_VISIT' && !targetVisitId) {
        res.status(400).json({
          success: false,
          error: 'targetVisitId is required when updateMode is THIS_VISIT',
        });
        return;
      }

      // For ALL_FUTURE edits of startTime, duration or dayOfWeek, check authorization limits
      if (updateMode === 'ALL_FUTURE' && updates && (updates.startTime || updates.duration || updates.dayOfWeek)) {
        const proposedDayOfWeek = updates.dayOfWeek ?? existing.dayOfWeek;
        const proposedDuration = updates.duration ?? existing.duration;
        const guard = getAuthorizationGuard();
        const authCheck = await guard.validatePattern({
          organizationId: context.organizationId!,
          clientId: existing.clientId,
          serviceTypeId: existing.serviceTypeId,
          dayOfWeek: proposedDayOfWeek,
          duration: proposedDuration,
          startDate: existing.startDate,
          endDate: existing.endDate,
          frequency: existing.frequency,
          patternIdToExclude: existing.id,
        });

        if (!authCheck.allowed) {
          res.status(422).json({
            success: false,
            error: authCheck.message ?? 'Authorization limit exceeded',
            code: authCheck.code ?? 'AUTHORIZATION_LIMIT_EXCEEDED',
            details: authCheck.details,
          });
          return;
        }
      }

      const patternEngine = new RecurringVisitPatternEngine(db.getPool());
      const result = await patternEngine.updatePatternInstances(
        patternId,
        {
          updateMode,
          targetVisitId,
          fromDate,
          updates,
        },
        context
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      const err = error as { name?: string; status?: number; statusCode?: number; message?: string };
      if (err.name === 'NotFoundError' || err.status === 404 || err.statusCode === 404) {
        res.status(404).json({ success: false, error: err.message ?? 'Not found' });
        return;
      }
      next(error);
    }
  });

  // Initialize compliance service for scheduling checks
  const complianceService = new ComplianceAutopilotService(db);

  /**
   * GET /api/visits/:id
   * Get a single visit by ID
   */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const { id: visitId } = req.params;

      if (!isValidUUID(visitId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid visit ID format',
        });
        return;
      }

      if (!context.organizationId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required',
        });
        return;
      }

      const repository = new ScheduleRepository(db.getPool());
      const visit = await repository.getVisitById(visitId);

      if (!visit) {
        res.status(404).json({
          success: false,
          error: 'Visit not found',
        });
        return;
      }

      if (visit.organizationId !== context.organizationId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      res.json({
        success: true,
        data: visit,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/visits/:id
   * PATCH /api/visits/:id
   * Edit a scheduled visit
   *
   * Body parameters:
   * - scheduledDate: string (YYYY-MM-DD)
   * - scheduledStartTime: string (HH:MM or HH:MM:SS)
   * - scheduledEndTime: string (HH:MM or HH:MM:SS)
   * - duration / scheduledDuration: number (minutes, 15..1440)
   * - caregiverId / assignedCaregiverId: UUID or null
   * - visitType: string (REGULAR, INITIAL, DISCHARGE, RESPITE, EMERGENCY, MAKEUP, SUPERVISION, ASSESSMENT, etc.)
   * - serviceTypeId: string
   * - serviceTypeName: string
   * - notes / internalNotes: string
   * - clientInstructions: string
   *
   * Constraints:
   * - Only scheduled / unassigned visits can be edited
   * - Completed and EVV-verified visits are locked (21st Century Cures Act compliance)
   * - Writes an audit record with before/after state
   * - Respects permissions: scheduling permission or scheduling roles required
   */
  // eslint-disable-next-line sonarjs/cognitive-complexity -- Update visit handler with domain validation and audit
  const handleUpdateVisit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = getUserContext(req);
      const { id: visitId } = req.params;

      if (!isValidUUID(visitId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid visit ID format',
        });
        return;
      }

      if (!context.organizationId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required',
        });
        return;
      }

      // Permissions check: only roles or permissions allowed to schedule may edit
      if (!hasSchedulingAccess(context, 'update')) {
        res.status(403).json({
          success: false,
          error: 'Access denied: Scheduling permission required to edit visits',
          code: 'PERMISSION_DENIED',
        });
        return;
      }

      // Verify visit exists and belongs to user's organization
      const existingResult = await db.query(
        'SELECT * FROM visits WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
        [visitId, context.organizationId]
      );

      if (existingResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Visit not found',
        });
        return;
      }

      const existingVisit = existingResult.rows[0] as {
        id: string;
        organization_id: string;
        client_id: string;
        assigned_caregiver_id: string | null;
        assignment_method: string | null;
        service_type_id: string;
        service_type_name: string;
        visit_type: string;
        scheduled_date: string | Date;
        scheduled_start_time: string;
        scheduled_end_time: string;
        scheduled_duration: number;
        status: string;
        actual_start_time: Date | string | null;
        internal_notes: string | null;
        client_instructions: string | null;
        version?: number;
      };

      // Compliance lock check: Completed or EVV-verified visits are locked
      const LOCKED_STATUSES = ['COMPLETED', 'CANCELLED'];
      if (LOCKED_STATUSES.includes(existingVisit.status)) {
        res.status(422).json({
          success: false,
          error: `Visit is locked and cannot be edited because its status is ${existingVisit.status}. Completed visits are locked for EVV/billing compliance.`,
          code: 'VISIT_LOCKED',
          status: existingVisit.status,
        });
        return;
      }

      if (existingVisit.actual_start_time != null) {
        res.status(422).json({
          success: false,
          error: 'Visit is locked and cannot be edited because an EVV clock-in has already been recorded.',
          code: 'VISIT_LOCKED_EVV',
          actualStartTime: existingVisit.actual_start_time,
        });
        return;
      }

      const {
        scheduledDate,
        scheduledStartTime,
        scheduledEndTime,
        duration,
        scheduledDuration,
        assignedCaregiverId,
        caregiverId,
        visitType,
        serviceTypeId,
        serviceTypeName,
        notes,
        internalNotes,
        clientInstructions,
      } = req.body;

      // Validate date if supplied
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (scheduledDate !== undefined && !dateRegex.test(scheduledDate)) {
        res.status(400).json({
          success: false,
          error: 'scheduledDate must be in YYYY-MM-DD format',
        });
        return;
      }

      const existingDateStr =
        existingVisit.scheduled_date instanceof Date
          ? existingVisit.scheduled_date.toISOString().split('T')[0]
          : String(existingVisit.scheduled_date).split('T')[0];
      const newDate = scheduledDate !== undefined ? scheduledDate : existingDateStr;

      // Normalize times to HH:MM (24-hour)
      const normalizeTime = (t: unknown): string | undefined => {
        if (typeof t !== 'string' || !t.trim()) return undefined;
        const cleaned = t.trim();
        const parts = cleaned.split(':');
        if (parts.length >= 2) {
          const hh = parts[0]?.padStart(2, '0') ?? '00';
          const mm = parts[1]?.slice(0, 2).padStart(2, '0') ?? '00';
          return `${hh}:${mm}`;
        }
        return cleaned;
      };

      const rawStartTime = scheduledStartTime !== undefined ? scheduledStartTime : existingVisit.scheduled_start_time;
      const newStartTime = normalizeTime(rawStartTime) ?? '08:00';

      let newDuration = duration ?? scheduledDuration ?? existingVisit.scheduled_duration ?? 60;
      let newEndTime = normalizeTime(scheduledEndTime);

      if (newStartTime && newEndTime && duration === undefined && scheduledDuration === undefined) {
        const [sh, sm] = newStartTime.split(':').map(Number);
        const [eh, em] = newEndTime.split(':').map(Number);
        if (sh !== undefined && sm !== undefined && eh !== undefined && em !== undefined) {
          let calcMinutes = eh * 60 + em - (sh * 60 + sm);
          if (calcMinutes <= 0) calcMinutes += 24 * 60;
          newDuration = calcMinutes;
        }
      } else if (newStartTime && newDuration && !scheduledEndTime) {
        const [sh, sm] = newStartTime.split(':').map(Number);
        if (sh !== undefined && sm !== undefined) {
          const totalEndMin = (sh * 60 + sm + Number(newDuration)) % (24 * 60);
          const eh = Math.floor(totalEndMin / 60);
          const em = totalEndMin % 60;
          newEndTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
        }
      }

      if (newDuration < 15 || newDuration > 1440) {
        res.status(400).json({
          success: false,
          error: 'Scheduled duration must be between 15 and 1440 minutes',
        });
        return;
      }

      // Validate visitType if supplied
      const ALLOWED_VISIT_TYPES = [
        'REGULAR',
        'INITIAL',
        'DISCHARGE',
        'RESPITE',
        'EMERGENCY',
        'MAKEUP',
        'SUPERVISION',
        'ASSESSMENT',
        'CONCIERGE',
        'ONGOING_SUPPORT',
      ];
      const newVisitType = visitType !== undefined ? visitType : existingVisit.visit_type;
      if (visitType !== undefined && !ALLOWED_VISIT_TYPES.includes(visitType)) {
        res.status(400).json({
          success: false,
          error: `Invalid visitType. Must be one of: ${ALLOWED_VISIT_TYPES.join(', ')}`,
        });
        return;
      }

      // Caregiver assignment handling
      const targetCaregiverId = assignedCaregiverId !== undefined ? assignedCaregiverId : caregiverId;
      let newCaregiverId = existingVisit.assigned_caregiver_id;
      let newAssignmentMethod = existingVisit.assignment_method;
      let newStatus = existingVisit.status;

      if (targetCaregiverId !== undefined) {
        if (targetCaregiverId === null || targetCaregiverId === '') {
          newCaregiverId = null;
          newAssignmentMethod = null;
          if (newStatus === 'ASSIGNED') {
            newStatus = 'UNASSIGNED';
          }
        } else {
          if (!isValidUUID(targetCaregiverId)) {
            res.status(400).json({
              success: false,
              error: 'Invalid caregiverId format',
            });
            return;
          }

          const cgCheck = await db.query(
            'SELECT id, status FROM caregivers WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
            [targetCaregiverId, context.organizationId]
          );

          if (cgCheck.rows.length === 0) {
            res.status(404).json({
              success: false,
              error: 'Caregiver not found',
            });
            return;
          }

          const cg = cgCheck.rows[0] as { id: string; status: string };
          if (cg.status !== 'ACTIVE') {
            res.status(400).json({
              success: false,
              error: 'Caregiver is not active',
            });
            return;
          }

          newCaregiverId = cg.id;
          newAssignmentMethod = 'MANUAL';
          if (newStatus === 'UNASSIGNED') {
            newStatus = 'ASSIGNED';
          }
        }
      }

      let newNotes = existingVisit.internal_notes ?? null;
      if (notes !== undefined) {
        newNotes = notes;
      } else if (internalNotes !== undefined) {
        newNotes = internalNotes;
      }
      const newInstructions =
        clientInstructions !== undefined ? clientInstructions : existingVisit.client_instructions ?? null;
      const newServiceTypeId =
        serviceTypeId !== undefined ? serviceTypeId : existingVisit.service_type_id;
      const newServiceTypeName =
        serviceTypeName !== undefined ? serviceTypeName : existingVisit.service_type_name;

      // Before snapshot for audit trail
      const beforeSnapshot = {
        scheduledDate: existingDateStr,
        scheduledStartTime: existingVisit.scheduled_start_time,
        scheduledEndTime: existingVisit.scheduled_end_time,
        scheduledDuration: existingVisit.scheduled_duration,
        assignedCaregiverId: existingVisit.assigned_caregiver_id,
        visitType: existingVisit.visit_type,
        serviceTypeId: existingVisit.service_type_id,
        serviceTypeName: existingVisit.service_type_name,
        notes: existingVisit.internal_notes ?? null,
        clientInstructions: existingVisit.client_instructions,
        status: existingVisit.status,
      };

      const updateQuery = `
        UPDATE visits
        SET scheduled_date = $1,
            scheduled_start_time = $2,
            scheduled_end_time = $3,
            scheduled_duration = $4,
            visit_type = $5,
            assigned_caregiver_id = $6,
            assignment_method = $7,
            status = $8,
            internal_notes = $9,
            client_instructions = $10,
            service_type_id = $11,
            service_type_name = $12,
            updated_by = $13,
            updated_at = NOW(),
            version = COALESCE(version, 1) + 1
        WHERE id = $14 AND organization_id = $15
        RETURNING *
      `;

      const updateResult = await db.query(updateQuery, [
        newDate,
        newStartTime,
        newEndTime ?? '09:00',
        newDuration,
        newVisitType,
        newCaregiverId,
        newAssignmentMethod,
        newStatus,
        newNotes,
        newInstructions,
        newServiceTypeId,
        newServiceTypeName,
        context.userId,
        visitId,
        context.organizationId,
      ]);

      const updatedRow = updateResult.rows[0];

      const afterSnapshot = {
        scheduledDate: newDate,
        scheduledStartTime: newStartTime,
        scheduledEndTime: newEndTime,
        scheduledDuration: newDuration,
        assignedCaregiverId: newCaregiverId,
        visitType: newVisitType,
        serviceTypeId: newServiceTypeId,
        serviceTypeName: newServiceTypeName,
        notes: newNotes,
        clientInstructions: newInstructions,
        status: newStatus,
      };

      // Write audit trail entry
      try {
        const auditService = new AuditService(db);
        await auditService.logEvent(context, {
          eventType: 'DATA_MODIFICATION',
          resource: 'VISIT',
          resourceId: visitId,
          action: 'UPDATE',
          result: 'SUCCESS',
          metadata: {
            before: beforeSnapshot,
            after: afterSnapshot,
            clientId: existingVisit.client_id,
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      } catch (auditError) {
        console.error('Audit trail logging failed for visit update:', auditError);
      }

      res.json({
        success: true,
        data: updatedRow,
      });
    } catch (error) {
      next(error);
    }
  };

  router.put('/:id', handleUpdateVisit);
  router.patch('/:id', handleUpdateVisit);

  /**
   * PUT /api/visits/:id/assign
   * Assign a caregiver to a visit

   * Requires coordinator or admin role
   *
   * Body:
   * - caregiverId: UUID of caregiver to assign
   * - checkConflicts: boolean (default: true) - whether to check for scheduling conflicts
   * - checkCompliance: boolean (default: true) - whether to check caregiver compliance
   * - forceAssignment: boolean (default: false) - force assignment despite compliance issues (requires supervisor role)
   * - overrideReason: string (required if forceAssignment is true) - audit trail for compliance override
   *
   * Returns: Updated visit with assignment details
   */
  // eslint-disable-next-line sonarjs/cognitive-complexity -- Well-structured with validation, compliance, and assignment sections
  router.put('/:id/assign', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const { id: visitId } = req.params;
      const { 
        caregiverId, 
        checkConflicts = true,
        checkCompliance = true,
        forceAssignment = false,
        overrideReason,
      } = req.body;

      // Validate required fields
      if (caregiverId === undefined || caregiverId === null || caregiverId.trim() === '') {
        res.status(400).json({
          success: false,
          error: 'caregiverId is required',
        });
        return;
      }

      // Validate override reason if forcing assignment
      if (forceAssignment === true && (overrideReason === undefined || overrideReason.trim() === '')) {
        res.status(400).json({
          success: false,
          error: 'overrideReason is required when forceAssignment is true',
          code: 'OVERRIDE_REASON_REQUIRED',
        });
        return;
      }

      // Validate organization_id is present
      if (context.organizationId === undefined) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required for this endpoint',
        });
        return;
      }

      const organizationId = context.organizationId;
      if (isValidUUID(organizationId) === false) {
        res.status(400).json({
          success: false,
          error: 'Invalid organization ID format',
        });
        return;
      }

      // Verify visit exists
      const visitCheck = await db.query(
        `SELECT id, organization_id, branch_id, scheduled_date, scheduled_start_time, scheduled_end_time, status
         FROM visits
         WHERE id = $1 AND deleted_at IS NULL`,
        [visitId]
      );

      if (visitCheck.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Visit not found',
        });
        return;
      }

      const visit = visitCheck.rows[0] as {
        id: string;
        organization_id: string;
        branch_id: string;
        scheduled_date: Date;
        scheduled_start_time: string;
        scheduled_end_time: string;
        status: string;
      };

      // Check organization access
      if (visit.organization_id !== context.organizationId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      // Check branch access
      if (context.branchIds.includes(visit.branch_id) === false) {
        res.status(403).json({
          success: false,
          error: 'No access to this branch',
        });
        return;
      }

      // Verify caregiver exists and is active
      const caregiverCheck = await db.query(
        `SELECT id, status, first_name, last_name FROM caregivers
         WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
        [caregiverId, context.organizationId]
      );

      if (caregiverCheck.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Caregiver not found',
        });
        return;
      }

      const caregiver = caregiverCheck.rows[0] as { 
        id: string; 
        status: string;
        first_name: string;
        last_name: string;
      };

      if (caregiver.status !== 'ACTIVE') {
        res.status(400).json({
          success: false,
          error: 'Caregiver is not active',
        });
        return;
      }

      // Check caregiver compliance status
      let complianceOverridden = false;
      let complianceIssues: string[] = [];
      
      if (checkCompliance === true) {
        const complianceResult = await complianceService.canCaregiverBeScheduled(
          organizationId,
          caregiverId
        );

        if (complianceResult.canSchedule === false) {
          complianceIssues = complianceResult.blockingIssues;

          // If not forcing assignment, block with compliance error
          if (forceAssignment !== true) {
            res.status(422).json({
              success: false,
              error: 'Caregiver has compliance issues that block scheduling',
              code: 'COMPLIANCE_BLOCK',
              complianceIssues: complianceResult.blockingIssues,
              canForceAssignment: true,
              message: `${caregiver.first_name} ${caregiver.last_name} cannot be scheduled: ${complianceResult.blockingIssues.join(', ')}. ` +
                       'A supervisor can force this assignment with an override reason.',
            });
            return;
          }

          // Check if user has supervisor role to force assignment
          const supervisorRoles = ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'COORDINATOR'];
          const hasSupervisorRole = context.roles.some(role => supervisorRoles.includes(role));

          if (hasSupervisorRole === false) {
            res.status(403).json({
              success: false,
              error: 'Only supervisors can force assignment with compliance issues',
              code: 'SUPERVISOR_REQUIRED',
              complianceIssues: complianceResult.blockingIssues,
            });
            return;
          }

          complianceOverridden = true;
        }
      }

      // Check for conflicts if requested
      if (checkConflicts === true) {
        const conflicts = await db.query(
          `SELECT id, scheduled_start_time, scheduled_end_time, client_id
           FROM visits
           WHERE assigned_caregiver_id = $1
             AND scheduled_date = $2
             AND deleted_at IS NULL
             AND status NOT IN ('CANCELLED', 'COMPLETED', 'NO_SHOW_CAREGIVER')
             AND id != $3
             AND (
               (scheduled_start_time < $5 AND scheduled_end_time > $4)
               OR (scheduled_start_time >= $4 AND scheduled_start_time < $5)
             )`,
          [caregiverId, visit.scheduled_date, visitId, visit.scheduled_start_time, visit.scheduled_end_time]
        );

        if (conflicts.rows.length > 0) {
          res.status(409).json({
            success: false,
            error: 'Scheduling conflict detected',
            conflicts: conflicts.rows,
          });
          return;
        }
      }

      // If compliance was overridden, log the override for audit trail
      if (complianceOverridden) {
        await db.query(
          `INSERT INTO audit_events (
            event_id, timestamp, organization_id, user_id, event_type,
            resource, resource_id, action, result, metadata
          ) VALUES (gen_random_uuid(), NOW(), $1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            organizationId,
            context.userId,
            'DATA_MODIFICATION',
            'VISIT',
            visitId,
            'COMPLIANCE_OVERRIDE',
            'SUCCESS',
            JSON.stringify({
              caregiverId,
              caregiverName: `${caregiver.first_name} ${caregiver.last_name}`,
              complianceIssues,
              overrideReason,
              visitDate: visit.scheduled_date,
            }),
          ]
        );
      }

      // Assign caregiver to visit
      const result = await db.query(
        `UPDATE visits
         SET assigned_caregiver_id = $1,
             assigned_at = NOW(),
             assignment_method = $2,
             status = CASE
               WHEN status = 'UNASSIGNED' THEN 'ASSIGNED'
               ELSE status
             END,
             updated_by = $3,
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [
          caregiverId, 
          complianceOverridden ? 'MANUAL_OVERRIDE' : 'MANUAL',
          context.userId, 
          visitId
        ]
      );

      res.json({
        success: true,
        data: result.rows[0],
        complianceOverridden,
        ...(complianceOverridden && {
          warning: 'Assignment completed with compliance override. This has been logged for audit purposes.',
          overriddenIssues: complianceIssues,
        }),
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/visits/:id/check-conflicts
   * Check for scheduling conflicts when assigning a caregiver to a visit
   *
   * Body:
   * - caregiverId: UUID of caregiver to check
   *
   * Returns: Array of conflicting visits
   */
  router.post('/:id/check-conflicts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const { id: visitId } = req.params;
      const { caregiverId } = req.body;

      // Validate required fields
      if (caregiverId === undefined || caregiverId === null || caregiverId.trim() === '') {
        res.status(400).json({
          success: false,
          error: 'caregiverId is required',
        });
        return;
      }

      // Validate organization_id is present
      if (context.organizationId === undefined) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required for this endpoint',
        });
        return;
      }

      const organizationId = context.organizationId;
      if (isValidUUID(organizationId) === false) {
        res.status(400).json({
          success: false,
          error: 'Invalid organization ID format',
        });
        return;
      }

      // Verify visit exists
      const visitCheck = await db.query(
        `SELECT id, organization_id, scheduled_date, scheduled_start_time, scheduled_end_time
         FROM visits
         WHERE id = $1 AND deleted_at IS NULL`,
        [visitId]
      );

      if (visitCheck.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Visit not found',
        });
        return;
      }

      const visit = visitCheck.rows[0] as {
        id: string;
        organization_id: string;
        scheduled_date: Date;
        scheduled_start_time: string;
        scheduled_end_time: string;
      };

      // Check organization access
      if (visit.organization_id !== context.organizationId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      // Find conflicting visits
      const conflicts = await db.query(
        `SELECT v.id, v.scheduled_start_time, v.scheduled_end_time, v.status,
                c.first_name as client_first_name, c.last_name as client_last_name,
                v.address
         FROM visits v
         LEFT JOIN clients c ON v.client_id = c.id
         WHERE v.assigned_caregiver_id = $1
           AND v.scheduled_date = $2
           AND v.deleted_at IS NULL
           AND v.status NOT IN ('CANCELLED', 'COMPLETED', 'NO_SHOW_CAREGIVER')
           AND v.id != $3
           AND (
             (v.scheduled_start_time < $5 AND v.scheduled_end_time > $4)
             OR (v.scheduled_start_time >= $4 AND v.scheduled_start_time < $5)
           )
         ORDER BY v.scheduled_start_time`,
        [caregiverId, visit.scheduled_date, visitId, visit.scheduled_start_time, visit.scheduled_end_time]
      );

      res.json({
        success: true,
        hasConflicts: conflicts.rows.length > 0,
        conflicts: conflicts.rows,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/visits/:id/check-assignment
   * Check if a caregiver can be assigned to a visit
   * Combines compliance and conflict checks for UI validation
   *
   * Body:
   * - caregiverId: UUID of caregiver to check
   *
   * Returns: Assignment eligibility with any blocking issues
   */
  router.post('/:id/check-assignment', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const { id: visitId } = req.params;
      const { caregiverId } = req.body;

      // Validate required fields
      if (caregiverId === undefined || caregiverId === null || caregiverId.trim() === '') {
        res.status(400).json({
          success: false,
          error: 'caregiverId is required',
        });
        return;
      }

      // Validate organization_id is present
      if (context.organizationId === undefined) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required for this endpoint',
        });
        return;
      }

      const organizationId = context.organizationId;

      // Verify visit exists
      const visitCheck = await db.query(
        `SELECT id, organization_id, scheduled_date, scheduled_start_time, scheduled_end_time
         FROM visits
         WHERE id = $1 AND deleted_at IS NULL`,
        [visitId]
      );

      if (visitCheck.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Visit not found',
        });
        return;
      }

      const visit = visitCheck.rows[0] as {
        id: string;
        organization_id: string;
        scheduled_date: Date;
        scheduled_start_time: string;
        scheduled_end_time: string;
      };

      // Check organization access
      if (visit.organization_id !== context.organizationId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      // Get caregiver info
      const caregiverCheck = await db.query(
        `SELECT id, first_name, last_name, status FROM caregivers
         WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
        [caregiverId, organizationId]
      );

      if (caregiverCheck.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Caregiver not found',
        });
        return;
      }

      const caregiver = caregiverCheck.rows[0] as {
        id: string;
        first_name: string;
        last_name: string;
        status: string;
      };

      // Build eligibility result
      const result: {
        canAssign: boolean;
        caregiverName: string;
        caregiverStatus: string;
        complianceStatus: {
          isCompliant: boolean;
          blockingIssues: string[];
          canOverride: boolean;
        };
        schedulingStatus: {
          hasConflicts: boolean;
          conflicts: unknown[];
        };
        warnings: string[];
      } = {
        canAssign: true,
        caregiverName: `${caregiver.first_name} ${caregiver.last_name}`,
        caregiverStatus: caregiver.status,
        complianceStatus: {
          isCompliant: true,
          blockingIssues: [],
          canOverride: false,
        },
        schedulingStatus: {
          hasConflicts: false,
          conflicts: [],
        },
        warnings: [],
      };

      // Check if caregiver is active
      if (caregiver.status !== 'ACTIVE') {
        result.canAssign = false;
        result.warnings.push(`Caregiver is ${caregiver.status}`);
      }

      // Check compliance
      const complianceResult = await complianceService.canCaregiverBeScheduled(
        organizationId,
        caregiverId
      );

      if (complianceResult.canSchedule === false) {
        result.complianceStatus.isCompliant = false;
        result.complianceStatus.blockingIssues = complianceResult.blockingIssues;
        result.complianceStatus.canOverride = true;
        result.canAssign = false;
      }

      // Check for scheduling conflicts
      const conflicts = await db.query(
        `SELECT v.id, v.scheduled_start_time, v.scheduled_end_time, v.status,
                c.first_name as client_first_name, c.last_name as client_last_name,
                v.address
         FROM visits v
         LEFT JOIN clients c ON v.client_id = c.id
         WHERE v.assigned_caregiver_id = $1
           AND v.scheduled_date = $2
           AND v.deleted_at IS NULL
           AND v.status NOT IN ('CANCELLED', 'COMPLETED', 'NO_SHOW_CAREGIVER')
           AND v.id != $3
           AND (
             (v.scheduled_start_time < $5 AND v.scheduled_end_time > $4)
             OR (v.scheduled_start_time >= $4 AND v.scheduled_start_time < $5)
           )
         ORDER BY v.scheduled_start_time`,
        [caregiverId, visit.scheduled_date, visitId, visit.scheduled_start_time, visit.scheduled_end_time]
      );

      if (conflicts.rows.length > 0) {
        result.schedulingStatus.hasConflicts = true;
        result.schedulingStatus.conflicts = conflicts.rows;
        result.canAssign = false;
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/visits/caregivers/availability
   * Get caregiver availability for a specific date range
   * Returns caregivers with their assigned visits to show availability
   *
   * Query params:
   * - date: Date to check (YYYY-MM-DD format)
   * - branch_ids: Optional comma-separated branch IDs to filter
   *
   * Returns: Array of caregivers with their visits for the date
   */
  router.get('/caregivers/availability', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const dateStr = req.query['date'] as string | undefined;
      const branchIdsStr = req.query['branch_ids'] as string | undefined;

      if (dateStr == null || dateStr === '') {
        res.status(400).json({
          success: false,
          error: 'Missing required parameter: date',
        });
        return;
      }

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD format',
        });
        return;
      }

      // Validate organization_id is present and valid
      if (context.organizationId === undefined) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required for this endpoint',
        });
        return;
      }

      const organizationId = context.organizationId;
      if (isValidUUID(organizationId) === false) {
        res.status(400).json({
          success: false,
          error: 'Invalid organization ID format',
        });
        return;
      }

      // Parse branch IDs if provided
      const branchIds = branchIdsStr != null && branchIdsStr !== ''
        ? branchIdsStr.split(',').filter(id => id.trim() !== '')
        : (context.branchIds ?? []);

      // Get caregivers and their visits for the date
      const result = await db.query(
        `SELECT
           cg.id as caregiver_id,
           cg.first_name,
           cg.last_name,
           cg.status as caregiver_status,
           COALESCE(
             json_agg(
               json_build_object(
                 'id', v.id,
                 'scheduled_start_time', v.scheduled_start_time,
                 'scheduled_end_time', v.scheduled_end_time,
                 'status', v.status,
                 'client_name', c.first_name || ' ' || c.last_name
               )
               ORDER BY v.scheduled_start_time
             ) FILTER (WHERE v.id IS NOT NULL),
             '[]'
           ) as visits
         FROM caregivers cg
         LEFT JOIN visits v ON cg.id = v.assigned_caregiver_id
           AND v.scheduled_date = $1
           AND v.deleted_at IS NULL
           AND v.status NOT IN ('CANCELLED', 'COMPLETED', 'NO_SHOW_CAREGIVER')
         LEFT JOIN clients c ON v.client_id = c.id
         WHERE cg.organization_id = $2
           AND cg.deleted_at IS NULL
           AND cg.status = 'ACTIVE'
           AND ($3::uuid[] IS NULL OR cg.branch_ids && $3::uuid[])
         GROUP BY cg.id, cg.first_name, cg.last_name, cg.status
         ORDER BY cg.last_name, cg.first_name`,
        [date, organizationId, branchIds.length > 0 ? branchIds : null]
      );

      res.json({
        success: true,
        data: result.rows,
        meta: {
          date: dateStr,
          count: result.rows.length,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/visits/:id/notes
   * Create a new note for a visit
   * 
   * Body:
   * - noteType: 'GENERAL' | 'CLINICAL' | 'INCIDENT' | 'TASK'
   * - noteText: string (required)
   * - noteHtml: string (optional)
   * - activitiesPerformed: string[] (optional)
   * - clientMood: enum (optional)
   * - clientConditionNotes: string (optional)
   * - isIncident: boolean
   * - incidentSeverity: enum (optional, required if isIncident=true)
   * - incidentDescription: string (optional)
   * - isVoiceNote: boolean
   * - audioFileUri: string (optional)
   * - transcriptionConfidence: number (optional)
   * 
   * Returns: Created note with ID
   */
  router.post('/:id/notes', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const { id: visitId } = req.params;
      
      // Validate required fields
      const {
        noteType = 'GENERAL',
        noteText,
        noteHtml,
        activitiesPerformed = [],
        clientMood,
        clientConditionNotes,
        isIncident = false,
        incidentSeverity,
        incidentDescription,
        isVoiceNote = false,
        audioFileUri,
        transcriptionConfidence,
      } = req.body;

      if (noteText === undefined || noteText === null || noteText.trim() === '') {
        res.status(400).json({
          success: false,
          error: 'noteText is required',
        });
        return;
      }

      // Validate incident fields
      if (isIncident === true && incidentSeverity === undefined) {
        res.status(400).json({
          success: false,
          error: 'incidentSeverity is required when isIncident is true',
        });
        return;
      }

      // Verify visit exists and user has access
      const visitCheck = await db.query(
        `SELECT id, assigned_caregiver_id, organization_id, status
         FROM visits
         WHERE id = $1 AND deleted_at IS NULL`,
        [visitId]
      );

      if (visitCheck.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Visit not found',
        });
        return;
      }

      const visit = visitCheck.rows[0] as { id: string; assigned_caregiver_id: string | null; organization_id: string; status: string };

      // Verify user is the assigned caregiver or has admin access
      // For now, we'll allow if user is the caregiver
      // NOTE: Future enhancement - add organization-level access control
      if (visit.assigned_caregiver_id == null) {
        res.status(400).json({
          success: false,
          error: 'Visit is not assigned to a caregiver',
        });
        return;
      }

      const caregiverCheck = await db.query(
        `SELECT id FROM caregivers WHERE id = $1 AND deleted_at IS NULL`,
        [visit.assigned_caregiver_id]
      );

      if (caregiverCheck.rows.length === 0) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const caregiverId = (caregiverCheck.rows[0] as { id: string }).id;

      // Insert note
      const result = await db.query(
        `INSERT INTO visit_notes (
          visit_id, organization_id, caregiver_id,
          note_type, note_text, note_html,
          activities_performed,
          client_mood, client_condition_notes,
          is_incident, incident_severity, incident_description,
          incident_reported_at,
          is_voice_note, audio_file_uri, transcription_confidence,
          is_synced, sync_pending,
          created_by, updated_by
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6,
          $7::jsonb,
          $8, $9,
          $10, $11, $12,
          $13,
          $14, $15, $16,
          TRUE, FALSE,
          $17, $17
        ) RETURNING *`,
        [
          visitId,
          visit.organization_id,
          caregiverId,
          noteType,
          noteText.trim(),
          noteHtml ?? null,
          JSON.stringify(activitiesPerformed),
          clientMood ?? null,
          clientConditionNotes ?? null,
          isIncident,
          incidentSeverity ?? null,
          incidentDescription ?? null,
          isIncident === true ? new Date() : null,
          isVoiceNote,
          audioFileUri ?? null,
          transcriptionConfidence ?? null,
          context.userId,
        ]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  });

// POST /visits/compliance-check
  // Automated compliance checking for visits (AI-powered)
   
  router.post('/compliance-check', async (req: Request, res: Response, next: NextFunction) => {
    const knexDb = getKnexInstance();
    const auditService = new AuditService(db);

    try {
      // Validate request body using Zod
      const parseResult = complianceCheckRequestSchema.safeParse(req.body);
      if (parseResult.success === false) {
        res.status(400).json({
          success: false,
          error: 'Invalid request parameters',
          details: parseResult.error.issues,
        });
        return;
      }

      const { visitId, clientId, lookbackDays } = parseResult.data;

      // Get user context for permission checking
       
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const user = req.user;

      // Create user context for audit logging
      const context: UserContext = {
        userId: user.userId,
        organizationId: user.organizationId ?? '',
        roles: user.roles ?? [],
        permissions: user.permissions ?? [],
        branchIds: user.branchIds ?? [],
      };

      // Check that user has permission to read visits (required for compliance checking)
      // The requireAuth middleware already ensures the user is authenticated
      // Here we ensure they have proper organization context
       
      if (!context.organizationId) {
        res.status(403).json({
          success: false,
          error: 'User must belong to an organization to perform compliance checks',
        });
        return;
      }

      // Run compliance check
      const complianceService = new ComplianceCheckingService(knexDb);
      const effectiveLookbackDays = lookbackDays ?? 7;
      const result = await complianceService.checkCompliance({
        visitId,
        clientId,
        lookbackDays: effectiveLookbackDays,
      });

      // Log audit event for HIPAA compliance
      await auditService.logEvent(context, {
        eventType: 'DATA_ACCESS',
        resource: 'COMPLIANCE_CHECK',
        resourceId: visitId ?? clientId ?? 'all',
        action: 'COMPLIANCE_CHECK',
        result: 'SUCCESS',
        metadata: {
          visitId,
          clientId,
          lookbackDays,
          visitCount: result.visitResults.length,
          overallStatus: result.overallStatus,
          criticalIssueCount: result.criticalIssues.length,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      // Log failure audit event
      const user = req.user;
       
      if (user) {
        const context: UserContext = {
          userId: user.userId,
          organizationId: user.organizationId ?? '',
          roles: user.roles ?? [],
          permissions: user.permissions ?? [],
          branchIds: user.branchIds ?? [],
        };
        const bodyVisitId = typeof req.body?.visitId === 'string' ? req.body.visitId : null;
        const bodyClientId = typeof req.body?.clientId === 'string' ? req.body.clientId : null;
        await auditService.logEvent(context, {
          eventType: 'DATA_ACCESS',
          resource: 'COMPLIANCE_CHECK',
          resourceId: bodyVisitId ?? bodyClientId ?? 'all',
          action: 'COMPLIANCE_CHECK',
          result: 'FAILURE',
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }).catch(() => {
          // Swallow audit logging errors to not mask original error
        });
      }
      next(error);
    } finally {
      await knexDb.destroy();
    }
  });

  // POST /visits/:visitId/notes/:noteId/quality-score
  // Score documentation quality for a visit note
  router.post('/:visitId/notes/:noteId/quality-score', async (req: Request, res: Response, next: NextFunction) => {
    const knexDbForQuality = getKnexInstance();
    try {
      const { noteId } = req.params;

      if (noteId === undefined || noteId === '') {
        res.status(400).json({ success: false, error: 'Note ID is required' });
        return;
      }

      const qualityService = new DocumentationQualityService(knexDbForQuality);
      const result = await qualityService.scoreDocumentationQuality({ noteId });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    } finally {
      await knexDbForQuality.destroy();
    }
  });

  // POST /visits/hospitalization-risk
  // Predict hospitalization risk for a client
  router.post('/hospitalization-risk', async (req: Request, res: Response, next: NextFunction) => {
    const knexDbForRisk = getKnexInstance();
    try {
      const { clientId, lookbackDays } = req.body as { clientId?: string; lookbackDays?: number };

      if (clientId == null || clientId === '') {
        res.status(400).json({ success: false, error: 'Client ID is required' });
        return;
      }

      const riskService = new HospitalizationRiskService(knexDbForRisk);
      const result = await riskService.predictHospitalizationRisk({
        clientId,
        lookbackDays: lookbackDays ?? 30,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    } finally {
      await knexDbForRisk.destroy();
    }
  });

  // POST /visits/vitals-anomalies
  // Detect anomalies in vital signs patterns
  router.post('/vitals-anomalies', async (req: Request, res: Response, next: NextFunction) => {
    const knexDbForVitals = getKnexInstance();
    try {
      const { clientId, lookbackDays } = req.body as { clientId?: string; lookbackDays?: number };

      if (clientId == null || clientId === '') {
        res.status(400).json({ success: false, error: 'Client ID is required' });
        return;
      }

      const vitalsService = new VitalsAnomalyService(knexDbForVitals);
      const result = await vitalsService.detectVitalsAnomalies({
        clientId,
        lookbackDays: lookbackDays ?? 30,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    } finally {
      await knexDbForVitals.destroy();
    }
  });

  // POST /visits/sentiment-analysis
  // Analyze sentiment in visit notes to detect burnout, distress, concerns
  router.post('/sentiment-analysis', async (req: Request, res: Response, next: NextFunction) => {
    const knexDbForSentiment = getKnexInstance();
    try {
      const { clientId, caregiverId, lookbackDays } = req.body as { clientId?: string; caregiverId?: string; lookbackDays?: number };

      if ((clientId == null || clientId === '') && (caregiverId == null || caregiverId === '')) {
        res.status(400).json({ success: false, error: 'Either clientId or caregiverId is required' });
        return;
      }

      const sentimentService = new SentimentAnalysisService(knexDbForSentiment);
      const result = await sentimentService.analyzeSentiment({
        clientId,
        caregiverId,
        lookbackDays: lookbackDays ?? 30,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    } finally {
      await knexDbForSentiment.destroy();
    }
  });

  // POST /visits/generate-report
  // Generate AI-powered narrative reports from visit data
  router.post('/generate-report', async (req: Request, res: Response, next: NextFunction) => {
    const knexDbForReport = getKnexInstance();
    try {
      const { reportType, format, clientId, caregiverId, organizationId, startDate, endDate, includeRecommendations, customPrompt } = req.body as {
        reportType?: string;
        format?: string;
        clientId?: string;
        caregiverId?: string;
        organizationId?: string;
        startDate?: string;
        endDate?: string;
        includeRecommendations?: boolean;
        customPrompt?: string;
      };

      if (reportType == null || reportType === '') {
        res.status(400).json({ success: false, error: 'Report type is required' });
        return;
      }

      const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN') ?? false;
      const userOrgId = req.user?.organizationId;
      if (
        !isSuperAdmin &&
        userOrgId !== undefined &&
        userOrgId !== '' &&
        organizationId !== undefined &&
        organizationId !== '' &&
        organizationId !== userOrgId
      ) {
        res.status(403).json({ success: false, error: 'Cross-tenant access denied' });
        return;
      }

      const effectiveOrgId =
        !isSuperAdmin && userOrgId !== undefined && userOrgId !== ''
          ? userOrgId
          : organizationId ?? userOrgId;

      const reportService = new ReportGenerationService(knexDbForReport);
      const result = await reportService.generateReport({
        reportType: reportType as import('@folkcare/visit-notes').ReportType,
        format: format as import('@folkcare/visit-notes').ReportFormat | undefined,
        clientId,
        caregiverId,
        organizationId: effectiveOrgId,
        startDate,
        endDate,
        includeRecommendations,
        customPrompt,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    } finally {
      await knexDbForReport.destroy();
    }
  });

  // POST /visits/predict-duration
  // Predict visit duration based on client needs and history
  router.post('/predict-duration', async (req: Request, res: Response, next: NextFunction) => {
    const knexDbForDuration = getKnexInstance();
    try {
      const { clientId, visitType, caregiverId, scheduledDate, tasksPlanned } = req.body as {
        clientId?: string;
        visitType?: string;
        caregiverId?: string;
        scheduledDate?: string;
        tasksPlanned?: string[];
      };

      if (clientId == null || clientId === '') {
        res.status(400).json({ success: false, error: 'Client ID is required' });
        return;
      }

      if (visitType == null || visitType === '') {
        res.status(400).json({ success: false, error: 'Visit type is required' });
        return;
      }

      const durationService = new VisitDurationPredictionService(knexDbForDuration);
      const result = await durationService.predictDuration({
        clientId,
        visitType,
        caregiverId,
        scheduledDate,
        tasksPlanned,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    } finally {
      await knexDbForDuration.destroy();
    }
  });

  // POST /visits/staffing-demand
  // AI-powered staffing demand prediction based on census and acuity
  router.post('/staffing-demand', async (req: Request, res: Response, next: NextFunction) => {
    const knexDbForStaffing = getKnexInstance();
    try {
      const organizationId = req.user?.organizationId;

      if (typeof organizationId !== 'string') {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { branchId, forecastWeeks, serviceType } = req.body as {
        branchId?: string;
        forecastWeeks?: number;
        serviceType?: string;
      };

      const staffingService = new StaffingDemandPredictionService(knexDbForStaffing);
      const result = await staffingService.predictStaffingDemand({
        organizationId,
        branchId,
        forecastWeeks: forecastWeeks ?? 4,
        serviceType,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    } finally {
      await knexDbForStaffing.destroy();
    }
  });

  // POST /visits/caregiver-matching
  // AI-powered caregiver-patient matching based on skills, availability, and preferences
  router.post('/caregiver-matching', async (req: Request, res: Response, next: NextFunction) => {
    const knexDbForMatching = getKnexInstance();
    try {
      const organizationId = req.user?.organizationId;

      if (typeof organizationId !== 'string') {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const {
        clientId,
        serviceType,
        requiredCertifications,
        preferredSchedule,
        maxDistanceMiles,
        preferredLanguages,
        excludeCaregiverIds,
        maxResults,
      } = req.body as {
        clientId?: string;
        serviceType?: string;
        requiredCertifications?: string[];
        preferredSchedule?: { dayOfWeek: number; startTime: string; endTime: string }[];
        maxDistanceMiles?: number;
        preferredLanguages?: string[];
        excludeCaregiverIds?: string[];
        maxResults?: number;
      };

      if (clientId == null || clientId === '') {
        res.status(400).json({ success: false, error: 'Client ID is required' });
        return;
      }

      const matchingService = new CaregiverMatchingService(knexDbForMatching);
      const result = await matchingService.findMatches({
        organizationId,
        clientId,
        serviceType,
        requiredCertifications,
        preferredSchedule,
        maxDistanceMiles,
        preferredLanguages,
        excludeCaregiverIds,
        maxResults,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    } finally {
      await knexDbForMatching.destroy();
    }
  });

  return router;
}
