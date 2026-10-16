/**
 * Invite handlers for Folk Care
 * Manages invitation creation, validation, and acceptance
 */

import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { type Database, PasswordUtils } from '@folkcare/core';

export interface InviteHandler {
  generateInvite(req: Request, res: Response): Promise<void>;
  createInvite(req: Request, res: Response): Promise<void>;
  validateInvite(req: Request, res: Response): Promise<void>;
  acceptInvite(req: Request, res: Response): Promise<void>;
}

interface InvitationRow {
  id: string;
  user_id: string;
  organization_id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string | Date;
  created_at?: string | Date;
}

interface UserRow {
  id: string;
  status: string;
  organization_id: string;
}

interface GenerateInviteBody {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  permissions?: string[];
}

interface AcceptInviteBody {
  token?: string;
  password?: string;
  acceptTermsOfService?: boolean;
  acceptPrivacyPolicy?: boolean;
}

/**
 * Create invite handlers factory
 */
export function createInviteHandlers(db?: Database): InviteHandler {
  const getDb = (): Database => {
    if (db === undefined) {
      throw new Error('Database connection is required for invite handlers');
    }
    return db;
  };

  const generateInvite = async (req: Request, res: Response): Promise<void> => {
    try {
      const database = getDb();
      const authUser = (req as Request & { user?: { userId?: string } }).user;
      const headerUserId = req.headers['x-user-id'];
      const userId = (typeof headerUserId === 'string' ? headerUserId : undefined) ?? authUser?.userId;
      if (userId === undefined || userId === '') {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'User ID is required to create an invitation',
        });
        return;
      }

      const orgId = req.params['orgId'] ?? req.params['id'];
      const body = (req.body ?? {}) as GenerateInviteBody;
      const { email, firstName, lastName, role, permissions } = body;

      if (email === undefined || email === '') {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Email is required',
        });
        return;
      }

      // Check if user already exists
      const userCheck = await database.query('SELECT id FROM users WHERE email = $1', [email]);
      if (userCheck.rows.length > 0) {
        res.status(409).json({
          error: 'USER_EXISTS',
          message: 'User with this email already exists',
        });
        return;
      }

      // Check for existing pending invitation
      const inviteCheck = await database.query(
        'SELECT id FROM invitations WHERE email = $1 AND organization_id = $2 AND status = $3',
        [email, orgId, 'PENDING']
      );
      if (inviteCheck.rows.length > 0) {
        res.status(409).json({
          error: 'INVITE_EXISTS',
          message: 'Pending invitation already exists for this email',
        });
        return;
      }

      // Create user record in PENDING_ACTIVATION
      const userResult = await database.query(
        `INSERT INTO users (email, first_name, last_name, organization_id, status)
         VALUES ($1, $2, $3, $4, 'PENDING_ACTIVATION')
         RETURNING id`,
        [email, firstName ?? '', lastName ?? '', orgId]
      );

      const createdUser = userResult.rows[0] as UserRow | undefined;
      const newUserId = createdUser?.id ?? 'new-user';

      // Generate secure invitation token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const inviteResult = await database.query(
        `INSERT INTO invitations (organization_id, user_id, email, role, permissions, token, status, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)
         RETURNING id, created_at`,
        [orgId, newUserId, email, role ?? 'TEAM_MEMBER', JSON.stringify(permissions ?? []), token, expiresAt]
      );

      const invite = inviteResult.rows[0] as InvitationRow | undefined;
      if (invite === undefined) {
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Failed to create invitation record',
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: {
          invitationId: invite.id,
          token,
          createdAt: invite.created_at,
          expiresAt,
        },
      });
    } catch (error) {
      console.error('[InviteHandler] generateInvite error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to create invitation',
      });
    }
  };

  const validateInvite = async (req: Request, res: Response): Promise<void> => {
    try {
      const database = getDb();
      const params = req.params as Record<string, string> | undefined;
      const query = req.query as Record<string, unknown> | undefined;
      const paramToken = params !== undefined ? params['token'] : undefined;
      const queryToken = query !== undefined && typeof query['token'] === 'string' ? query['token'] : undefined;
      const token = paramToken ?? queryToken;

      if (token === undefined || token === '') {
        res.status(400).json({
          error: 'TOKEN_REQUIRED',
          message: 'Invitation token is required',
        });
        return;
      }

      const result = await database.query(
        'SELECT id, email, organization_id, role, status, expires_at FROM invitations WHERE token = $1',
        [token]
      );

      const invite = result.rows[0] as InvitationRow | undefined;
      if (invite === undefined) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Invitation not found',
        });
        return;
      }

      if (invite.status !== 'PENDING') {
        res.status(400).json({
          error: 'INVALID_STATUS',
          message: 'Invitation is no longer pending',
        });
        return;
      }

      const expiresAtDate = new Date(invite.expires_at);
      if (expiresAtDate < new Date()) {
        res.status(400).json({
          error: 'EXPIRED',
          message: 'Invitation has expired',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          id: invite.id,
          email: invite.email,
          organizationId: invite.organization_id,
          role: invite.role,
          status: invite.status,
          expiresAt: invite.expires_at,
        },
      });
    } catch (error) {
      console.error('[InviteHandler] validateInvite error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to validate invitation',
      });
    }
  };

  const acceptInvite = async (req: Request, res: Response): Promise<void> => {
    try {
      const database = getDb();
      const body = (req.body ?? {}) as AcceptInviteBody;
      const paramToken = req.params['token'];
      const rawToken = (typeof paramToken === 'string' ? paramToken : undefined) ?? body.token;
      const token = typeof rawToken === 'string' ? rawToken : undefined;

      if (token === undefined || token === '') {
        res.status(400).json({
          error: 'TOKEN_REQUIRED',
          message: 'Invitation token is required',
        });
        return;
      }

      const { password, acceptTermsOfService, acceptPrivacyPolicy } = body;

      if (
        password === undefined ||
        password === '' ||
        acceptTermsOfService !== true ||
        acceptPrivacyPolicy !== true
      ) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Password and acceptance of terms and privacy policy are required',
        });
        return;
      }

      // Query 1: Find invitation by token
      const inviteResult = await database.query(
        'SELECT id, user_id, organization_id, status, expires_at FROM invitations WHERE token = $1',
        [token]
      );

      const invite = inviteResult.rows[0] as InvitationRow | undefined;
      if (invite === undefined) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Invitation not found',
        });
        return;
      }

      if (invite.status !== 'PENDING') {
        res.status(400).json({
          error: 'INVALID_STATUS',
          message: 'Invitation is not pending',
        });
        return;
      }

      const expiresAtDate = new Date(invite.expires_at);
      if (expiresAtDate < new Date()) {
        res.status(400).json({
          error: 'EXPIRED',
          message: 'Invitation has expired',
        });
        return;
      }

      // Query 2: Find user by user_id
      const userResult = await database.query(
        'SELECT id, status, organization_id FROM users WHERE id = $1',
        [invite.user_id]
      );

      const user = userResult.rows[0] as UserRow | undefined;
      if (user === undefined) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'User account not found',
        });
        return;
      }

      if (user.status !== 'PENDING_ACTIVATION') {
        res.status(400).json({
          error: 'INVALID_USER_STATUS',
          message: 'User account is not pending activation',
        });
        return;
      }

      // Query 3: Hash password and update user to ACTIVE
      const passwordHash = PasswordUtils.hashPassword(password);
      const updatedUserResult = await database.query(
        `UPDATE users
         SET status = 'ACTIVE', password_hash = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, status`,
        [passwordHash, user.id]
      );

      // Query 4: Mark invitation as ACCEPTED
      await database.query(
        `UPDATE invitations SET status = 'ACCEPTED', accepted_at = NOW() WHERE id = $1`,
        [invite.id]
      );

      // Query 5: Write audit log
      const ip = req.ip ?? req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      await database.query(
        `INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, 'ACCEPT_INVITATION', 'INVITATION', $3, $4)`,
        [invite.organization_id, user.id, invite.id, JSON.stringify({ ip, userAgent })]
      );

      const updatedUser = updatedUserResult.rows[0] as UserRow | undefined;

      res.status(200).json({
        success: true,
        message: 'Invitation accepted successfully',
        data: {
          userId: user.id,
          status: updatedUser?.status ?? 'ACTIVE',
        },
      });
    } catch (error) {
      console.error('[InviteHandler] acceptInvite error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to accept invitation',
      });
    }
  };

  return {
    generateInvite,
    createInvite: generateInvite,
    validateInvite,
    acceptInvite,
  };
}
