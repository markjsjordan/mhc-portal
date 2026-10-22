/**
 * Authentication Routes
 * 
 * Production-ready authentication with:
 * - Google OAuth 2.0
 * - Password authentication
 * - JWT token management
 * - HIPAA-compliant audit logging
 */

import { randomUUID } from 'node:crypto';
import { Router, Request, Response } from 'express';
import { 
  AuthService, 
  AuthMiddleware, 
  AuditService,
  JWTUtils,
  TokenPayload,
  Database, 
  ValidationError, 
  AuthenticationError 
} from '@folkcare/core';

export function createAuthRouter(db: Database): Router {
  const router = Router();
  const authService = new AuthService(db);
  const authMiddleware = new AuthMiddleware(db);

  /**
   * @openapi
   * /api/auth/login/google:
   *   post:
   *     tags:
   *       - Authentication
   *     summary: Authenticate with Google OAuth
   *     description: Authenticate user using Google ID token and receive JWT tokens
   *     security: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - idToken
   *             properties:
   *               idToken:
   *                 type: string
   *                 description: Google ID token from client
   *                 example: eyJhbGciOiJSUzI1NiIsImtpZCI6...
   *               organizationId:
   *                 type: string
   *                 format: uuid
   *                 description: Organization ID for new user registration (optional)
   *                 example: 123e4567-e89b-12d3-a456-426614174000
   *     responses:
   *       200:
   *         description: Authentication successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     user:
   *                       $ref: '#/components/schemas/User'
   *                     tokens:
   *                       type: object
   *                       properties:
   *                         accessToken:
   *                           type: string
   *                         refreshToken:
   *                           type: string
   *       400:
   *         description: Invalid request
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 error:
   *                   type: string
   *                 code:
   *                   type: string
   *       401:
   *         description: Authentication failed
   *       500:
   *         description: Server error
   */
  router.post('/login/google', async (req: Request, res: Response) => {
    try {
      const { idToken, organizationId } = req.body;

       
      if (!idToken || typeof idToken !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Google ID token is required',
          code: 'MISSING_ID_TOKEN'
        });
      }

      const result = await authService.authenticateWithGoogle(
        idToken,
        organizationId as string
      );

      return res.json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: error.code,
          context: error.context
        });
      }

      if (error instanceof AuthenticationError) {
        return res.status(401).json({
          success: false,
          error: error.message,
          code: error.code,
          context: error.context
        });
      }

      console.error('Google login error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
        code: 'AUTH_ERROR'
      });
    }
  });

  /**
   * @openapi
   * /api/auth/login:
   *   post:
   *     tags:
   *       - Authentication
   *     summary: Login with email and password
   *     description: Authenticate user with credentials and receive JWT tokens
   *     security: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 description: User email address
   *                 example: admin@example.com
   *               password:
   *                 type: string
   *                 format: password
   *                 description: User password
   *                 example: SecurePassword123!
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     user:
   *                       $ref: '#/components/schemas/User'
   *                     tokens:
   *                       type: object
   *                       properties:
   *                         accessToken:
   *                           type: string
   *                           description: JWT access token
   *                         refreshToken:
   *                           type: string
   *                           description: JWT refresh token
   *       400:
   *         description: Invalid request
   *       401:
   *         description: Invalid credentials
   *       500:
   *         description: Server error
   */
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Validate required fields
       
      if (!email || typeof email !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Email is required',
          code: 'MISSING_EMAIL'
        });
      }

       
      if (!password || typeof password !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Password is required',
          code: 'MISSING_PASSWORD'
        });
      }

      // Extract IP and user agent for audit logging
      const ipAddress = req.ip ?? req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.authenticateWithPassword(
        email,
        password,
        ipAddress,
        userAgent
      );

      return res.json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return res.status(401).json({
          success: false,
          error: error.message,
          code: error.code,
          context: error.context
        });
      }

      console.error('Password login error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
        code: 'AUTH_ERROR'
      });
    }
  });

  /**
   * @openapi
   * /api/auth/refresh:
   *   post:
   *     tags:
   *       - Authentication
   *     summary: Refresh access token
   *     description: Obtain a new access token using a valid refresh token
   *     security: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - refreshToken
   *             properties:
   *               refreshToken:
   *                 type: string
   *                 description: JWT refresh token
   *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   *     responses:
   *       200:
   *         description: Token refreshed successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     accessToken:
   *                       type: string
   *                       description: New JWT access token
   *       400:
   *         description: Invalid request
   *       401:
   *         description: Invalid or expired refresh token
   *       500:
   *         description: Server error
   */
  router.post('/refresh', async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

       
      if (!refreshToken || typeof refreshToken !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Refresh token is required',
          code: 'MISSING_REFRESH_TOKEN'
        });
      }

      const result = await authService.refreshToken(refreshToken);

      return res.json({
        success: true,
        data: result
      });
    } catch (error) {
      const err = error as { message?: string; code?: string; statusCode?: number; name?: string };
      if (error instanceof AuthenticationError || err.statusCode === 401 || err.name === 'AuthenticationError') {
        return res.status(401).json({
          success: false,
          error: err.message ?? 'Authentication failed',
          code: err.code ?? 'AUTHENTICATION_ERROR'
        });
      }

      console.error('Token refresh error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh token',
        code: 'REFRESH_ERROR'
      });
    }
  });

  /**
   * @openapi
   * /api/auth/logout:
   *   post:
   *     tags:
   *       - Authentication
   *     summary: Logout user
   *     description: >
   *       Logout the authenticated user. Increments the user's
   *       token_version, which invalidates every token issued to this
   *       user (all of their devices/sessions) — it does NOT affect
   *       any other user's session.
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Logout successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: Logged out successfully
   *       401:
   *         description: Not authenticated
   *       500:
   *         description: Server error
   */
   router.post('/logout', authMiddleware.requireAuth, async (req: Request, res: Response) => {
    try {
       
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
      }

      await authService.logout(req.user.userId);

      return res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Logout failed',
        code: 'LOGOUT_ERROR'
      });
    }
  });

  /**
   * @openapi
   * /api/auth/me:
   *   get:
   *     tags:
   *       - Authentication
   *     summary: Get current authenticated user
   *     description: Retrieve profile information for the currently authenticated user
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: User profile retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       format: uuid
   *                     email:
   *                       type: string
   *                       format: email
   *                     organizationId:
   *                       type: string
   *                       format: uuid
   *                     roles:
   *                       type: array
   *                       items:
   *                         type: string
   *                     permissions:
   *                       type: array
   *                       items:
   *                         type: string
   *       401:
   *         description: Not authenticated
   *       500:
   *         description: Server error
   */
   router.get('/me', authMiddleware.requireAuth, async (req: Request, res: Response) => {
    try {
       
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
      }

      let defaultBranchId: string | null = null;
      if (typeof req.user.organizationId === 'string' && req.user.organizationId.length > 0) {
        const orgResult = await db.query(
          'SELECT default_branch_id FROM organizations WHERE id = $1 AND deleted_at IS NULL',
          [req.user.organizationId]
        );
        const rows = orgResult?.rows;
        const row = Array.isArray(rows) ? (rows[0] as { default_branch_id?: string | null } | undefined) : undefined;
        defaultBranchId = row?.default_branch_id ?? null;
      }

      return res.json({
        success: true,
        data: {
          id: req.user.userId,
          email: req.user.email,
          organizationId: req.user.organizationId,
          defaultBranchId,
          roles: req.user.roles,
          permissions: req.user.permissions
        }
      });
    } catch (error) {
      console.error('Get current user error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user info',
        code: 'USER_INFO_ERROR'
      });
    }
  });

  /**
   * POST /api/auth/impersonate/start
   * Start impersonating a caregiver (admin only)
   */
  router.post(
    '/impersonate/start',
    authMiddleware.requireAuth,
    authMiddleware.requireRole(['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN']),
    // eslint-disable-next-line sonarjs/cognitive-complexity
    async (req: Request, res: Response) => {
      try {
        const admin = req.user as TokenPayload | undefined;
        if (admin === undefined) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
            code: 'UNAUTHORIZED'
          });
        }
        if (admin.impersonation !== undefined) {
          return res.status(400).json({
            success: false,
            error: 'Cannot start impersonation while already in an impersonation session',
            code: 'ALREADY_IMPERSONATING'
          });
        }

        const { caregiverId } = req.body as { caregiverId?: string };
         
        if (!caregiverId || typeof caregiverId !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'caregiverId is required',
            code: 'INVALID_INPUT'
          });
        }

        const targetUser = await authService.getUserByIdForImpersonation(caregiverId);
        if (targetUser === null) {
          return res.status(404).json({
            success: false,
            error: 'Target caregiver user not found',
            code: 'USER_NOT_FOUND'
          });
        }

        // Must be a CAREGIVER
        if (!targetUser.roles.includes('CAREGIVER')) {
          return res.status(403).json({
            success: false,
            error: 'Impersonation is restricted to caregivers',
            code: 'TARGET_NOT_CAREGIVER'
          });
        }

        // Scope check
        const isAdminSuper = admin.roles.includes('SUPER_ADMIN');
        const isAdminOrg = admin.roles.includes('ORG_ADMIN');
        const isAdminBranch = admin.roles.includes('BRANCH_ADMIN');

        if (!isAdminSuper) {
          if (isAdminOrg && targetUser.organization_id !== admin.organizationId) {
            return res.status(403).json({
              success: false,
              error: 'Cannot impersonate caregiver outside of your organization',
              code: 'IMPERSONATION_SCOPE_VIOLATION'
            });
          }

          if (isAdminBranch) {
            // BRANCH_ADMIN can only impersonate users in their own branch(es)
            // AND in the same organization
            if (targetUser.organization_id !== admin.organizationId) {
              return res.status(403).json({
                success: false,
                error: 'Cannot impersonate caregiver outside of your organization',
                code: 'IMPERSONATION_SCOPE_VIOLATION'
              });
            }
            const targetBranchIds = (targetUser.branch_ids ?? []) as string[];
            const adminBranchIds = (admin.branchIds ?? []) as string[];
            const sharesBranch = adminBranchIds.some((b: string) => targetBranchIds.includes(b));
            if (!sharesBranch) {
              return res.status(403).json({
                success: false,
                error: 'Cannot impersonate caregiver outside of your branch',
                code: 'IMPERSONATION_SCOPE_VIOLATION'
              });
            }
          }
        }

        const sessionId = randomUUID();
        const mergedPermissions = authService.getMergedPermissions(
          targetUser.permissions ?? [],
          targetUser.roles ?? []
        );

        const caregiverPayload: TokenPayload = {
          userId: targetUser.id,
          email: targetUser.email,
          organizationId: targetUser.organization_id,
          branchIds: targetUser.branch_ids ?? [],
          roles: targetUser.roles ?? [],
          permissions: mergedPermissions,
          tokenVersion: targetUser.token_version,
          impersonation: {
            adminUserId: admin.userId,
            adminEmail: admin.email,
            sessionId,
            startedAt: new Date().toISOString()
          }
        };

        const tokenResult = JWTUtils.generateImpersonationToken(caregiverPayload);

        const adminContext = {
          userId: admin.userId,
          organizationId: admin.organizationId,
          branchIds: admin.branchIds,
          roles: admin.roles,
          permissions: admin.permissions
        };

        const auditService = new AuditService(db);
        await auditService.logImpersonationEvent(
          adminContext,
          'IMPERSONATION_START',
          targetUser.id,
          targetUser.email,
          sessionId
        );

        const caregiverName = [targetUser.first_name, targetUser.last_name].filter(Boolean).join(' ');

        return res.json({
          success: true,
          data: {
            accessToken: tokenResult.accessToken,
            expiresIn: tokenResult.expiresIn,
            caregiver: {
              id: targetUser.id,
              email: targetUser.email,
              name: caregiverName
            }
          }
        });
      } catch (error) {
        console.error('Impersonate start error:', error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to start impersonation',
          code: 'IMPERSONATION_ERROR'
        });
      }
    }
  );

  /**
   * POST /api/auth/impersonate/end
   * End active impersonation session
   */
  router.post(
    '/impersonate/end',
    authMiddleware.requireAuth,
    async (req: Request, res: Response) => {
      try {
        const user = req.user as TokenPayload | undefined;
        if (user === undefined) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
            code: 'UNAUTHORIZED'
          });
        }
        if (user.impersonation === undefined) {
          return res.status(400).json({
            success: false,
            error: 'No active impersonation session to end',
            code: 'NOT_IMPERSONATING'
          });
        }

        const imp = user.impersonation;
        const adminContext = {
          userId: imp.adminUserId,
          organizationId: user.organizationId,
          branchIds: user.branchIds,
          roles: user.roles,
          permissions: user.permissions
        };

        const auditService = new AuditService(db);
        await auditService.logImpersonationEvent(
          adminContext,
          'IMPERSONATION_END',
          user.userId,
          user.email,
          imp.sessionId
        );

        return res.json({
          success: true,
          message: 'Impersonation session ended'
        });
      } catch (error) {
        console.error('Impersonate end error:', error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to end impersonation',
          code: 'IMPERSONATION_ERROR'
        });
      }
    }
  );

  return router;
}

/**
 * @openapi
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique user identifier
 *         email:
 *           type: string
 *           format: email
 *           description: User email address
 *         first_name:
 *           type: string
 *           description: User first name
 *         last_name:
 *           type: string
 *           description: User last name
 *         role:
 *           type: string
 *           enum: [admin, coordinator, caregiver, family]
 *           description: User role
 *         organization_id:
 *           type: string
 *           format: uuid
 *           description: Organization ID the user belongs to
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp when user was created
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp when user was last updated
 *     Error:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           description: Error message
 *         code:
 *           type: string
 *           description: Error code
 *         context:
 *           type: object
 *           description: Additional error context
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

export default createAuthRouter;
