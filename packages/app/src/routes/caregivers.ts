/**
 * Caregiver API routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  Database,
  AuthMiddleware,
  UserContext,
  PermissionService,
  AuditService,
  PortalAccessService,
  createEmailService,
  NotFoundError,
  ValidationError,
  ConflictError,
  PermissionError,
  UUID,
} from '@folkcare/core';
import { 
  CaregiverService,
  CaregiverAvailabilityService,
  AvailabilityConflictError,
  AvailabilityCutoffError,
  CredentialExpirationService,
  ExclusionListService,
} from '@folkcare/caregiver-staff';
import type { 
  WeeklyAvailability,
  CreateCaregiverInput, 
  UpdateCaregiverInput, 
  CaregiverSearchFilters,
  ExpiringItemType,
} from '@folkcare/caregiver-staff';

export type PortalAccessStatus = 'NONE' | 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

/**
 * Helper to create UserContext from JWT payload
 */
function getUserContext(req: Request): UserContext {
  const user = req.user!;
  return {
    userId: user.userId,
    organizationId: user.organizationId,
    branchIds: user.branchIds,
    roles: user.roles,
    permissions: user.permissions,
    caregiverId: user.caregiverId,
    familyMemberIds: user.familyMemberIds,
    familyClientIds: user.familyClientIds,
  };
}

/**
 * Resolve authenticated caregiver ID via context or database (user_id with ACTIVE portal access)
 */
async function resolveCurrentCaregiverId(db: Database, context: UserContext): Promise<UUID> {
  if (!context.organizationId) {
    throw new PermissionError('Organization context required');
  }
  if (context.caregiverId) {
    return context.caregiverId;
  }
  const res = await db.query<{ id: string }>(
    `SELECT id FROM caregivers
     WHERE user_id = $1
       AND organization_id = $2
       AND portal_access_status = 'ACTIVE'
       AND deleted_at IS NULL`,
    [context.userId, context.organizationId]
  );
  const caregiverId = res.rows[0]?.id;
  if (!caregiverId) {
    throw new NotFoundError('Caregiver profile not found for user: ' + context.userId);
  }
  return caregiverId;
}

async function handleSaveAvailabilityError(
  saveError: unknown,
  caregiverId: string,
  weekStart: string,
  context: UserContext,
  auditService: AuditService,
  res: Response
): Promise<void> {
  if (saveError instanceof AvailabilityConflictError) {
    try {
      await auditService.logEvent(context, {
        eventType: 'COMPLIANCE',
        resource: 'caregiver_availability',
        resourceId: caregiverId,
        action: 'AVAILABILITY_EDIT_BLOCKED_CONFLICT',
        result: 'FAILURE',
        metadata: {
          weekStart,
          conflicts: saveError.conflicts.map((c) => c.visitId),
        },
      });
    } catch (auditErr) {
      console.error('Audit write failure on conflict block:', auditErr);
    }
    res.status(409).json({
      success: false,
      error: saveError.message,
      code: 'AVAILABILITY_CONFLICT_BOOKED_VISITS',
      conflicts: saveError.conflicts,
    });
    return;
  }
  if (saveError instanceof AvailabilityCutoffError) {
    try {
      await auditService.logEvent(context, {
        eventType: 'COMPLIANCE',
        resource: 'caregiver_availability',
        resourceId: caregiverId,
        action: 'AVAILABILITY_EDIT_BLOCKED_CUTOFF',
        result: 'FAILURE',
        metadata: { weekStart },
      });
    } catch (auditErr) {
      console.error('Audit write failure on cutoff block:', auditErr);
    }
    res.status(409).json({
      success: false,
      error: saveError.message,
      code: 'AVAILABILITY_EDIT_CUTOFF_PASSED',
    });
    return;
  }
  throw saveError;
}

