/**
 * PortalAccessService
 *
 * Unified Identity and Portal Access Service for caregivers and family members.
 * Implements administrative invitations, token acceptance, manual/automatic access revocation,
 * multi-role account reconciliation, token version invalidation, and HIPAA-compliant audit logging.
 */

import type { PoolClient } from 'pg';
import { Database } from '../db/connection.js';
import { PermissionService } from '../permissions/permission-service.js';
import { AuditService } from '../audit/audit-service.js';
import {
  UserContext,
  UUID,
  ValidationError,
  NotFoundError,
  ConflictError,
  PermissionError,
} from '../types/base.js';
import { randomBytes } from '../utils/crypto.js';

export interface PortalInviteResult {
  token: string;
  expiresAt: Date;
}

export type CaregiverEmploymentStatus =
  | 'ACTIVE'
  | 'ON_LEAVE'
  | 'SUSPENDED'
  | 'TERMINATED'
  | 'RETIRED';

export type ClientStatus =
  | 'INQUIRY'
  | 'PENDING_INTAKE'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'ON_HOLD'
  | 'DISCHARGED'
  | 'DECEASED';

export class PortalAccessService {
  constructor(
    private readonly db: Database,
    private readonly permissions: PermissionService,
    private readonly audit: AuditService
  ) {}

