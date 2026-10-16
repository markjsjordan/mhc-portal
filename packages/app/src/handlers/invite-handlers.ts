/**
 * Invite handlers for Folk Care
 * Manages invitation generation and acceptance.
 *
 * Security notes:
 * - Raw invite tokens come from a CSPRNG (32 bytes, base64url). Only the
 *   SHA-256 hash is persisted; the raw token is returned to the caller once.
 * - Tokens are single-use (PENDING -> ACCEPTED) and expire after INVITE_TTL_MS.
 * - Unknown, used, and expired tokens return the same response (no oracle).
 * - Tokens are never logged.
 */

import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { PasswordUtils, type Database } from '@folkcare/core';

export interface InviteHandler {
  generateInvite(req: Request, res: Response): Promise<void>;
  acceptInvite(req: Request, res: Response): Promise<void>;
}

/** Invite validity window (7 days). */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const TOKEN_BYTES = 32;
// Accept base64url tokens of 32-128 chars (generated tokens are 43; hex-64 test fixtures also pass).
const TOKEN_PATTERN = /^[\w-]{32,128}$/;
const MIN_PASSWORD_LENGTH = 8;

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function headerValue(req: Request, name: string): string | undefined {
  const headers = req.headers as Record<string, unknown> | undefined;
  const value = headers?.[name];
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  return undefined;
}

/**
 * Create invite handlers factory
 */
export function createInviteHandlers(db?: Database): InviteHandler {
  return {
    async generateInvite(req: Request, res: Response): Promise<void> {
      const actorId = headerValue(req, 'x-user-id');
      if (actorId === undefined) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }
      if (db === undefined) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Database unavailable' });
        return;
      }

      const orgId = String(req.params['orgId'] ?? '');
      const body = (req.body ?? {}) as {
        email?: unknown;
        firstName?: unknown;
        lastName?: unknown;
        role?: unknown;
        permissions?: unknown;
      };
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (email === '' || !email.includes('@')) {
        res.status(400).json({ error: 'VALIDATION_ERROR', message: 'A valid email is required' });
        return;
      }
      const firstName = typeof body.firstName === 'string' ? body.firstName : null;
      const lastName = typeof body.lastName === 'string' ? body.lastName : null;
      const role = typeof body.role === 'string' ? body.role : 'TEAM_MEMBER';
      const permissions = Array.isArray(body.permissions) ? body.permissions.map(String) : [];

      // 1) Email must not already belong to a user.
      const existing = await db.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
      if (existing.rows.length > 0) {
        res.status(409).json({ error: 'CONFLICT', message: 'A user with this email already exists' });
        return;
      }

      // 2) No outstanding pending invite for this email in this org.
      const pending = await db.query(
        `SELECT id FROM invite_tokens
          WHERE organization_id = $1 AND email = $2 AND status = 'PENDING' AND expires_at > NOW()`,
        [orgId, email]
      );
      if (pending.rows.length > 0) {
        res.status(409).json({ error: 'CONFLICT', message: 'A pending invite already exists for this email' });
        return;
      }

      // 3) Create the inactive user record the invite is bound to.
      const user = await db.query<{ id: string }>(
        `INSERT INTO users (email, first_name, last_name, organization_id, role, status, created_by)
         VALUES ($1, $2, $3, $4, $5, 'PENDING_ACTIVATION', $6)
         RETURNING id`,
        [email, firstName, lastName, orgId, role, actorId]
      );
      const newUserId = user.rows[0]?.id;
      if (newUserId === undefined) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create invite' });
        return;
      }

      // 4) Create the single-use invite token (hash stored, raw token returned once).
      const token = generateToken();
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
      const invite = await db.query<{ id: string; created_at: Date }>(
        `INSERT INTO invite_tokens
           (token, organization_id, email, first_name, last_name, roles, expires_at,
            status, accepted_user_id, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, ARRAY[$6]::VARCHAR[], $7, 'PENDING', $8, $9, $9)
         RETURNING id, created_at`,
        [hashToken(token), orgId, email, firstName, lastName, role, expiresAt, newUserId, actorId]
      );
      const row = invite.rows[0];
      if (row === undefined) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create invite' });
        return;
      }

      res.status(201).json({
        id: row.id,
        email,
        role,
        permissions,
        organizationId: orgId,
        token,
        expiresAt: expiresAt.toISOString(),
        createdAt: row.created_at,
      });
    },

    async acceptInvite(req: Request, res: Response): Promise<void> {
      if (db === undefined) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Database unavailable' });
        return;
      }

      const token = String(req.params['token'] ?? '');
      if (!TOKEN_PATTERN.test(token)) {
        res.status(400).json({ error: 'INVALID_TOKEN', message: 'Invite link is invalid' });
        return;
      }
      const body = (req.body ?? {}) as {
        password?: unknown;
        acceptTermsOfService?: unknown;
        acceptPrivacyPolicy?: unknown;
      };
      if (body.acceptTermsOfService !== true || body.acceptPrivacyPolicy !== true) {
        res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Terms and privacy policy must be accepted' });
        return;
      }
      if (typeof body.password !== 'string' || body.password.length < MIN_PASSWORD_LENGTH) {
        res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' });
        return;
      }

      // 1) Look up the invite by hash; must be PENDING and unexpired.
      const invites = await db.query<{
        id: string;
        user_id: string;
        organization_id: string;
        status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
        expires_at: Date;
      }>(
        `SELECT id, accepted_user_id AS user_id, organization_id, status, expires_at
           FROM invite_tokens WHERE token = $1`,
        [hashToken(token)]
      );
      const invite = invites.rows.at(0);
      const expired = invite === undefined ? true : new Date(invite.expires_at) <= new Date();
      if (invite?.status !== 'PENDING' || expired) {
        res.status(404).json({ error: 'INVALID_TOKEN', message: 'Invite link is invalid or has expired' });
        return;
      }

      // 2) Load the pending user bound to this invite.
      const users = await db.query<{ id: string; status: string }>(
        'SELECT id, status FROM users WHERE id = $1',
        [invite.user_id]
      );
      const user = users.rows[0];
      if (user?.status !== 'PENDING_ACTIVATION') {
        res.status(409).json({ error: 'CONFLICT', message: 'Invite can no longer be accepted' });
        return;
      }

      // 3) Activate the user, storing only a salted PBKDF2 hash of the password.
      //    Plaintext is never persisted or logged.
      const passwordHash = PasswordUtils.hashPassword(body.password);
      const activated = await db.query<{ id: string; status: string }>(
        `UPDATE users SET status = 'ACTIVE', password_hash = $2
          WHERE id = $1 AND status = 'PENDING_ACTIVATION'
         RETURNING id, status`,
        [user.id, passwordHash]
      );
      if (activated.rows.length === 0) {
        res.status(409).json({ error: 'CONFLICT', message: 'Invite can no longer be accepted' });
        return;
      }

      // 4) Consume the token so it cannot be reused.
      await db.query(
        `UPDATE invite_tokens
            SET status = 'ACCEPTED', accepted_at = NOW(), updated_by = $2
          WHERE id = $1 AND status = 'PENDING'`,
        [invite.id, user.id]
      );

      res.status(200).json({ id: user.id, status: 'ACTIVE', organizationId: invite.organization_id });
    },
  };
}