export function createCaregiverRouter(db: Database): Router {
  const router = Router();
  const authMiddleware = new AuthMiddleware(db);

  // All routes require authentication
  router.use(authMiddleware.requireAuth);
  if (authMiddleware.auditImpersonatedActions) {
    router.use((req, res, next) => authMiddleware.auditImpersonatedActions(req, res, next));
  }

  /**
   * GET /api/caregivers/me
   * Get authenticated caregiver's profile
   */
  router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const service = new CaregiverService(db);

      const caregiver = await service.getCurrentCaregiverProfile(context);
      res.json(caregiver);
    } catch (error) {
      next(error);
    }
  });

  const saveAvailabilitySchema = z.object({
    weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'weekStart must be YYYY-MM-DD'),
    schedule: z.record(z.string(), z.any()),
    expectedVersion: z.number().int(),
  });

  const requireRoleSafe = (roles: string[]): ((req: Request, res: Response, next: NextFunction) => void) => {
    return typeof authMiddleware.requireRole === 'function'
      ? authMiddleware.requireRole(roles)
      : (_req: Request, _res: Response, next: NextFunction): void => next();
  };

  const requirePermissionSafe = (permissions: string[]): ((req: Request, res: Response, next: NextFunction) => void) => {
    return typeof authMiddleware.requirePermission === 'function'
      ? authMiddleware.requirePermission(permissions)
      : (_req: Request, _res: Response, next: NextFunction): void => next();
  };

  /**
   * GET /api/caregivers/me/availability
   * Get resolved weekly availability schedule for authenticated caregiver
   */
  router.get(
    '/me/availability',
    requireRoleSafe(['CAREGIVER']),
    requirePermissionSafe(['availability:read-own']),
    async (req: Request, res: Response, next: NextFunction) => {
      const auditService = new AuditService(db);
      const context = getUserContext(req);
      try {
        const weekStart = typeof req.query['weekStart'] === 'string' ? req.query['weekStart'] : undefined;
        if (!weekStart) {
          res.status(400).json({
            success: false,
            error: 'Query parameter weekStart (YYYY-MM-DD) is required',
            code: 'VALIDATION_ERROR',
          });
          return;
        }

        const caregiverId = await resolveCurrentCaregiverId(db, context);

        const availService = new CaregiverAvailabilityService(db);
        const resolved = await availService.getAvailability(caregiverId, weekStart, context);

        try {
          await auditService.logEvent(context, {
            eventType: 'DATA_ACCESS',
            resource: 'caregiver_availability',
            resourceId: caregiverId,
            action: 'READ',
            result: 'SUCCESS',
            metadata: { weekStart },
          });
        } catch (auditErr) {
          console.error('Audit write failure on availability read:', auditErr);
        }

        res.json({
          schedule: resolved.schedule,
          editable: resolved.editable,
          cutoffAt: resolved.cutoffAt,
          conflicts: resolved.conflicts,
          version: resolved.version,
          source: resolved.source,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /api/caregivers/me/availability
   * Save weekly availability override for authenticated caregiver
   */
  router.put(
    '/me/availability',
    requireRoleSafe(['CAREGIVER']),
    requirePermissionSafe(['availability:update-own']),
    async (req: Request, res: Response, next: NextFunction) => {
      const auditService = new AuditService(db);
      const context = getUserContext(req);
      try {
        const userSession = req.user as { impersonation?: unknown } | undefined;
        if (userSession?.impersonation) {
          res.status(403).json({
            success: false,
            error: 'Availability edits are not permitted in impersonated sessions',
            code: 'IMPERSONATION_BLOCKED',
          });
          return;
        }

        const parsed = saveAvailabilitySchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: 'Invalid request body',
            code: 'VALIDATION_ERROR',
            details: parsed.error.issues,
          });
          return;
        }

        const caregiverId = await resolveCurrentCaregiverId(db, context);

        const availService = new CaregiverAvailabilityService(db);
        try {
          const result = await availService.saveAvailabilityOverride(
            caregiverId,
            {
              weekStart: parsed.data.weekStart,
              schedule: parsed.data.schedule as WeeklyAvailability,
              expectedVersion: parsed.data.expectedVersion,
            },
            context
          );

          try {
            await auditService.logEvent(context, {
              eventType: 'DATA_MODIFICATION',
              resource: 'caregiver_availability',
              resourceId: caregiverId,
              action: 'UPDATE',
              result: 'SUCCESS',
              metadata: {
                weekStart: parsed.data.weekStart,
                before: result.before,
                after: result.schedule,
                version: result.version,
              },
            });
          } catch (auditErr) {
            console.error('Audit write failure on availability save:', auditErr);
          }

          res.json({
            success: true,
            version: result.version,
            schedule: result.schedule,
          });
        } catch (saveError) {
          await handleSaveAvailabilityError(saveError, caregiverId, parsed.data.weekStart, context, auditService, res);
        }
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/caregivers/expiring-credentials
   * Get caregivers with expiring credentials
   */
  router.get('/expiring-credentials', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const service = new CaregiverService(db);

      const daysUntilExpiration = parseInt((req.query['days'] as string | undefined) ?? '30', 10);
      const caregivers = await service.getCaregiversWithExpiringCredentials(
        context.organizationId!,
        daysUntilExpiration,
        context
      );
      res.json(caregivers);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/caregivers/employee-number/:employeeNumber
   * Get caregiver by employee number
   *
   * Security Note: Employee numbers are included in the URL path for API usability.
   * While this means employee numbers appear in server logs, they are:
   * 1. Not considered PII (personally identifiable information)
   * 2. Required to be unique and publicly visible within the organization
   * 3. Used as public identifiers similar to user IDs
   * 4. Protected by authentication and authorization middleware
   *
   * If employee numbers become sensitive in your deployment, consider:
   * - Using POST with employeeNumber in the request body
   * - Implementing additional access controls
   * lgtm[js/sensitive-get-query]
   */
  // lgtm[js/sensitive-get-query]
  router.get('/employee-number/:employeeNumber', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const service = new CaregiverService(db);

      const caregiver = await service.getCaregiverByEmployeeNumber(
        req.params['employeeNumber']!,
        context.organizationId!,
        context
      );
      res.json(caregiver);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/caregivers/branch/:branchId
   * Get caregivers by branch
   */
  router.get('/branch/:branchId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const service = new CaregiverService(db);

      const activeOnly = req.query['activeOnly'] !== 'false';
      const caregivers = await service.getCaregiversByBranch(req.params['branchId']!, activeOnly, context);
      res.json(caregivers);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/caregivers
   * Search/list caregivers with filters
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const service = new CaregiverService(db);

      // HIPAA-003: Reject cross-tenant organizationId override attempts for non-SUPER_ADMIN
      const queryOrgId = req.query['organizationId'];
      if (
        typeof queryOrgId === 'string' &&
        queryOrgId !== '' &&
        !context.roles.includes('SUPER_ADMIN') &&
        context.organizationId !== undefined &&
        queryOrgId !== context.organizationId
      ) {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: 'Cross-tenant access denied: cannot query another organization',
        });
        return;
      }

      // CRITICAL SECURITY: Force organization ID to match authenticated user
      // Never allow query parameters to override organization scoping
      const filters: CaregiverSearchFilters = {
        query: req.query['query'] as string | undefined,
        organizationId: context.organizationId!, // ALWAYS use context, never from query
        branchId: req.query['branchId'] as string | undefined,
        status: req.query['status'] !== undefined ? (req.query['status'] as string).split(',') as CaregiverSearchFilters['status'] : undefined,
        role: req.query['role'] !== undefined ? (req.query['role'] as string).split(',') as CaregiverSearchFilters['role'] : undefined,
        employmentType: req.query['employmentType'] !== undefined ? (req.query['employmentType'] as string).split(',') as CaregiverSearchFilters['employmentType'] : undefined,
        complianceStatus: req.query['complianceStatus'] !== undefined ? (req.query['complianceStatus'] as string).split(',') as CaregiverSearchFilters['complianceStatus'] : undefined,
        credentialExpiring: req.query['credentialExpiring'] === 'true',
      };

      const sortBy = typeof req.query['sortBy'] === 'string' ? req.query['sortBy'] : undefined;
      const rawSortOrder = typeof req.query['sortOrder'] === 'string' ? req.query['sortOrder'].toLowerCase() : undefined;
      const sortOrder = rawSortOrder === 'asc' || rawSortOrder === 'desc' ? (rawSortOrder as 'asc' | 'desc') : undefined;

      const pagination = {
        page: parseInt((req.query['page'] as string | undefined) ?? '1', 10),
        limit: parseInt((req.query['limit'] as string | undefined) ?? '20', 10),
        ...(sortBy ? { sortBy } : {}),
        ...(sortOrder ? { sortOrder } : {}),
      };

      const result = await service.searchCaregivers(filters, pagination, context);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/caregivers/availability
   * Normalization redirect to canonical /api/visits/caregivers/availability
   */
  router.get('/availability', (req: Request, res: Response) => {
    const queryEntries = Object.entries(req.query).filter(([, v]) => typeof v === 'string') as [string, string][];
    const queryString = new URLSearchParams(queryEntries).toString();
    const querySuffix = queryString !== '' ? '?' + queryString : '';
    const targetUrl = `/api/visits/caregivers/availability${querySuffix}`;
    res.redirect(307, targetUrl);
  });

  /**
   * GET /api/caregivers/:id
   * Get caregiver by ID
   */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const service = new CaregiverService(db);

      const caregiver = await service.getCaregiverById(req.params['id']!, context);
      res.json(caregiver);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/caregivers
   * Create new caregiver
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const service = new CaregiverService(db);

      // HIPAA-003: Reject cross-tenant organizationId override attempts for non-SUPER_ADMIN
      const bodyOrgId = req.body?.['organizationId'];
      if (
        typeof bodyOrgId === 'string' &&
        bodyOrgId !== '' &&
        !context.roles.includes('SUPER_ADMIN') &&
        context.organizationId !== undefined &&
        bodyOrgId !== context.organizationId
      ) {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: 'Cross-tenant access denied: cannot create caregiver for another organization',
        });
        return;
      }

      // Safe date parsing with validation
      const parseDate = (dateStr: unknown): Date => {
        if (!dateStr || typeof dateStr !== 'string') {
          throw new Error(`Invalid date: ${dateStr}`);
        }
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date format: ${dateStr}`);
        }
        return date;
      };

      const input: CreateCaregiverInput = {
        ...req.body,
        organizationId: context.organizationId!,
        dateOfBirth: parseDate(req.body['dateOfBirth']),
        hireDate: parseDate(req.body['hireDate']),
        payRate: {
          ...req.body['payRate'],
          effectiveDate: parseDate(req.body['payRate']?.['effectiveDate']),
        },
      };

      const caregiver = await service.createCaregiver(input, context);
      res.status(201).json(caregiver);
    } catch (error) {
      next(error);
    }
  });

  /**
   * PATCH /api/caregivers/:id
   * Update caregiver
   */
  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const service = new CaregiverService(db);

      const input: UpdateCaregiverInput = req.body;

      const caregiver = await service.updateCaregiver(req.params['id']!, input, context);
      res.json(caregiver);
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /api/caregivers/:id
   * Soft delete caregiver
   */
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const service = new CaregiverService(db);

      await service.deleteCaregiver(req.params['id']!, context);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/caregivers/:id/duplicate
   * Duplicate a caregiver record with optional field selection
   */
  router.post('/:id/duplicate', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = getUserContext(req);
      // Not yet implemented: duplicateCaregiver method or alternative duplication logic
      // const service = new CaregiverService(db);

      // Verify user has permission to create caregivers
      if (!context.permissions.includes('caregivers:create') && 
          !context.permissions.includes('CAREGIVER_CREATE')) {
        res.status(403).json({ 
          error: 'PERMISSION_DENIED',
          message: 'User does not have permission to create caregivers'
        });
        return;
      }

      // Not yet implemented: duplicateCaregiver method or alternative duplication logic
      // Placeholder response until method is implemented
      res.status(501).json({
        error: 'NOT_IMPLEMENTED',
        message: 'Caregiver duplication feature is not yet implemented'
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Helper to fetch portal access summary for a caregiver
   */
  async function getCaregiverPortalSummary(
    caregiverId: string,
    hasUpdatePermission: boolean
  ): Promise<{
    status: PortalAccessStatus;
    invitedAt: string | null;
    activatedAt: string | null;
    revokedAt: string | null;
    revokedReason: string | null;
    inviteExpiresAt: string | null;
    lastLoginAt: string | null;
    linked: boolean;
  }> {
    const cgRes = await db.query<{
      user_id: string | null;
      portal_access_status: PortalAccessStatus | null;
      portal_invited_at: Date | null;
      portal_activated_at: Date | null;
      portal_revoked_at: Date | null;
      portal_revoked_reason: string | null;
      last_login_at: Date | null;
    }>(
      `SELECT c.user_id, c.portal_access_status, c.portal_invited_at,
              c.portal_activated_at, c.portal_revoked_at, c.portal_revoked_reason,
              u.last_login_at
       FROM caregivers c
       LEFT JOIN users u ON u.id = c.user_id AND u.deleted_at IS NULL
       WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [caregiverId]
    );

    const cg = cgRes.rows[0];
    if (cg === undefined) {
      throw new NotFoundError(`Caregiver not found: ${caregiverId}`);
    }

    const tokenRes = await db.query<{ expires_at: Date }>(
      `SELECT expires_at
       FROM invite_tokens
       WHERE target_type = 'CAREGIVER' AND target_id = $1 AND status = 'PENDING'
       ORDER BY created_at DESC
       LIMIT 1`,
      [caregiverId]
    );
    const latestToken = tokenRes.rows[0];

    return {
      status: cg.portal_access_status ?? 'NONE',
      invitedAt: cg.portal_invited_at != null ? new Date(cg.portal_invited_at).toISOString() : null,
      activatedAt: cg.portal_activated_at != null ? new Date(cg.portal_activated_at).toISOString() : null,
      revokedAt: cg.portal_revoked_at != null ? new Date(cg.portal_revoked_at).toISOString() : null,
      revokedReason: hasUpdatePermission ? (cg.portal_revoked_reason ?? null) : null,
      inviteExpiresAt: latestToken != null ? new Date(latestToken.expires_at).toISOString() : null,
      lastLoginAt: cg.last_login_at != null ? new Date(cg.last_login_at).toISOString() : null,
      linked: cg.user_id != null && cg.user_id !== '',
    };
  }

  const revokeReasonSchema = z.object({
    reason: z.string().min(1, 'Reason is required').max(500, 'Reason must not exceed 500 characters'),
  });

  /**
   * GET /api/caregivers/:id/portal-access
   * Get portal access summary for a caregiver
   */
  router.get('/:id/portal-access', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = getUserContext(req);
      const permissionService = new PermissionService();
      const hasRead = permissionService.hasPermission(context, 'caregivers:read');
      const hasUpdate = permissionService.hasPermission(context, 'caregivers:update');

      if (!hasRead && !hasUpdate) {
        res.status(403).json({ success: false, error: 'Permission denied: requires caregivers:read or caregivers:update' });
        return;
      }

      const caregiverId = req.params['id']!;
      const summary = await getCaregiverPortalSummary(caregiverId, hasUpdate);
      res.json({ success: true, data: summary });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ success: false, error: error.message });
        return;
      }
      if (error instanceof PermissionError) {
        res.status(403).json({ success: false, error: error.message });
        return;
      }
      next(error);
    }
  });

  /**
   * POST /api/caregivers/:id/portal-invite
   * Invite or re-invite a caregiver to the portal
   */
  router.post('/:id/portal-invite', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = getUserContext(req);
      const permissionService = new PermissionService();
      if (!permissionService.hasPermission(context, 'caregivers:update')) {
        res.status(403).json({ success: false, error: 'Permission denied: requires caregivers:update' });
        return;
      }

      const caregiverId = req.params['id']!;

      // Check caregiver employment status & email first for 409 / 400 mapping
      const cgCheckRes = await db.query<{
        employment_status: string;
        email: string | null;
        first_name: string | null;
        last_name: string | null;
      }>(
        `SELECT employment_status, email, first_name, last_name
         FROM caregivers
         WHERE id = $1 AND deleted_at IS NULL`,
        [caregiverId]
      );
      const cgCheck = cgCheckRes.rows[0];
      if (cgCheck === undefined) {
        res.status(404).json({ success: false, error: `Caregiver not found: ${caregiverId}` });
        return;
      }

      if (['TERMINATED', 'RETIRED'].includes(cgCheck.employment_status)) {
        res.status(409).json({
          success: false,
          error: `Cannot invite caregiver with employment status ${cgCheck.employment_status}`,
        });
        return;
      }

      const trimmedEmail = cgCheck.email?.trim();
      if (!trimmedEmail) {
        res.status(400).json({ success: false, error: 'Caregiver must have a valid email to be invited' });
        return;
      }

      const auditService = new AuditService(db);
      const portalAccessService = new PortalAccessService(db, permissionService, auditService);

      const inviteResult = await portalAccessService.inviteCaregiver(caregiverId, context);

      // Attempt to send email
      try {
        const orgRes = await db.query<{ name: string }>(
          `SELECT name FROM organizations WHERE id = $1`,
          [context.organizationId]
        );
        const orgName = orgRes.rows[0]?.name ?? 'MHC Portal';
        const inviterRes = await db.query<{ first_name: string | null; last_name: string | null }>(
          `SELECT first_name, last_name FROM users WHERE id = $1`,
          [context.userId]
        );
        const inviter = inviterRes.rows[0];
        const inviterName = inviter
          ? `${inviter.first_name ?? ''} ${inviter.last_name ?? ''}`.trim() || 'Administrator'
          : 'Administrator';

        const emailService = createEmailService();
        await emailService.sendInvitation({
          recipientEmail: trimmedEmail,
          recipientName: `${cgCheck.first_name ?? ''} ${cgCheck.last_name ?? ''}`.trim() || trimmedEmail,
          inviterName,
          organizationName: orgName,
          invitationToken: inviteResult.token,
          expiresAt: inviteResult.expiresAt,
        });
      } catch (err) {
        console.warn('[PortalAccess] Failed to send invitation email:', err);
      }

      const summary = await getCaregiverPortalSummary(caregiverId, true);
      res.json({ success: true, data: summary });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ success: false, error: error.message });
        return;
      }
      if (error instanceof ValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      if (error instanceof ConflictError) {
        res.status(409).json({ success: false, error: error.message });
        return;
      }
      if (error instanceof PermissionError) {
        res.status(403).json({ success: false, error: error.message });
        return;
      }
      next(error);
    }
  });

  /**
   * POST /api/caregivers/:id/portal-revoke
   * Revoke portal access for a caregiver
   */
  router.post('/:id/portal-revoke', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = getUserContext(req);
      const permissionService = new PermissionService();
      if (!permissionService.hasPermission(context, 'caregivers:update')) {
        res.status(403).json({ success: false, error: 'Permission denied: requires caregivers:update' });
        return;
      }

      const parseResult = revokeReasonSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          error: parseResult.error.issues[0]?.message ?? 'Invalid reason',
        });
        return;
      }

      const caregiverId = req.params['id']!;
      const auditService = new AuditService(db);
      const portalAccessService = new PortalAccessService(db, permissionService, auditService);

      await portalAccessService.revokeCaregiverAccess(caregiverId, parseResult.data.reason, context);

      const summary = await getCaregiverPortalSummary(caregiverId, true);
      res.json({ success: true, data: summary });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ success: false, error: error.message });
        return;
      }
      if (error instanceof ValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      if (error instanceof ConflictError) {
        res.status(409).json({ success: false, error: error.message });
        return;
      }
      if (error instanceof PermissionError) {
        res.status(403).json({ success: false, error: error.message });
        return;
      }
      next(error);
    }
  });

  /**
   * GET /api/caregivers/:id/service-authorizations
   * Get service authorizations for caregiver
   */
  router.get('/:id/service-authorizations', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const service = new CaregiverService(db);

      const authorizations = await service.getServiceAuthorizations(req.params['id']!, context);
      res.json(authorizations);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/caregivers/:id/service-authorizations
   * Add service authorization for caregiver
   */
  router.post('/:id/service-authorizations', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const service = new CaregiverService(db);

      const authorizationId = await service.addServiceAuthorization(
        req.params['id']!,
        req.body['serviceTypeCode'],
        req.body['serviceTypeName'],
        {
          authorizationSource: req.body['authorizationSource'],
          effectiveDate: req.body['effectiveDate'] !== undefined ? new Date(req.body['effectiveDate']) : undefined,
          expirationDate: req.body['expirationDate'] !== undefined ? new Date(req.body['expirationDate']) : undefined,
          notes: req.body['notes'],
        },
        context
      );

      res.status(201).json({ id: authorizationId });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/caregivers/:id/validate-assignment
   * Validate caregiver eligibility for assignment
   */
  router.post('/:id/validate-assignment', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const service = new CaregiverService(db);

      const result = await service.validateAssignment(
        req.params['id']!,
        req.body['serviceTypeCode'],
        req.body['stateJurisdiction'],
        context
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/caregivers/:id/state-screenings
   * Get state screenings for caregiver
   */
  router.get('/:id/state-screenings', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const service = new CaregiverService(db);

      const screenings = await service.getStateScreenings(req.params['id']!, context);
      res.json(screenings);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/caregivers/:id/state-screenings
   * Initiate state background screening
   */
  router.post('/:id/state-screenings', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const service = new CaregiverService(db);

      const screeningId = await service.initiateBackgroundScreening(
        req.params['id']!,
        req.body['stateCode'],
        req.body['screeningType'],
        context
      );

      res.status(201).json({ id: screeningId });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PATCH /api/caregivers/:caregiverId/state-screenings/:screeningId
   * Update state screening result
   */
  router.patch('/:caregiverId/state-screenings/:screeningId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const service = new CaregiverService(db);

      await service.updateBackgroundScreening(
        req.params['screeningId']!,
        {
          status: req.body['status'],
          completionDate: req.body['completionDate'] !== undefined ? new Date(req.body['completionDate']) : undefined,
          expirationDate: req.body['expirationDate'] !== undefined ? new Date(req.body['expirationDate']) : undefined,
          confirmationNumber: req.body['confirmationNumber'],
          clearanceNumber: req.body['clearanceNumber'],
          results: req.body['results'],
          notes: req.body['notes'],
        },
        context
      );

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/caregivers/:id/compliance-status
   * Update compliance status based on current credentials
   */
  router.post('/:id/compliance-status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const service = new CaregiverService(db);

      const caregiver = await service.updateComplianceStatus(req.params['id']!, context);
      res.json(caregiver);
    } catch (error) {
      next(error);
    }
  });

  // ============================================================
  // CREDENTIAL MANAGEMENT ENDPOINTS
  // ============================================================

  /**
   * GET /api/caregivers/credentials/status-summary
   * Get credential status summary for organization dashboard
   */
  router.get('/credentials/status-summary', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const credentialService = new CredentialExpirationService(db);

      const summary = await credentialService.getStatusSummary(context.organizationId!);
      res.json(summary);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/caregivers/credentials/expiring
   * Get all expiring credentials for organization
   */
  router.get('/credentials/expiring', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const credentialService = new CredentialExpirationService(db);

      const options = {
        daysAhead: parseInt((req.query['daysAhead'] as string | undefined) ?? '90', 10),
        includeExpired: req.query['includeExpired'] === 'true',
        branchId: req.query['branchId'] as string | undefined,
        itemTypes: req.query['itemTypes'] !== undefined
          ? (req.query['itemTypes'] as string).split(',') as ExpiringItemType[]
          : undefined,
      };

      const expiringItems = await credentialService.getExpiringItems(
        context.organizationId!,
        options
      );
      res.json(expiringItems);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/caregivers/credentials/alerts
   * Get credential expiration alerts (for notifications)
   */
  router.get('/credentials/alerts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const credentialService = new CredentialExpirationService(db);

      const forceAll = req.query['forceAll'] === 'true';
      const alerts = await credentialService.generateAlerts(
        context.organizationId!,
        { forceAll }
      );
      res.json(alerts);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/caregivers/credentials/update-all-statuses
   * Update compliance status for all caregivers (batch job)
   */
  router.post('/credentials/update-all-statuses', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const credentialService = new CredentialExpirationService(db);

      const result = await credentialService.updateAllComplianceStatuses(
        context.organizationId!,
        context
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/caregivers/:id/credentials/can-be-scheduled
   * Check if caregiver can be scheduled based on credentials
   */
  router.post('/:id/credentials/can-be-scheduled', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const credentialService = new CredentialExpirationService(db);

      const serviceDate = req.body['serviceDate'] !== undefined && req.body['serviceDate'] !== null
        ? new Date(req.body['serviceDate'] as string)
        : new Date();

      const result = await credentialService.canBeScheduled(
        req.params['id']!,
        serviceDate,
        context
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // ============================================================
  // EXCLUSION LIST ENDPOINTS
  // ============================================================

  /**
   * POST /api/caregivers/:id/exclusion-check
   * Check caregiver against federal exclusion lists (OIG, SAM)
   */
  router.post('/:id/exclusion-check', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const exclusionService = new ExclusionListService(db);

      const result = await exclusionService.checkCaregiver(req.params['id']!, context);
      
      // Record the check for audit purposes
      await exclusionService.recordExclusionCheck(result, context);
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/caregivers/exclusion-check/batch
   * Check all caregivers in organization against exclusion lists
   * 
   * NOTE: This is required monthly per CMS regulations
   */
  router.post('/exclusion-check/batch', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const exclusionService = new ExclusionListService(db);

      const result = await exclusionService.checkOrganization(
        context.organizationId!,
        context
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/caregivers/:id/exclusion-check/history
   * Get exclusion check history for a caregiver
   */
  router.get('/:id/exclusion-check/history', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const exclusionService = new ExclusionListService(db);

      const history = await exclusionService.getCheckHistory(req.params['id']!, context);
      res.json(history);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