  private generateInviteToken(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Invite a caregiver to the portal
   */
  async inviteCaregiver(
    caregiverId: UUID,
    context: UserContext
  ): Promise<PortalInviteResult> {
    this.permissions.requirePermission(context, 'caregivers:update');

    const orgId = context.organizationId;
    if (orgId === undefined || orgId === '') {
      throw new ValidationError('Organization ID is required in user context');
    }

    const caregiverRes = await this.db.query<{
      id: string;
      organization_id: string;
      email: string | null;
      first_name: string | null;
      last_name: string | null;
      employment_status: string;
      deleted_at: Date | null;
    }>(
      `SELECT id, organization_id, email, first_name, last_name, employment_status, deleted_at
       FROM caregivers
       WHERE id = $1 AND deleted_at IS NULL`,
      [caregiverId]
    );

    const caregiver = caregiverRes.rows[0];
    if (caregiver === undefined) {
      throw new NotFoundError(`Caregiver not found: ${caregiverId}`);
    }

    if (caregiver.organization_id !== orgId) {
      throw new NotFoundError(`Caregiver not found in organization: ${caregiverId}`);
    }

    if (['TERMINATED', 'RETIRED'].includes(caregiver.employment_status)) {
      throw new ValidationError(
        `Cannot invite caregiver with employment status ${caregiver.employment_status}`
      );
    }

    const trimmedEmail = caregiver.email?.trim();
    if (trimmedEmail === undefined || trimmedEmail === '') {
      throw new ValidationError('Caregiver must have a valid email to be invited');
    }

    const token = this.generateInviteToken();
    const expiresInDays = 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    await this.db.transaction(async (client: PoolClient) => {
      // 1. Mark any existing PENDING invite tokens for this caregiver as REVOKED
      await client.query(
        `UPDATE invite_tokens
         SET status = 'REVOKED', updated_by = $2
         WHERE target_type = 'CAREGIVER' AND target_id = $1 AND status = 'PENDING'`,
        [caregiverId, context.userId]
      );

      // 2. Insert new invite token (roles '{}', target_type 'CAREGIVER', target_id caregiverId)
      await client.query(
        `INSERT INTO invite_tokens (
           token, organization_id, email, first_name, last_name,
           roles, branch_ids, expires_at, status, created_by, updated_by,
           target_type, target_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', $9, $9, $10, $11)`,
        [
          token,
          orgId,
          trimmedEmail.toLowerCase(),
          caregiver.first_name,
          caregiver.last_name,
          [],
          [],
          expiresAt,
          context.userId,
          'CAREGIVER',
          caregiverId,
        ]
      );

      // 3. Update caregivers portal access status
      await client.query(
        `UPDATE caregivers
         SET portal_access_status = 'INVITED',
             portal_invited_at = NOW(),
             updated_at = NOW(),
             updated_by = $2
         WHERE id = $1`,
        [caregiverId, context.userId]
      );
    });

    await this.audit.logEvent(context, {
      eventType: 'PORTAL_INVITATION_SENT',
      resource: 'caregiver',
      resourceId: caregiverId,
      action: 'INVITE_CAREGIVER',
      result: 'SUCCESS',
      metadata: {
        targetType: 'CAREGIVER',
        caregiverId,
      },
    });

    return { token, expiresAt };
  }

  /**
   * Invite a family member to the portal
   */
  async inviteFamilyMember(
    familyMemberId: UUID,
    context: UserContext
  ): Promise<PortalInviteResult> {
    this.permissions.requirePermission(context, 'clients:update');

    const orgId = context.organizationId;
    if (orgId === undefined || orgId === '') {
      throw new ValidationError('Organization ID is required in user context');
    }

    const fmRes = await this.db.query<{
      id: string;
      client_id: string;
      email: string | null;
      first_name: string | null;
      last_name: string | null;
      client_organization_id: string;
      client_status: string;
    }>(
      `SELECT fm.id, fm.client_id, fm.email, fm.first_name, fm.last_name,
              c.organization_id as client_organization_id, c.status as client_status
       FROM family_members fm
       JOIN clients c ON c.id = fm.client_id
       WHERE fm.id = $1`,
      [familyMemberId]
    );

    const familyMember = fmRes.rows[0];
    if (familyMember === undefined) {
      throw new NotFoundError(`Family member not found: ${familyMemberId}`);
    }

    if (familyMember.client_organization_id !== orgId) {
      throw new NotFoundError(
        `Family member client not found in organization: ${familyMemberId}`
      );
    }

    if (['DISCHARGED', 'DECEASED'].includes(familyMember.client_status)) {
      throw new ValidationError(
        `Cannot invite family member of client with status ${familyMember.client_status}`
      );
    }

    const trimmedEmail = familyMember.email?.trim();
    if (trimmedEmail === undefined || trimmedEmail === '') {
      throw new ValidationError('Family member must have a valid email to be invited');
    }

    const token = this.generateInviteToken();
    const expiresInDays = 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    await this.db.transaction(async (client: PoolClient) => {
      // 1. Mark existing pending tokens as REVOKED
      await client.query(
        `UPDATE invite_tokens
         SET status = 'REVOKED', updated_by = $2
         WHERE target_type = 'FAMILY' AND target_id = $1 AND status = 'PENDING'`,
        [familyMemberId, context.userId]
      );

      // 2. Insert new invite token
      await client.query(
        `INSERT INTO invite_tokens (
           token, organization_id, email, first_name, last_name,
           roles, branch_ids, expires_at, status, created_by, updated_by,
           target_type, target_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', $9, $9, $10, $11)`,
        [
          token,
          orgId,
          trimmedEmail.toLowerCase(),
          familyMember.first_name,
          familyMember.last_name,
          [],
          [],
          expiresAt,
          context.userId,
          'FAMILY',
          familyMemberId,
        ]
      );

      // 3. Update family_members portal status
      await client.query(
        `UPDATE family_members
         SET portal_access_status = 'INVITED',
             portal_invited_at = NOW(),
             invitation_status = 'PENDING',
             invitation_sent_at = NOW(),
             updated_at = NOW(),
             updated_by = $2
         WHERE id = $1`,
        [familyMemberId, context.userId]
      );
    });

    await this.audit.logEvent(context, {
      eventType: 'PORTAL_INVITATION_SENT',
      resource: 'family_member',
      resourceId: familyMemberId,
      action: 'INVITE_FAMILY_MEMBER',
      result: 'SUCCESS',
      metadata: {
        targetType: 'FAMILY',
        familyMemberId,
        clientId: familyMember.client_id,
      },
    });

    return { token, expiresAt };
  }

  /**
   * Invite a client directly to the portal (CLIENT role)
   */
  async inviteClient(
    clientId: UUID,
    context: UserContext
  ): Promise<PortalInviteResult> {
    this.permissions.requirePermission(context, 'clients:update');

    const orgId = context.organizationId;
    if (orgId === undefined || orgId === '') {
      throw new ValidationError('Organization ID is required in user context');
    }

    const clientRes = await this.db.query<{
      id: string;
      organization_id: string;
      email: string | null;
      first_name: string | null;
      last_name: string | null;
      status: string;
      deleted_at: Date | null;
    }>(
      `SELECT id, organization_id, email, first_name, last_name, status, deleted_at
       FROM clients
       WHERE id = $1 AND deleted_at IS NULL`,
      [clientId]
    );

    const client = clientRes.rows[0];
    if (client === undefined) {
      throw new NotFoundError(`Client not found: ${clientId}`);
    }

    if (client.organization_id !== orgId) {
      throw new NotFoundError(`Client not found in organization: ${clientId}`);
    }

    if (['DISCHARGED', 'DECEASED'].includes(client.status)) {
      throw new ValidationError(
        `Cannot invite client with status ${client.status}`
      );
    }

    const trimmedEmail = client.email?.trim();
    if (trimmedEmail === undefined || trimmedEmail === '') {
      throw new ValidationError('Client must have a valid email to be invited');
    }

    const token = this.generateInviteToken();
    const expiresInDays = 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    await this.db.transaction(async (txClient: PoolClient) => {
      // 1. Mark existing pending tokens as REVOKED
      await txClient.query(
        `UPDATE invite_tokens
         SET status = 'REVOKED', updated_by = $2
         WHERE target_type = 'CLIENT' AND target_id = $1 AND status = 'PENDING'`,
        [clientId, context.userId]
      );

      // 2. Insert new invite token
      await txClient.query(
        `INSERT INTO invite_tokens (
           token, organization_id, email, first_name, last_name,
           roles, branch_ids, expires_at, status, created_by, updated_by,
           target_type, target_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', $9, $9, $10, $11)`,
        [
          token,
          orgId,
          trimmedEmail.toLowerCase(),
          client.first_name,
          client.last_name,
          [],
          [],
          expiresAt,
          context.userId,
          'CLIENT',
          clientId,
        ]
      );

      // 3. Update clients portal status
      await txClient.query(
        `UPDATE clients
         SET portal_access_status = 'INVITED',
             portal_invited_at = NOW(),
             updated_at = NOW(),
             updated_by = $2
         WHERE id = $1`,
        [clientId, context.userId]
      );
    });

    await this.audit.logEvent(context, {
      eventType: 'PORTAL_INVITATION_SENT',
      resource: 'client',
      resourceId: clientId,
      action: 'INVITE_CLIENT',
      result: 'SUCCESS',
      metadata: {
        targetType: 'CLIENT',
        clientId,
      },
    });

    return { token, expiresAt };
  }

  private async linkCaregiverOnInviteAccept(
    client: PoolClient,
    caregiverId: string,
    userId: UUID
  ): Promise<void> {
    const cgRes = await client.query<{
      id: string;
      user_id: string | null;
      portal_access_status: string;
      employment_status: string;
    }>(
      `SELECT id, user_id, portal_access_status, employment_status FROM caregivers WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [caregiverId]
    );
    const cg = cgRes.rows[0];
    if (cg === undefined) {
      throw new NotFoundError(`Caregiver not found: ${caregiverId}`);
    }

    if (
      cg.portal_access_status !== 'INVITED' ||
      ['TERMINATED', 'RETIRED'].includes(cg.employment_status)
    ) {
      throw new ConflictError('Portal invitation is no longer valid');
    }

    if (typeof cg.user_id === 'string' && cg.user_id !== userId) {
      throw new ConflictError(
        `Caregiver is already linked to a different user account`
      );
    }

    await client.query(
      `UPDATE caregivers
       SET user_id = $2,
           portal_access_status = 'ACTIVE',
           portal_activated_at = NOW(),
           updated_at = NOW(),
           updated_by = $2
       WHERE id = $1`,
      [caregiverId, userId]
    );
  }

  private async linkFamilyMemberOnInviteAccept(
    client: PoolClient,
    familyMemberId: string,
    userId: UUID
  ): Promise<void> {
    const fmRes = await client.query<{
      id: string;
      user_id: string | null;
      portal_access_status: string;
      client_status: string;
    }>(
      `SELECT fm.id, fm.user_id, fm.portal_access_status, c.status as client_status
       FROM family_members fm
       JOIN clients c ON c.id = fm.client_id
       WHERE fm.id = $1
       FOR UPDATE`,
      [familyMemberId]
    );
    const fm = fmRes.rows[0];
    if (fm === undefined) {
      throw new NotFoundError(`Family member not found: ${familyMemberId}`);
    }

    if (
      fm.portal_access_status !== 'INVITED' ||
      ['DISCHARGED', 'DECEASED'].includes(fm.client_status)
    ) {
      throw new ConflictError('Portal invitation is no longer valid');
    }

    if (typeof fm.user_id === 'string' && fm.user_id !== userId) {
      throw new ConflictError(
        `Family member is already linked to a different user account`
      );
    }

    await client.query(
      `UPDATE family_members
       SET user_id = $2,
           portal_access_status = 'ACTIVE',
           portal_activated_at = NOW(),
           invitation_status = 'ACCEPTED',
           invitation_accepted_at = NOW(),
           updated_at = NOW(),
           updated_by = $2
       WHERE id = $1`,
      [familyMemberId, userId]
    );
  }

  private async linkClientOnInviteAccept(
    client: PoolClient,
    clientId: string,
    userId: UUID
  ): Promise<void> {
    const clientRes = await client.query<{
      id: string;
      user_id: string | null;
      portal_access_status: string | null;
      status: string;
    }>(
      `SELECT id, user_id, portal_access_status, status
       FROM clients
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [clientId]
    );
    const clientRow = clientRes.rows[0];
    if (clientRow === undefined) {
      throw new NotFoundError(`Client not found: ${clientId}`);
    }

    if (
      clientRow.portal_access_status !== 'INVITED' ||
      ['DISCHARGED', 'DECEASED'].includes(clientRow.status)
    ) {
      throw new ConflictError('Portal invitation is no longer valid');
    }

    if (typeof clientRow.user_id === 'string' && clientRow.user_id !== userId) {
      throw new ConflictError(
        `Client is already linked to a different user account`
      );
    }

    await client.query(
      `UPDATE clients
       SET user_id = $2,
           portal_access_status = 'ACTIVE',
           portal_activated_at = NOW(),
           updated_at = NOW(),
           updated_by = $2
       WHERE id = $1`,
      [clientId, userId]
    );
  }

  /**
   * Accept an invitation token and link the identity to the portal record
   */
  async acceptPortalInvite(token: string, userId: UUID): Promise<void> {
    const inviteRes = await this.db.query<{
      id: string;
      token: string;
      organization_id: string;
      email: string;
      status: string;
      expires_at: Date;
      target_type: 'STAFF' | 'CAREGIVER' | 'FAMILY' | 'CLIENT' | null;
      target_id: string | null;
    }>(
      `SELECT id, token, organization_id, email, status, expires_at, target_type, target_id
       FROM invite_tokens
       WHERE token = $1`,
      [token]
    );

    const invite = inviteRes.rows[0];
    if (invite === undefined) {
      throw new NotFoundError('Invite token not found');
    }

    if (invite.status !== 'PENDING') {
      throw new ValidationError(`Invite token is ${invite.status.toLowerCase()}`);
    }

    if (new Date(invite.expires_at) <= new Date()) {
      throw new ValidationError('Invite token has expired');
    }

    const targetType = invite.target_type;
    const targetId = invite.target_id;
    if (targetType === null || targetId === null) {
      throw new ValidationError('Invite token does not have a linked portal target');
    }

    const userRes = await this.db.query<{
      id: string;
      organization_id: string;
      email: string;
      status: string;
    }>(
      `SELECT id, organization_id, email, status FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    const user = userRes.rows[0];
    if (user === undefined) {
      throw new NotFoundError(`User not found: ${userId}`);
    }

    if (user.organization_id !== invite.organization_id) {
      throw new PermissionError('Invite belongs to a different organization');
    }

    if (user.email.trim().toLowerCase() !== invite.email.trim().toLowerCase()) {
      throw new PermissionError('Invite was issued to a different email address');
    }

    if (user.status === 'INACTIVE') {
      throw new PermissionError('Deactivated accounts cannot accept invitations');
    }

    await this.db.transaction(async (client: PoolClient) => {
      if (targetType === 'CAREGIVER') {
        await this.linkCaregiverOnInviteAccept(client, targetId, userId);
      } else if (targetType === 'FAMILY') {
        await this.linkFamilyMemberOnInviteAccept(client, targetId, userId);
      } else if (targetType === 'CLIENT') {
        await this.linkClientOnInviteAccept(client, targetId, userId);
      } else {
        throw new ValidationError(`Unsupported portal target type: ${String(targetType)}`);
      }

      // Mark invite token as ACCEPTED
      await client.query(
        `UPDATE invite_tokens
         SET status = 'ACCEPTED',
             accepted_user_id = $2,
             accepted_at = NOW(),
             updated_by = $2
         WHERE id = $1`,
        [invite.id, userId]
      );

      // Bump token_version for the user
      await client.query(
        `UPDATE users
         SET token_version = token_version + 1,
             updated_at = NOW(),
             updated_by = $1
         WHERE id = $1`,
        [userId]
      );
    });

    const auditContext: UserContext = {
      userId,
      organizationId: invite.organization_id,
      roles: [],
      permissions: [],
      branchIds: [],
    };

    const auditResourceByTarget = new Map<string, string>([
      ['CAREGIVER', 'caregiver'],
      ['CLIENT', 'client'],
      ['FAMILY', 'family_member'],
    ]);
    const auditResource = auditResourceByTarget.get(targetType) ?? 'family_member';
    await this.audit.logEvent(auditContext, {
      eventType: 'PORTAL_INVITATION_ACCEPTED',
      resource: auditResource,
      resourceId: targetId,
      action: 'ACCEPT_PORTAL_INVITATION',
      result: 'SUCCESS',
      metadata: {
        targetType,
        targetId,
        userId,
      },
    });
  }

  /**
   * Manual caregiver portal access revocation
   */
  async revokeCaregiverAccess(
    caregiverId: UUID,
    reason: string,
    context: UserContext
  ): Promise<void> {
    this.permissions.requirePermission(context, 'caregivers:update');
    await this.performCaregiverRevoke(caregiverId, reason, context, 'MANUAL');
  }

  /**
   * Manual family member portal access revocation
   */
  async revokeFamilyAccess(
    familyMemberId: UUID,
    reason: string,
    context: UserContext
  ): Promise<void> {
    this.permissions.requirePermission(context, 'clients:update');
    await this.performFamilyRevoke(familyMemberId, reason, context, 'MANUAL');
  }

  /**
   * Manual client portal access revocation
   */
  async revokeClientAccess(
    clientId: UUID,
    reason: string,
    context: UserContext
  ): Promise<void> {
    this.permissions.requirePermission(context, 'clients:update');
    await this.assertClientInOrg(clientId, context);
    await this.performClientRevoke(clientId, reason, context, 'MANUAL');
  }

  /**
   * Temporarily suspend client portal access (reversible by re-invite)
   */
  async suspendClientAccess(
    clientId: UUID,
    reason: string,
    context: UserContext
  ): Promise<void> {
    this.permissions.requirePermission(context, 'clients:update');

    const orgId = context.organizationId;
    if (orgId === undefined || orgId === '') {
      throw new ValidationError('Organization ID is required in user context');
    }

    const clientRes = await this.db.query<{
      id: string;
      organization_id: string;
      user_id: string | null;
      portal_access_status: string | null;
    }>(
      `SELECT id, organization_id, user_id, portal_access_status
       FROM clients
       WHERE id = $1 AND deleted_at IS NULL`,
      [clientId]
    );
    const row = clientRes.rows[0];
    if (row?.organization_id !== orgId) {
      throw new NotFoundError(`Client not found: ${clientId}`);
    }
    if (row.portal_access_status !== 'ACTIVE') {
      throw new ConflictError('Only ACTIVE client portal access can be suspended');
    }

    const linkedUserId = row.user_id;
    await this.db.transaction(async (txClient: PoolClient) => {
      await txClient.query(
        `UPDATE clients
         SET portal_access_status = 'SUSPENDED',
             portal_revoked_reason = $3,
             updated_at = NOW(),
             updated_by = $2
         WHERE id = $1`,
        [clientId, context.userId, reason]
      );
      if (typeof linkedUserId === 'string' && linkedUserId !== '') {
        await this.reconcileUserAccount(txClient, linkedUserId, context.userId, 'SUSPENDED');
      }
    });

    await this.audit.logEvent(context, {
      eventType: 'PORTAL_ACCESS_SUSPENDED',
      resource: 'client',
      resourceId: clientId,
      action: 'SUSPEND_CLIENT_ACCESS',
      result: 'SUCCESS',
      metadata: { targetType: 'CLIENT', clientId },
    });
  }

  /**
   * Handle caregiver status transition (automatic hooks)
   */
  async handleCaregiverStatusChange(
    caregiverId: UUID,
    previousStatus: CaregiverEmploymentStatus,
    newStatus: CaregiverEmploymentStatus,
    context: UserContext
  ): Promise<void> {
    if (newStatus === 'TERMINATED' || newStatus === 'RETIRED') {
      await this.performCaregiverRevoke(
        caregiverId,
        `Status changed to ${newStatus}`,
        context,
        'AUTO_REVOKE'
      );
    } else if (newStatus === 'SUSPENDED') {
      await this.performCaregiverSuspend(
        caregiverId,
        'Caregiver suspended',
        context,
        'AUTO_REVOKE'
      );
    } else if (previousStatus === 'SUSPENDED' && newStatus === 'ACTIVE') {
      await this.performCaregiverRestore(
        caregiverId,
        'Caregiver reinstated to ACTIVE',
        context
      );
    }
  }

  /**
   * Handle client status change (automatic hooks)
   * DISCHARGED/DECEASED revokes every ACTIVE/INVITED/SUSPENDED family link AND direct client portal access
   */
  async handleClientStatusChange(
    clientId: UUID,
    _previousStatus: ClientStatus,
    newStatus: ClientStatus,
    context: UserContext
  ): Promise<void> {
    if (newStatus !== 'DISCHARGED' && newStatus !== 'DECEASED') {
      return;
    }

    // Revoke family member portal access
    const fmRes = await this.db.query<{ id: string }>(
      `SELECT id FROM family_members
       WHERE client_id = $1
         AND portal_access_status IN ('ACTIVE', 'INVITED', 'SUSPENDED')`,
      [clientId]
    );

    for (const row of fmRes.rows) {
      await this.performFamilyRevoke(
        row.id,
        `Client status changed to ${newStatus}`,
        context,
        'AUTO_REVOKE'
      );
    }

    // Revoke direct client portal access
    const clientRes = await this.db.query<{ id: string; portal_access_status: string | null }>(
      `SELECT id, portal_access_status FROM clients
       WHERE id = $1
         AND portal_access_status IN ('ACTIVE', 'INVITED', 'SUSPENDED')`,
      [clientId]
    );

    if (clientRes.rows[0] !== undefined) {
      await this.performClientRevoke(
        clientId,
        `Client status changed to ${newStatus}`,
        context,
        'AUTO_REVOKE'
      );
    }
  }

  private async performCaregiverRevoke(
    caregiverId: UUID,
    reason: string,
    context: UserContext,
    trigger: 'MANUAL' | 'AUTO_REVOKE'
  ): Promise<void> {
    const cgRes = await this.db.query<{
      id: string;
      user_id: string | null;
      portal_access_status: string;
      organization_id: string;
    }>(
      `SELECT id, user_id, portal_access_status, organization_id
       FROM caregivers
       WHERE id = $1 AND deleted_at IS NULL`,
      [caregiverId]
    );

    const caregiver = cgRes.rows[0];
    if (caregiver === undefined) {
      throw new NotFoundError(`Caregiver not found: ${caregiverId}`);
    }

    let userDeactivated = false;
    const linkedUserId = caregiver.user_id;

    await this.db.transaction(async (client: PoolClient) => {
      // 1. Update caregiver portal access status to REVOKED
      await client.query(
        `UPDATE caregivers
         SET portal_access_status = 'REVOKED',
             portal_revoked_at = NOW(),
             portal_revoked_by = $2,
             portal_revoked_reason = $3,
             updated_at = NOW(),
             updated_by = $2
         WHERE id = $1`,
        [caregiverId, context.userId, reason]
      );

      // 2. Mark any PENDING invite tokens as REVOKED
      await client.query(
        `UPDATE invite_tokens
         SET status = 'REVOKED', updated_by = $2
         WHERE target_type = 'CAREGIVER' AND target_id = $1 AND status = 'PENDING'`,
        [caregiverId, context.userId]
      );

      // 3. Reconcile user account if linked
      if (typeof linkedUserId === 'string' && linkedUserId !== '') {
        userDeactivated = await this.reconcileUserAccount(
          client,
          linkedUserId,
          context.userId,
          'INACTIVE'
        );
      }
    });

    await this.audit.logEvent(context, {
      eventType: 'PORTAL_ACCESS_REVOKED',
      resource: 'caregiver',
      resourceId: caregiverId,
      action: 'REVOKE_CAREGIVER_ACCESS',
      result: 'SUCCESS',
      metadata: {
        targetType: 'CAREGIVER',
        caregiverId,
        trigger,
        userAccountDeactivated: userDeactivated,
        ...(typeof linkedUserId === 'string' ? { linkedUserId } : {}),
      },
    });
  }

  private async performCaregiverSuspend(
    caregiverId: UUID,
    reason: string,
    context: UserContext,
    trigger: 'MANUAL' | 'AUTO_REVOKE'
  ): Promise<void> {
    const cgRes = await this.db.query<{
      id: string;
      user_id: string | null;
      portal_access_status: string;
    }>(
      `SELECT id, user_id, portal_access_status
       FROM caregivers
       WHERE id = $1 AND deleted_at IS NULL`,
      [caregiverId]
    );

    const caregiver = cgRes.rows[0];
    if (caregiver === undefined) {
      throw new NotFoundError(`Caregiver not found: ${caregiverId}`);
    }

    let userDeactivated = false;
    const linkedUserId = caregiver.user_id;

    await this.db.transaction(async (client: PoolClient) => {
      // 1. Update portal_access_status to SUSPENDED
      await client.query(
        `UPDATE caregivers
         SET portal_access_status = 'SUSPENDED',
             portal_revoked_at = NOW(),
             portal_revoked_by = $2,
             portal_revoked_reason = $3,
             updated_at = NOW(),
             updated_by = $2
         WHERE id = $1`,
        [caregiverId, context.userId, reason]
      );

      // 2. Reconcile user account (suspend if no other active links/staff roles)
      if (typeof linkedUserId === 'string' && linkedUserId !== '') {
        userDeactivated = await this.reconcileUserAccount(
          client,
          linkedUserId,
          context.userId,
          'SUSPENDED'
        );
      }
    });

    await this.audit.logEvent(context, {
      eventType: 'PORTAL_ACCESS_SUSPENDED',
      resource: 'caregiver',
      resourceId: caregiverId,
      action: 'SUSPEND_CAREGIVER_ACCESS',
      result: 'SUCCESS',
      metadata: {
        targetType: 'CAREGIVER',
        caregiverId,
        trigger,
        userAccountDeactivated: userDeactivated,
        ...(typeof linkedUserId === 'string' ? { linkedUserId } : {}),
      },
    });
  }

  private async performCaregiverRestore(
    caregiverId: UUID,
    _reason: string,
    context: UserContext
  ): Promise<void> {
    const cgRes = await this.db.query<{
      id: string;
      user_id: string | null;
      portal_access_status: string;
    }>(
      `SELECT id, user_id, portal_access_status
       FROM caregivers
       WHERE id = $1 AND deleted_at IS NULL`,
      [caregiverId]
    );

    const caregiver = cgRes.rows[0];
    if (caregiver === undefined) {
      throw new NotFoundError(`Caregiver not found: ${caregiverId}`);
    }

    // Only restore if it was previously SUSPENDED
    if (caregiver.portal_access_status !== 'SUSPENDED') {
      return;
    }

    const linkedUserId = caregiver.user_id;

    await this.db.transaction(async (client: PoolClient) => {
      await client.query(
        `UPDATE caregivers
         SET portal_access_status = 'ACTIVE',
             portal_revoked_at = NULL,
             portal_revoked_by = NULL,
             portal_revoked_reason = NULL,
             updated_at = NOW(),
             updated_by = $2
         WHERE id = $1`,
        [caregiverId, context.userId]
      );

      if (typeof linkedUserId === 'string' && linkedUserId !== '') {
        // If user was suspended, restore them to ACTIVE and bump token_version
        await client.query(
          `UPDATE users
           SET status = CASE WHEN status = 'SUSPENDED' THEN 'ACTIVE' ELSE status END,
               token_version = token_version + 1,
               updated_at = NOW(),
               updated_by = $2
           WHERE id = $1`,
          [linkedUserId, context.userId]
        );
      }
    });

    await this.audit.logEvent(context, {
      eventType: 'PORTAL_ACCESS_RESTORED',
      resource: 'caregiver',
      resourceId: caregiverId,
      action: 'RESTORE_CAREGIVER_ACCESS',
      result: 'SUCCESS',
      metadata: {
        targetType: 'CAREGIVER',
        caregiverId,
        trigger: 'MANUAL',
        userAccountDeactivated: false,
        ...(typeof linkedUserId === 'string' ? { linkedUserId } : {}),
      },
    });
  }

  private async performFamilyRevoke(
    familyMemberId: UUID,
    reason: string,
    context: UserContext,
    trigger: 'MANUAL' | 'AUTO_REVOKE'
  ): Promise<void> {
    const fmRes = await this.db.query<{
      id: string;
      client_id: string;
      user_id: string | null;
      portal_access_status: string;
    }>(
      `SELECT id, client_id, user_id, portal_access_status
       FROM family_members
       WHERE id = $1`,
      [familyMemberId]
    );

    const familyMember = fmRes.rows[0];
    if (familyMember === undefined) {
      throw new NotFoundError(`Family member not found: ${familyMemberId}`);
    }

    let userDeactivated = false;
    const linkedUserId = familyMember.user_id;

    await this.db.transaction(async (client: PoolClient) => {
      // 1. Update family member portal access status
      await client.query(
        `UPDATE family_members
         SET portal_access_status = 'REVOKED',
             invitation_status = 'REVOKED',
             portal_revoked_at = NOW(),
             portal_revoked_by = $2,
             portal_revoked_reason = $3,
             updated_at = NOW(),
             updated_by = $2
         WHERE id = $1`,
        [familyMemberId, context.userId, reason]
      );

      // 2. Mark any PENDING invite tokens as REVOKED
      await client.query(
        `UPDATE invite_tokens
         SET status = 'REVOKED', updated_by = $2
         WHERE target_type = 'FAMILY' AND target_id = $1 AND status = 'PENDING'`,
        [familyMemberId, context.userId]
      );

      // 3. Reconcile user account if linked
      if (typeof linkedUserId === 'string' && linkedUserId !== '') {
        userDeactivated = await this.reconcileUserAccount(
          client,
          linkedUserId,
          context.userId,
          'INACTIVE'
        );
      }
    });

    await this.audit.logEvent(context, {
      eventType: 'PORTAL_ACCESS_REVOKED',
      resource: 'family_member',
      resourceId: familyMemberId,
      action: 'REVOKE_FAMILY_ACCESS',
      result: 'SUCCESS',
      metadata: {
        targetType: 'FAMILY',
        familyMemberId,
        clientId: familyMember.client_id,
        trigger,
        userAccountDeactivated: userDeactivated,
        ...(typeof linkedUserId === 'string' ? { linkedUserId } : {}),
      },
    });
  }

  private async assertClientInOrg(clientId: UUID, context: UserContext): Promise<void> {
    const res = await this.db.query<{ organization_id: string }>(
      `SELECT organization_id FROM clients WHERE id = $1 AND deleted_at IS NULL`,
      [clientId]
    );
    const row = res.rows[0];
    if (row === undefined || row.organization_id !== context.organizationId) {
      throw new NotFoundError(`Client not found: ${clientId}`);
    }
  }

  private async performClientRevoke(
    clientId: UUID,
    reason: string,
    context: UserContext,
    trigger: 'MANUAL' | 'AUTO_REVOKE'
  ): Promise<void> {
    const clientRes = await this.db.query<{
      id: string;
      user_id: string | null;
      portal_access_status: string | null;
    }>(
      `SELECT id, user_id, portal_access_status
       FROM clients
       WHERE id = $1 AND deleted_at IS NULL`,
      [clientId]
    );

    const client = clientRes.rows[0];
    if (client === undefined) {
      throw new NotFoundError(`Client not found: ${clientId}`);
    }

    let userDeactivated = false;
    const linkedUserId = client.user_id;

    await this.db.transaction(async (txClient: PoolClient) => {
      // 1. Update client portal access status
      await txClient.query(
        `UPDATE clients
         SET portal_access_status = 'REVOKED',
             portal_revoked_at = NOW(),
             portal_revoked_by = $2,
             portal_revoked_reason = $3,
             updated_at = NOW(),
             updated_by = $2
         WHERE id = $1`,
        [clientId, context.userId, reason]
      );

      // 2. Mark any PENDING invite tokens as REVOKED
      await txClient.query(
        `UPDATE invite_tokens
         SET status = 'REVOKED', updated_by = $2
         WHERE target_type = 'CLIENT' AND target_id = $1 AND status = 'PENDING'`,
        [clientId, context.userId]
      );

      // 3. Reconcile user account if linked
      if (typeof linkedUserId === 'string' && linkedUserId !== '') {
        userDeactivated = await this.reconcileUserAccount(
          txClient,
          linkedUserId,
          context.userId,
          'INACTIVE'
        );
      }
    });

    await this.audit.logEvent(context, {
      eventType: 'PORTAL_ACCESS_REVOKED',
      resource: 'client',
      resourceId: clientId,
      action: 'REVOKE_CLIENT_ACCESS',
      result: 'SUCCESS',
      metadata: {
        targetType: 'CLIENT',
        clientId,
        trigger,
        userAccountDeactivated: userDeactivated,
        ...(typeof linkedUserId === 'string' ? { linkedUserId } : {}),
      },
    });
  }

  /**
   * Reconcile user account status and bump token version.
   *
   * Rule:
   * users.roles holds STAFF roles only (never CAREGIVER, FAMILY, or CLIENT).
   * users.status is changed only when the person has NO other ACTIVE or INVITED link
   * and no staff roles (staff roles = every role in users.roles other than CAREGIVER, FAMILY, and CLIENT).
   * Then set status to 'INACTIVE' or 'SUSPENDED' when the only link was suspended.
   * Bump token_version = token_version + 1 in the SAME transaction.
   *
   * @returns true if user status was changed to targetStatus, false otherwise.
   */
  private async reconcileUserAccount(
    client: PoolClient,
    userId: UUID,
    actorUserId: UUID,
    targetStatus: 'INACTIVE' | 'SUSPENDED'
  ): Promise<boolean> {
    const userRes = await client.query<{
      id: string;
      roles: string[];
      status: string;
    }>(
      `SELECT id, roles, status FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [userId]
    );

    const user = userRes.rows[0];
    if (user === undefined) {
      return false;
    }

    const staffRoles = user.roles.filter(
      (r) => r !== 'CAREGIVER' && r !== 'FAMILY' && r !== 'CLIENT'
    );
    const hasStaffRoles = staffRoles.length > 0;

    const activeOrInvitedLinksRes = await client.query<{ count: string }>(
      `SELECT (
         (SELECT COUNT(*) FROM caregivers WHERE user_id = $1 AND deleted_at IS NULL AND portal_access_status IN ('ACTIVE', 'INVITED')) +
         (SELECT COUNT(*) FROM family_members WHERE user_id = $1 AND portal_access_status IN ('ACTIVE', 'INVITED')) +
         (SELECT COUNT(*) FROM clients WHERE user_id = $1 AND deleted_at IS NULL AND portal_access_status IN ('ACTIVE', 'INVITED'))
       ) AS count`,
      [userId]
    );

    const countStr = activeOrInvitedLinksRes.rows[0]?.count ?? '0';
    const activeOrInvitedCount = Number.parseInt(countStr, 10);

    let deactivated = false;

    if (!hasStaffRoles && activeOrInvitedCount === 0) {
      await client.query(
        `UPDATE users
         SET status = $2,
             token_version = token_version + 1,
             updated_at = NOW(),
             updated_by = $3
         WHERE id = $1`,
        [userId, targetStatus, actorUserId]
      );
      deactivated = true;
    } else {
      // Still active under another persona or staff role; bump token_version to refresh claims
      await client.query(
        `UPDATE users
         SET token_version = token_version + 1,
             updated_at = NOW(),
             updated_by = $2
         WHERE id = $1`,
        [userId, actorUserId]
      );
    }

    return deactivated;
  }
}
