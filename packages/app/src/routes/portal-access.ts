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
} from '@folkcare/core';

export type PortalAccessStatus = 'NONE' | 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export interface FamilyPortalAccessRow {
  familyMemberId: string;
  firstName: string;
  lastName: string;
  relationship: string;
  email: string;
  portalAccessLevel: 'VIEW_BASIC' | 'VIEW_DETAILED' | 'VIEW_MEDICAL' | 'VIEW_FINANCIAL' | 'FULL_ACCESS';
  status: PortalAccessStatus;
  invitedAt: string | null;
  activatedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  inviteExpiresAt: string | null;
  lastLoginAt: string | null;
  linked: boolean;
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
      email: string | null;
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
      email: fm.email ?? '',
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
      email: string | null;
      portal_access_level: string | null;
      portal_access_status: PortalAccessStatus | null;
      portal_invited_at: Date | null;
      portal_activated_at: Date | null;
      portal_revoked_at: Date | null;
      portal_revoked_reason: string | null;
      user_id: string | null;
      last_login_at: Date | null;
    }>(
      `SELECT fm.id, fm.first_name, fm.last_name, fm.relationship, fm.email,
              fm.portal_access_level, fm.portal_access_status, fm.portal_invited_at,
              fm.portal_activated_at, fm.portal_revoked_at, fm.portal_revoked_reason,
              fm.user_id, u.last_login_at
       FROM family_members fm
       LEFT JOIN users u ON u.id = fm.user_id AND u.deleted_at IS NULL
       WHERE fm.id = $1`,
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
        email: string | null;
        portal_access_level: string | null;
        portal_access_status: PortalAccessStatus | null;
        portal_invited_at: Date | null;
        portal_activated_at: Date | null;
        portal_revoked_at: Date | null;
        portal_revoked_reason: string | null;
        user_id: string | null;
        last_login_at: Date | null;
      }>(
        `SELECT fm.id, fm.first_name, fm.last_name, fm.relationship, fm.email,
                fm.portal_access_level, fm.portal_access_status, fm.portal_invited_at,
                fm.portal_activated_at, fm.portal_revoked_at, fm.portal_revoked_reason,
                fm.user_id, u.last_login_at
         FROM family_members fm
         LEFT JOIN users u ON u.id = fm.user_id AND u.deleted_at IS NULL
         WHERE fm.client_id = $1
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
         WHERE fm.id = $1`,
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

      const auditService = new AuditService(db);
      const portalAccessService = new PortalAccessService(db, permissionService, auditService);

      const inviteResult = await portalAccessService.inviteFamilyMember(familyMemberId, context);

      // Attempt email send
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
          recipientName: `${fmCheck.first_name ?? ''} ${fmCheck.last_name ?? ''}`.trim() || trimmedEmail,
          inviterName,
          organizationName: orgName,
          invitationToken: inviteResult.token,
          expiresAt: inviteResult.expiresAt,
        });
      } catch (err) {
        console.warn('[PortalAccess] Failed to send family invitation email:', err);
      }

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

      const auditService = new AuditService(db);
      const portalAccessService = new PortalAccessService(db, permissionService, auditService);

      const inviteResult = await portalAccessService.inviteClient(clientId, context);

      // Attempt email send
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
          recipientName: `${clientCheck.first_name ?? ''} ${clientCheck.last_name ?? ''}`.trim() || trimmedEmail,
          inviterName,
          organizationName: orgName,
          invitationToken: inviteResult.token,
          expiresAt: inviteResult.expiresAt,
        });
      } catch (err) {
        console.warn('[PortalAccess] Failed to send client invitation email:', err);
      }

      res.json({ success: true, data: inviteResult });
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
        portal_invited_at: Date | null;
        portal_activated_at: Date | null;
        portal_revoked_at: Date | null;
        portal_revoked_reason: string | null;
      }>(
        `SELECT id, organization_id, email, status, user_id, portal_access_status, portal_invited_at,
                portal_activated_at, portal_revoked_at, portal_revoked_reason
         FROM clients WHERE id = $1 AND deleted_at IS NULL`,
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
          invitedAt: row.portal_invited_at != null ? new Date(row.portal_invited_at).toISOString() : null,
          activatedAt: row.portal_activated_at != null ? new Date(row.portal_activated_at).toISOString() : null,
          revokedAt: row.portal_revoked_at != null ? new Date(row.portal_revoked_at).toISOString() : null,
          revokedReason: row.portal_revoked_reason,
          inviteExpiresAt: expiresAt,
          linked: row.user_id != null && row.user_id !== '',
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
