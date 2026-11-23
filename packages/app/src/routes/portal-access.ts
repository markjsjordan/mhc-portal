/**
 * Portal Access API routes for Family Members and Clients
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
  buildInvitationUrl,
} from '@folkcare/core';

const portalInviteBodySchema = z.object({
  sendEmail: z.boolean().optional().default(true),
});

async function sendPortalInviteEmail(
  db: Database,
  organizationId: string,
  userId: string,
  recipientEmail: string,
  recipientName: string,
  token: string,
  expiresAt: Date
): Promise<{ emailSent: boolean; emailError: string | null }> {
  let emailSent = false;
  let emailError: string | null = null;
  try {
    const orgRes = await db.query<{ name: string }>(
      `SELECT name FROM organizations WHERE id = $1`,
      [organizationId]
    );
    const orgName = orgRes.rows[0]?.name ?? 'MHC Portal';
    const inviterRes = await db.query<{ first_name: string | null; last_name: string | null }>(
      `SELECT first_name, last_name FROM users WHERE id = $1`,
      [userId]
    );
    const inviter = inviterRes.rows[0];
    const inviterName = inviter
      ? `${inviter.first_name ?? ''} ${inviter.last_name ?? ''}`.trim() || 'Administrator'
      : 'Administrator';

    const emailService = createEmailService();
    await emailService.sendInvitation({
      recipientEmail,
      recipientName,
      inviterName,
      organizationName: orgName,
      invitationToken: token,
      expiresAt,
    });
    emailSent = true;
  } catch (err) {
    emailError = err instanceof Error ? err.message : 'Failed to send invitation email';
    console.warn('[PortalAccess] Failed to send invitation email:', err);
  }
  return { emailSent, emailError };
}

export type PortalAccessStatus = 'NONE' | 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export interface FamilyPortalAccessRow {
  familyMemberId: string;
  firstName: string;
  lastName: string;
  relationship: string;
  relationshipNote?: string | null;
  email: string;
  phoneNumber?: string;
  isPrimaryContact?: boolean;
  portalAccessLevel: 'VIEW_BASIC' | 'VIEW_DETAILED' | 'VIEW_MEDICAL' | 'VIEW_FINANCIAL' | 'FULL_ACCESS';
  status: PortalAccessStatus;
  invitedAt: string | null;
  activatedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  inviteExpiresAt: string | null;
  lastLoginAt: string | null;
  linked: boolean;
  emailSent?: boolean;
  emailError?: string | null;
  inviteUrl?: string | null;
}

export const FAMILY_RELATIONSHIPS = [
  'SPOUSE',
  'PARENT',
  'CHILD',
  'SIBLING',
  'GRANDPARENT',
  'GRANDCHILD',
  'GUARDIAN',
  'POWER_OF_ATTORNEY',
  'HEALTHCARE_PROXY',
  'OTHER',
] as const;

export const PORTAL_ACCESS_LEVELS = [
  'VIEW_BASIC',
  'VIEW_DETAILED',
  'VIEW_MEDICAL',
  'VIEW_FINANCIAL',
  'FULL_ACCESS',
] as const;

export const AUTHORIZER_TYPES = ['CLIENT', 'LEGAL_REPRESENTATIVE'] as const;

const ELEVATED_ACCESS_LEVELS = new Set<string>(['VIEW_MEDICAL', 'FULL_ACCESS']);

const createFamilyMemberSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(100),
    lastName: z.string().trim().min(1, 'Last name is required').max(100),
    relationship: z.enum(FAMILY_RELATIONSHIPS),
    relationshipNote: z.string().trim().max(500).optional().nullable(),
    email: z.string().trim().toLowerCase().email('Valid email is required').max(255),
    phoneNumber: z.string().trim().max(50).optional().default(''),
    isPrimaryContact: z.boolean().optional().default(false),
    portalAccessLevel: z.enum(PORTAL_ACCESS_LEVELS).optional().default('VIEW_BASIC'),
    confirmElevatedAccess: z.boolean().optional().default(false),
    inviteNow: z.boolean().optional().default(false),
    consent: z.object({
      consentGiven: z.literal(true, {
        message: 'Client or legal representative authorization is required',
      }),
      authorizedBy: z.enum(AUTHORIZER_TYPES),
      authorizerName: z.string().trim().min(1, 'Authorizer name is required').max(255),
      notes: z.string().trim().max(500).optional(),
    }),
  })
  .superRefine((data, ctx) => {
    if (ELEVATED_ACCESS_LEVELS.has(data.portalAccessLevel) && !data.confirmElevatedAccess) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmElevatedAccess'],
        message: 'Explicit confirmation is required for VIEW_MEDICAL or FULL_ACCESS',
      });
    }
  });

const updateFamilyMemberSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(100).optional(),
    lastName: z.string().trim().min(1, 'Last name is required').max(100).optional(),
    relationship: z.enum(FAMILY_RELATIONSHIPS).optional(),
    relationshipNote: z.string().trim().max(500).optional().nullable(),
    email: z.string().trim().toLowerCase().email('Valid email is required').max(255).optional(),
    phoneNumber: z.string().trim().max(50).optional(),
    isPrimaryContact: z.boolean().optional(),
    portalAccessLevel: z.enum(PORTAL_ACCESS_LEVELS).optional(),
    confirmElevatedAccess: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    const hasUpdate =
      data.firstName !== undefined ||
      data.lastName !== undefined ||
      data.relationship !== undefined ||
      data.relationshipNote !== undefined ||
      data.email !== undefined ||
      data.phoneNumber !== undefined ||
      data.isPrimaryContact !== undefined ||
      data.portalAccessLevel !== undefined;

    if (!hasUpdate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field must be provided for update',
      });
    }

    if (
      data.portalAccessLevel !== undefined &&
      ELEVATED_ACCESS_LEVELS.has(data.portalAccessLevel) &&
      !data.confirmElevatedAccess
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmElevatedAccess'],
        message: 'Explicit confirmation is required for VIEW_MEDICAL or FULL_ACCESS',
      });
    }
  });

function buildFamilyMemberUpdateFields(
  data: z.infer<typeof updateFamilyMemberSchema>,
  familyMemberId: string,
  userId: string
): { setClauses: string[]; params: unknown[]; updatedFields: string[] } {
  const setClauses: string[] = ['updated_at = NOW()', 'updated_by = $2'];
  const params: unknown[] = [familyMemberId, userId];
  const updatedFields: string[] = [];

  const fieldMap: Array<[keyof typeof data, string, string]> = [
    ['firstName', 'first_name', 'firstName'],
    ['lastName', 'last_name', 'lastName'],
    ['relationship', 'relationship', 'relationship'],
    ['relationshipNote', 'relationship_note', 'relationshipNote'],
    ['email', 'email', 'email'],
    ['phoneNumber', 'phone_number', 'phoneNumber'],
    ['isPrimaryContact', 'is_primary_contact', 'isPrimaryContact'],
  ];

  for (const [key, column, fieldName] of fieldMap) {
    if (data[key] !== undefined) {
      params.push(data[key]);
      setClauses.push(`${column} = $${params.length}`);
      updatedFields.push(fieldName);
    }
  }

  if (data.portalAccessLevel !== undefined) {
    params.push(data.portalAccessLevel);
    setClauses.push(`portal_access_level = $${params.length}`, 'access_granted_by = $2', 'access_granted_at = NOW()');
    updatedFields.push('portalAccessLevel');
  }

  return { setClauses, params, updatedFields };
}

function handlePortalAccessRouteError(error: unknown, res: Response, next: NextFunction): void {
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

function getUserContext(req: Request): UserContext {
  const user = req.user!;
  return {
    userId: user.userId,
    organizationId: user.organizationId,
    branchIds: user.branchIds,
    roles: user.roles,
    permissions: user.permissions,
  };
}

const revokeReasonSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason must not exceed 500 characters'),
});

export function createPortalAccessRouter(db: Database): Router {
  const router = Router();
  const authMiddleware = new AuthMiddleware(db);

  router.use(authMiddleware.requireAuth);

  /**
   * Helper to fetch latest pending invite token expiration for a target
   */
  async function getLatestPendingInviteExpiresAt(
    targetType: 'FAMILY' | 'CAREGIVER' | 'CLIENT',
    targetId: string
  ): Promise<string | null> {
    const tokenRes = await db.query<{ expires_at: Date }>(
      `SELECT expires_at
       FROM invite_tokens
       WHERE target_type = $1 AND target_id = $2 AND status = 'PENDING'
       ORDER BY created_at DESC
       LIMIT 1`,
      [targetType, targetId]
    );
    const latestToken = tokenRes.rows[0];
    return latestToken != null ? new Date(latestToken.expires_at).toISOString() : null;
  }

  /**
   * Helper to build FamilyPortalAccessRow
   */
  async function mapFamilyMemberRow(
    fm: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      relationship: string | null;
      relationship_note?: string | null;
      email: string | null;
      phone_number?: string | null;
      is_primary_contact?: boolean | null;
      portal_access_level: string | null;
      portal_access_status: PortalAccessStatus | null;
      portal_invited_at: Date | null;
      portal_activated_at: Date | null;
      portal_revoked_at: Date | null;
      portal_revoked_reason: string | null;
      user_id: string | null;
      last_login_at: Date | null;
    },
    hasUpdatePermission: boolean
  ): Promise<FamilyPortalAccessRow> {
    const inviteExpiresAt = await getLatestPendingInviteExpiresAt('FAMILY', fm.id);

    return {
      familyMemberId: fm.id,
      firstName: fm.first_name ?? '',
      lastName: fm.last_name ?? '',
      relationship: fm.relationship ?? '',
      relationshipNote: fm.relationship_note ?? null,
      email: fm.email ?? '',
      phoneNumber: fm.phone_number ?? '',
      isPrimaryContact: Boolean(fm.is_primary_contact),
      portalAccessLevel: (fm.portal_access_level ?? 'VIEW_BASIC') as FamilyPortalAccessRow['portalAccessLevel'],
      status: fm.portal_access_status ?? 'NONE',
      invitedAt: fm.portal_invited_at != null ? new Date(fm.portal_invited_at).toISOString() : null,
      activatedAt: fm.portal_activated_at != null ? new Date(fm.portal_activated_at).toISOString() : null,
      revokedAt: fm.portal_revoked_at != null ? new Date(fm.portal_revoked_at).toISOString() : null,
      revokedReason: hasUpdatePermission ? (fm.portal_revoked_reason ?? null) : null,
      inviteExpiresAt,
      lastLoginAt: fm.last_login_at != null ? new Date(fm.last_login_at).toISOString() : null,
      linked: fm.user_id != null && fm.user_id !== '',
    };
  }

  /**
   * Helper to fetch FamilyPortalAccessRow for a single family member
   */
  async function getFamilyMemberPortalRow(
    familyMemberId: string,
    hasUpdatePermission: boolean
  ): Promise<FamilyPortalAccessRow> {
    const fmRes = await db.query<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      relationship: string | null;
      relationship_note: string | null;
      email: string | null;
      phone_number: string | null;
      is_primary_contact: boolean | null;
      portal_access_level: string | null;
      portal_access_status: PortalAccessStatus | null;
      portal_invited_at: Date | null;
      portal_activated_at: Date | null;
      portal_revoked_at: Date | null;
      portal_revoked_reason: string | null;
      user_id: string | null;
      last_login_at: Date | null;
    }>(
      `SELECT fm.id, fm.first_name, fm.last_name, fm.relationship, fm.relationship_note,
              fm.email, fm.phone_number, fm.is_primary_contact,
              fm.portal_access_level, fm.portal_access_status, fm.portal_invited_at,
              fm.portal_activated_at, fm.portal_revoked_at, fm.portal_revoked_reason,
              fm.user_id, u.last_login_at
       FROM family_members fm
       LEFT JOIN users u ON u.id = fm.user_id AND u.deleted_at IS NULL
       WHERE fm.id = $1 AND fm.status != 'INACTIVE'`,
      [familyMemberId]
    );

    const fm = fmRes.rows[0];
    if (fm === undefined) {
      throw new NotFoundError(`Family member not found: ${familyMemberId}`);
    }

    return mapFamilyMemberRow(fm, hasUpdatePermission);
  }

  /**
   * GET /api/clients/:clientId/family-portal-access
   * List family portal access rows for a client
   */
  router.get('/clients/:clientId/family-portal-access', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = getUserContext(req);
      const permissionService = new PermissionService();
      const hasRead = permissionService.hasPermission(context, 'clients:read');
      const hasUpdate = permissionService.hasPermission(context, 'clients:update');

      if (!hasRead && !hasUpdate) {
        res.status(403).json({ success: false, error: 'Permission denied: requires clients:read or clients:update' });
        return;
      }

      const clientId = req.params['clientId']!;

      // Validate client belongs to caller's org
      const clientRes = await db.query<{ id: string; organization_id: string }>(
        `SELECT id, organization_id FROM clients WHERE id = $1 AND deleted_at IS NULL`,
        [clientId]
      );
      const client = clientRes.rows[0];
      if (client === undefined || client.organization_id !== context.organizationId) {
        res.status(404).json({ success: false, error: `Client not found: ${clientId}` });
        return;
      }

      const fmRes = await db.query<{
        id: string;
        first_name: string | null;
        last_name: string | null;
        relationship: string | null;
        relationship_note: string | null;
        email: string | null;
        phone_number: string | null;
        is_primary_contact: boolean | null;
        portal_access_level: string | null;
        portal_access_status: PortalAccessStatus | null;
        portal_invited_at: Date | null;
        portal_activated_at: Date | null;
        portal_revoked_at: Date | null;
        portal_revoked_reason: string | null;
        user_id: string | null;
        last_login_at: Date | null;
      }>(
        `SELECT fm.id, fm.first_name, fm.last_name, fm.relationship, fm.relationship_note,
                fm.email, fm.phone_number, fm.is_primary_contact,
                fm.portal_access_level, fm.portal_access_status, fm.portal_invited_at,
                fm.portal_activated_at, fm.portal_revoked_at, fm.portal_revoked_reason,
                fm.user_id, u.last_login_at
         FROM family_members fm
         LEFT JOIN users u ON u.id = fm.user_id AND u.deleted_at IS NULL
         WHERE fm.client_id = $1 AND fm.status != 'INACTIVE'
         ORDER BY fm.created_at ASC`,
        [clientId]
      );

      const rows: FamilyPortalAccessRow[] = [];
      for (const fm of fmRes.rows) {
        rows.push(await mapFamilyMemberRow(fm, hasUpdate));
      }

      res.json({ success: true, data: rows });
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
   * Shared helper to create an invite token and send the invitation email for a family member.
   */
  async function sendFamilyPortalInvite(
    familyMemberId: string,
    fmDetails: { email: string; firstName: string; lastName: string },
    context: UserContext,
    permissionService: PermissionService,
    sendEmail = true
  ): Promise<{ emailSent: boolean; emailError: string | null; inviteUrl: string }> {
    const auditService = new AuditService(db);
    const portalAccessService = new PortalAccessService(db, permissionService, auditService);

    const inviteResult = await portalAccessService.inviteFamilyMember(familyMemberId, context);
    const inviteUrl = buildInvitationUrl(inviteResult.token);

    let emailSent = false;
    let emailError: string | null = null;
    if (sendEmail) {
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
        recipientEmail: fmDetails.email,
        recipientName: `${fmDetails.firstName} ${fmDetails.lastName}`.trim() || fmDetails.email,
        inviterName,
        organizationName: orgName,
        invitationToken: inviteResult.token,
        expiresAt: inviteResult.expiresAt,
      });
      emailSent = true;
      } catch (err) {
        emailError = err instanceof Error ? err.message : 'Failed to send invitation email';
        console.warn('[PortalAccess] Failed to send family invitation email:', err);
      }
    }

    return { emailSent, emailError, inviteUrl };
  }

  /**
   * POST /api/clients/:clientId/family-members
   * Create a family member for a client, record portal consent, and optionally invite
   */
  router.post('/clients/:clientId/family-members', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = getUserContext(req);
      const permissionService = new PermissionService();
      if (!permissionService.hasPermission(context, 'clients:update')) {
        res.status(403).json({ success: false, error: 'Permission denied: requires clients:update' });
        return;
      }

      const parsed = createFamilyMemberSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: parsed.error.issues.map((e) => e.message).join('; '),
          details: parsed.error.issues,
        });
        return;
      }

      const data = parsed.data;
      const clientId = req.params['clientId']!;

      const clientRes = await db.query<{
        id: string;
        organization_id: string;
        branch_id: string;
        status: string;
      }>(
        `SELECT id, organization_id, branch_id, status FROM clients WHERE id = $1 AND deleted_at IS NULL`,
        [clientId]
      );
      const client = clientRes.rows[0];
      if (client === undefined || client.organization_id !== context.organizationId) {
        res.status(404).json({ success: false, error: `Client not found: ${clientId}` });
        return;
      }

      if (['DISCHARGED', 'DECEASED'].includes(client.status)) {
        res.status(409).json({
          success: false,
          error: `Cannot add family member for client with status ${client.status}`,
        });
        return;
      }

      const normalizedEmail = data.email.trim().toLowerCase();
      const dupRes = await db.query<{ id: string; status: string }>(
        `SELECT id, status FROM family_members WHERE client_id = $1 AND LOWER(TRIM(email)) = $2`,
        [clientId, normalizedEmail]
      );
      if (dupRes.rows.length > 0) {
        res.status(409).json({
          success: false,
          error: 'A family member with this email already exists for this client',
        });
        return;
      }

      const nowIso = new Date().toISOString();
      const insertFmRes = await db.query<{ id: string }>(
        `INSERT INTO family_members (
          client_id, organization_id, branch_id,
          first_name, last_name, email, phone_number,
          relationship, relationship_note, is_primary_contact,
          portal_access_level, portal_access_status, invitation_status, status,
          access_granted_by, access_granted_at, created_by, updated_by
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6, $7,
          $8, $9, $10,
          $11, 'NONE', 'PENDING', 'ACTIVE',
          $12, NOW(), $12, $12
        ) RETURNING id`,
        [
          clientId,
          context.organizationId,
          client.branch_id,
          data.firstName,
          data.lastName,
          normalizedEmail,
          data.phoneNumber ?? '',
          data.relationship,
          data.relationshipNote ?? null,
          data.isPrimaryContact ?? false,
          data.portalAccessLevel,
          context.userId,
        ]
      );
      const newFamilyMemberId = insertFmRes.rows[0]!.id;

      const insertConsentRes = await db.query<{ id: string }>(
        `INSERT INTO family_consent (
          family_member_id, client_id, consent_type, consent_given, consent_date,
          signed_by_client_id, signed_by_guardian_id,
          organization_id, created_by, updated_by
        ) VALUES (
          $1, $2, 'PORTAL_ACCESS', true, NOW(),
          $3, $4,
          $5, $6, $6
        ) RETURNING id`,
        [
          newFamilyMemberId,
          clientId,
          data.consent.authorizedBy === 'CLIENT' ? clientId : null,
          data.consent.authorizedBy === 'LEGAL_REPRESENTATIVE' ? newFamilyMemberId : null,
          context.organizationId,
          context.userId,
        ]
      );
      const consentId = insertConsentRes.rows[0]?.id ?? newFamilyMemberId;

      const auditService = new AuditService(db);
      await auditService.logEvent(context, {
        eventType: 'DATA_MODIFICATION',
        action: 'CREATE',
        resource: 'family_member',
        resourceId: newFamilyMemberId,
        result: 'SUCCESS',
        metadata: {
          clientId,
          relationship: data.relationship,
          portalAccessLevel: data.portalAccessLevel,
          isPrimaryContact: data.isPrimaryContact,
          inviteNow: data.inviteNow,
        },
      });

      await auditService.logEvent(context, {
        eventType: 'COMPLIANCE',
        action: 'RECORD_FAMILY_PORTAL_CONSENT',
        resource: 'family_consent',
        resourceId: consentId,
        result: 'SUCCESS',
        metadata: {
          clientId,
          familyMemberId: newFamilyMemberId,
          consentType: 'PORTAL_ACCESS',
          authorizedBy: data.consent.authorizedBy,
          consentDate: nowIso,
          portalAccessLevel: data.portalAccessLevel,
        },
      });

      let emailSent: boolean | undefined;
      let emailError: string | null | undefined;
      if (data.inviteNow) {
        const inviteOutcome = await sendFamilyPortalInvite(
          newFamilyMemberId,
          { email: normalizedEmail, firstName: data.firstName, lastName: data.lastName },
          context,
          permissionService
        );
        emailSent = inviteOutcome.emailSent;
        emailError = inviteOutcome.emailError;
      }

      const row = await getFamilyMemberPortalRow(newFamilyMemberId, true);
      res.status(201).json({
        success: true,
        data: {
          ...row,
          ...(emailSent !== undefined ? { emailSent, emailError } : {}),
        },
      });
    } catch (error) {
      handlePortalAccessRouteError(error, res, next);
    }
  });

  /**
   * PATCH /api/family-members/:id
   * Update a family member's details or portal access level
   */
  router.patch('/family-members/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = getUserContext(req);
      const permissionService = new PermissionService();
      if (!permissionService.hasPermission(context, 'clients:update')) {
        res.status(403).json({ success: false, error: 'Permission denied: requires clients:update' });
        return;
      }

      const parsed = updateFamilyMemberSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: parsed.error.issues.map((e) => e.message).join('; '),
          details: parsed.error.issues,
        });
        return;
      }

      const familyMemberId = req.params['id']!;
      const fmCheckRes = await db.query<{
        id: string;
        client_id: string;
        portal_access_level: string;
        client_organization_id: string;
        client_status: string;
      }>(
        `SELECT fm.id, fm.client_id, fm.portal_access_level,
                c.organization_id as client_organization_id, c.status as client_status
         FROM family_members fm
         JOIN clients c ON c.id = fm.client_id AND c.deleted_at IS NULL
         WHERE fm.id = $1 AND fm.status != 'INACTIVE'`,
        [familyMemberId]
      );

      const fmCheck = fmCheckRes.rows[0];
      if (fmCheck === undefined || fmCheck.client_organization_id !== context.organizationId) {
        res.status(404).json({ success: false, error: `Family member not found: ${familyMemberId}` });
        return;
      }

      if (['DISCHARGED', 'DECEASED'].includes(fmCheck.client_status)) {
        res.status(409).json({
          success: false,
          error: `Cannot update family member for client with status ${fmCheck.client_status}`,
        });
        return;
      }

      const data = parsed.data;
      if (data.email !== undefined) {
        const dupRes = await db.query<{ id: string }>(
          `SELECT id FROM family_members WHERE client_id = $1 AND LOWER(TRIM(email)) = $2 AND id != $3`,
          [fmCheck.client_id, data.email, familyMemberId]
        );
        if (dupRes.rows.length > 0) {
          res.status(409).json({
            success: false,
            error: 'A family member with this email already exists for this client',
          });
          return;
        }
      }

      const { setClauses, params, updatedFields } = buildFamilyMemberUpdateFields(
        data,
        familyMemberId,
        context.userId
      );

      await db.query(
        `UPDATE family_members SET ${setClauses.join(', ')} WHERE id = $1`,
        params
      );

      const auditService = new AuditService(db);
      await auditService.logEvent(context, {
        eventType: 'DATA_MODIFICATION',
        action: 'UPDATE',
        resource: 'family_member',
        resourceId: familyMemberId,
        result: 'SUCCESS',
        metadata: {
          clientId: fmCheck.client_id,
          previousAccessLevel: fmCheck.portal_access_level,
          newAccessLevel: data.portalAccessLevel ?? fmCheck.portal_access_level,
          updatedFields,
          confirmedElevatedAccess: data.confirmElevatedAccess,
        },
      });

      const row = await getFamilyMemberPortalRow(familyMemberId, true);
      res.json({ success: true, data: row });
    } catch (error) {
      handlePortalAccessRouteError(error, res, next);
    }
  });

  /**
   * DELETE /api/family-members/:id
   * Soft-delete a family member, revoke portal access if active/invited, and revoke consent
   */
  router.delete('/family-members/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = getUserContext(req);
      const permissionService = new PermissionService();
      if (!permissionService.hasPermission(context, 'clients:update')) {
        res.status(403).json({ success: false, error: 'Permission denied: requires clients:update' });
        return;
      }

      const familyMemberId = req.params['id']!;
      const fmCheckRes = await db.query<{
        id: string;
        client_id: string;
        portal_access_status: PortalAccessStatus;
        client_organization_id: string;
      }>(
        `SELECT fm.id, fm.client_id, fm.portal_access_status,
                c.organization_id as client_organization_id
         FROM family_members fm
         JOIN clients c ON c.id = fm.client_id AND c.deleted_at IS NULL
         WHERE fm.id = $1 AND fm.status != 'INACTIVE'`,
        [familyMemberId]
      );

      const fmCheck = fmCheckRes.rows[0];
      if (fmCheck === undefined || fmCheck.client_organization_id !== context.organizationId) {
        res.status(404).json({ success: false, error: `Family member not found: ${familyMemberId}` });
        return;
      }

      const auditService = new AuditService(db);
      if (['ACTIVE', 'INVITED', 'SUSPENDED'].includes(fmCheck.portal_access_status)) {
        const portalAccessService = new PortalAccessService(db, permissionService, auditService);
        await portalAccessService.revokeFamilyAccess(
          familyMemberId,
          'Family member removed from client record',
          context
        );
      }

      await db.query(
        `UPDATE family_members SET status = 'INACTIVE', updated_at = NOW(), updated_by = $2 WHERE id = $1`,
        [familyMemberId, context.userId]
      );

      await db.query(
        `UPDATE family_consent
         SET revoked_at = NOW(), revoked_by = $2, revoked_reason = 'Family member removed',
             updated_at = NOW(), updated_by = $2
         WHERE family_member_id = $1 AND revoked_at IS NULL`,
        [familyMemberId, context.userId]
      );

      await auditService.logEvent(context, {
        eventType: 'DATA_MODIFICATION',
        action: 'DELETE',
        resource: 'family_member',
        resourceId: familyMemberId,
        result: 'SUCCESS',
        metadata: { clientId: fmCheck.client_id },
      });

      res.json({ success: true });
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
   * POST /api/family-members/:id/portal-invite
   * Invite or re-invite a family member to the portal
   */
  router.post('/family-members/:id/portal-invite', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = getUserContext(req);
      const permissionService = new PermissionService();
      if (!permissionService.hasPermission(context, 'clients:update')) {
        res.status(403).json({ success: false, error: 'Permission denied: requires clients:update' });
        return;
      }

      const familyMemberId = req.params['id']!;

      // Validate family member and client
      const fmCheckRes = await db.query<{
        id: string;
        email: string | null;
        first_name: string | null;
        last_name: string | null;
        client_id: string;
        client_organization_id: string;
        client_status: string;
      }>(
        `SELECT fm.id, fm.email, fm.first_name, fm.last_name, fm.client_id,
                c.organization_id as client_organization_id, c.status as client_status
         FROM family_members fm
         JOIN clients c ON c.id = fm.client_id AND c.deleted_at IS NULL
         WHERE fm.id = $1 AND fm.status != 'INACTIVE'`,
        [familyMemberId]
      );
      const fmCheck = fmCheckRes.rows[0];
      if (fmCheck === undefined || fmCheck.client_organization_id !== context.organizationId) {
        res.status(404).json({ success: false, error: `Family member not found: ${familyMemberId}` });
        return;
      }

      if (['DISCHARGED', 'DECEASED'].includes(fmCheck.client_status)) {
        res.status(409).json({
          success: false,
          error: `Cannot invite family member of client with status ${fmCheck.client_status}`,
        });
        return;
      }

      const trimmedEmail = fmCheck.email?.trim();
      if (!trimmedEmail) {
        res.status(400).json({ success: false, error: 'Family member must have a valid email to be invited' });
        return;
      }

      const { sendEmail } = portalInviteBodySchema.parse(req.body ?? {});
      const { emailSent, emailError, inviteUrl } = await sendFamilyPortalInvite(
        familyMemberId,
        {
          email: trimmedEmail,
          firstName: fmCheck.first_name ?? '',
          lastName: fmCheck.last_name ?? '',
        },
        context,
        permissionService,
        sendEmail
      );

      const row = await getFamilyMemberPortalRow(familyMemberId, true);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ success: true, data: { ...row, emailSent, emailError, inviteUrl } });
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
   * POST /api/family-members/:id/portal-revoke
   * Revoke portal access for a family member
   */
  router.post('/family-members/:id/portal-revoke', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = getUserContext(req);
      const permissionService = new PermissionService();
      if (!permissionService.hasPermission(context, 'clients:update')) {
        res.status(403).json({ success: false, error: 'Permission denied: requires clients:update' });
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

      const familyMemberId = req.params['id']!;
      const auditService = new AuditService(db);
      const portalAccessService = new PortalAccessService(db, permissionService, auditService);

      await portalAccessService.revokeFamilyAccess(familyMemberId, parseResult.data.reason, context);

      const row = await getFamilyMemberPortalRow(familyMemberId, true);
      res.json({ success: true, data: row });
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
   * POST /api/clients/:id/portal-invite
   * Invite a client directly to the portal (CLIENT role)
   */
  router.post('/clients/:id/portal-invite', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = getUserContext(req);
      const permissionService = new PermissionService();
      if (!permissionService.hasPermission(context, 'clients:update')) {
        res.status(403).json({ success: false, error: 'Permission denied: requires clients:update' });
        return;
      }

      const clientId = req.params['id']!;

      // Validate client
      const clientCheckRes = await db.query<{
        id: string;
        email: string | null;
        first_name: string | null;
        last_name: string | null;
        organization_id: string;
        status: string;
      }>(
        `SELECT id, email, first_name, last_name, organization_id, status
         FROM clients
         WHERE id = $1 AND deleted_at IS NULL`,
        [clientId]
      );
      const clientCheck = clientCheckRes.rows[0];
      if (clientCheck === undefined || clientCheck.organization_id !== context.organizationId) {
        res.status(404).json({ success: false, error: `Client not found: ${clientId}` });
        return;
      }

      if (['DISCHARGED', 'DECEASED'].includes(clientCheck.status)) {
        res.status(409).json({
          success: false,
          error: `Cannot invite client with status ${clientCheck.status}`,
        });
        return;
      }

      const trimmedEmail = clientCheck.email?.trim();
      if (!trimmedEmail) {
        res.status(400).json({ success: false, error: 'Client must have a valid email to be invited' });
        return;
      }

      const { sendEmail } = portalInviteBodySchema.parse(req.body ?? {});
      const auditService = new AuditService(db);
      const portalAccessService = new PortalAccessService(db, permissionService, auditService);

      const inviteResult = await portalAccessService.inviteClient(clientId, context);

      // Attempt email send when requested
      let emailResult: { emailSent: boolean; emailError: string | null } | undefined;
      if (sendEmail) {
        const recipientName = `${clientCheck.first_name ?? ''} ${clientCheck.last_name ?? ''}`.trim() || trimmedEmail;
        emailResult = await sendPortalInviteEmail(
          db,
          context.organizationId,
          context.userId,
          trimmedEmail,
          recipientName,
          inviteResult.token,
          inviteResult.expiresAt
        );
      }

      const inviteUrl = buildInvitationUrl(inviteResult.token);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ success: true, data: { ...inviteResult, inviteUrl, ...(emailResult ?? {}) } });
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
   * POST /api/clients/:id/portal-revoke
   * Revoke portal access for a client
   */
  router.post('/clients/:id/portal-revoke', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = getUserContext(req);
      const permissionService = new PermissionService();
      if (!permissionService.hasPermission(context, 'clients:update')) {
        res.status(403).json({ success: false, error: 'Permission denied: requires clients:update' });
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

      const clientId = req.params['id']!;
      const auditService = new AuditService(db);
      const portalAccessService = new PortalAccessService(db, permissionService, auditService);

      await portalAccessService.revokeClientAccess(clientId, parseResult.data.reason, context);

      res.json({ success: true });
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
   * GET /api/clients/:id/portal-access
   * Client's own portal-access status (staff view; requires clients:update)
   */
  router.get('/clients/:id/portal-access', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = getUserContext(req);
      const permissionService = new PermissionService();
      if (!permissionService.hasPermission(context, 'clients:update')) {
        res.status(403).json({ success: false, error: 'Permission denied: requires clients:update' });
        return;
      }
      const clientId = req.params['id']!;
      const r = await db.query<{
        id: string;
        organization_id: string;
        email: string | null;
        status: string;
        user_id: string | null;
        portal_access_status: string | null;
        portal_access_level: string | null;
        portal_self_access_allowed: boolean | null;
        portal_invited_at: Date | null;
        portal_activated_at: Date | null;
        portal_revoked_at: Date | null;
        portal_revoked_reason: string | null;
        last_login_at: Date | null;
      }>(
        `SELECT c.id, c.organization_id, c.email, c.status, c.user_id,
                c.portal_access_status, c.portal_access_level, c.portal_self_access_allowed,
                c.portal_invited_at, c.portal_activated_at, c.portal_revoked_at,
                c.portal_revoked_reason, u.last_login_at
         FROM clients c
         LEFT JOIN users u ON u.id = c.user_id AND u.deleted_at IS NULL
         WHERE c.id = $1 AND c.deleted_at IS NULL`,
        [clientId]
      );
      const row = r.rows[0];
      if (row === undefined || row.organization_id !== context.organizationId) {
        res.status(404).json({ success: false, error: `Client not found: ${clientId}` });
        return;
      }
      const expiresAt = await getLatestPendingInviteExpiresAt('CLIENT', clientId);
      res.json({
        success: true,
        data: {
          clientId: row.id,
          email: row.email ?? '',
          clientStatus: row.status,
          status: row.portal_access_status ?? 'NONE',
          portalAccessLevel: row.portal_access_level ?? 'FULL_ACCESS',
          portalSelfAccessAllowed: Boolean(row.portal_self_access_allowed),
          invitedAt: row.portal_invited_at != null ? new Date(row.portal_invited_at).toISOString() : null,
          activatedAt: row.portal_activated_at != null ? new Date(row.portal_activated_at).toISOString() : null,
          revokedAt: row.portal_revoked_at != null ? new Date(row.portal_revoked_at).toISOString() : null,
          revokedReason: row.portal_revoked_reason,
          lastLoginAt: row.last_login_at != null ? new Date(row.last_login_at).toISOString() : null,
          inviteExpiresAt: expiresAt,
          linked: row.user_id != null && row.user_id !== '',
        },
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PATCH /api/clients/:id/portal-access
   * Toggle client self-portal access (capacity / legal representative gate).
   */
  router.patch('/clients/:id/portal-access', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = getUserContext(req);
      const permissionService = new PermissionService();
      if (!permissionService.hasPermission(context, 'clients:update')) {
        res.status(403).json({ success: false, error: 'Permission denied: requires clients:update' });
        return;
      }

      const bodySchema = z.object({
        portalSelfAccessAllowed: z.boolean(),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'portalSelfAccessAllowed boolean is required' });
        return;
      }

      const clientId = req.params['id']!;
      const auditService = new AuditService(db);
      const portalAccessService = new PortalAccessService(db, permissionService, auditService);
      await portalAccessService.setClientSelfAccessAllowed(
        clientId,
        parsed.data.portalSelfAccessAllowed,
        context
      );

      const r = await db.query<{
        id: string;
        email: string | null;
        status: string;
        user_id: string | null;
        portal_access_status: string | null;
        portal_access_level: string | null;
        portal_self_access_allowed: boolean | null;
        portal_invited_at: Date | null;
        portal_activated_at: Date | null;
        portal_revoked_at: Date | null;
        portal_revoked_reason: string | null;
        last_login_at: Date | null;
      }>(
        `SELECT c.id, c.email, c.status, c.user_id,
                c.portal_access_status, c.portal_access_level, c.portal_self_access_allowed,
                c.portal_invited_at, c.portal_activated_at, c.portal_revoked_at,
                c.portal_revoked_reason, u.last_login_at
         FROM clients c
         LEFT JOIN users u ON u.id = c.user_id AND u.deleted_at IS NULL
         WHERE c.id = $1 AND c.deleted_at IS NULL`,
        [clientId]
      );
      const row = r.rows[0]!;
      const expiresAt = await getLatestPendingInviteExpiresAt('CLIENT', clientId);
      res.json({
        success: true,
        data: {
          clientId: row.id,
          email: row.email ?? '',
          clientStatus: row.status,
          status: row.portal_access_status ?? 'NONE',
          portalAccessLevel: row.portal_access_level ?? 'FULL_ACCESS',
          portalSelfAccessAllowed: Boolean(row.portal_self_access_allowed),
          invitedAt: row.portal_invited_at != null ? new Date(row.portal_invited_at).toISOString() : null,
          activatedAt: row.portal_activated_at != null ? new Date(row.portal_activated_at).toISOString() : null,
          revokedAt: row.portal_revoked_at != null ? new Date(row.portal_revoked_at).toISOString() : null,
          revokedReason: row.portal_revoked_reason,
          lastLoginAt: row.last_login_at != null ? new Date(row.last_login_at).toISOString() : null,
          inviteExpiresAt: expiresAt,
          linked: row.user_id != null && row.user_id !== '',
        },
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/clients/:id/portal-invite-link
   * Return the latest unexpired PENDING invite URL for a client.
   */
  router.get('/clients/:id/portal-invite-link', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = getUserContext(req);
      const permissionService = new PermissionService();
      if (!permissionService.hasPermission(context, 'clients:update')) {
        res.status(403).json({ success: false, error: 'Permission denied: requires clients:update' });
        return;
      }

      const clientId = req.params['id']!;
      const clientRes = await db.query<{ organization_id: string }>(
        `SELECT organization_id FROM clients WHERE id = $1 AND deleted_at IS NULL`,
        [clientId]
      );
      const clientRow = clientRes.rows[0];
      if (clientRow === undefined || clientRow.organization_id !== context.organizationId) {
        res.status(404).json({ success: false, error: `Client not found: ${clientId}` });
        return;
      }

      const auditService = new AuditService(db);
      const portalAccessService = new PortalAccessService(db, permissionService, auditService);
      const pending = await portalAccessService.getLatestPendingInvite('CLIENT', clientId);
      if (pending === null) {
        res.status(404).json({ success: false, error: 'No pending invite link found' });
        return;
      }

      const baseUrl = process.env['FRONTEND_URL'] ?? `${req.protocol}://${req.get('host')}`;
      res.json({
        success: true,
        data: {
          inviteUrl: portalAccessService.buildInviteUrl(baseUrl, pending.token),
          inviteExpiresAt: pending.expiresAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/clients/:id/portal-suspend
   * Temporarily suspend client portal access
   */
  router.post('/clients/:id/portal-suspend', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = getUserContext(req);
      const permissionService = new PermissionService();
      if (!permissionService.hasPermission(context, 'clients:update')) {
        res.status(403).json({ success: false, error: 'Permission denied: requires clients:update' });
        return;
      }
      const parseResult = revokeReasonSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ success: false, error: parseResult.error.issues[0]?.message ?? 'Invalid reason' });
        return;
      }
      const auditService = new AuditService(db);
      const portalAccessService = new PortalAccessService(db, permissionService, auditService);
      await portalAccessService.suspendClientAccess(req.params['id']!, parseResult.data.reason, context);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ success: false, error: error.message });
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

  return router;
}
