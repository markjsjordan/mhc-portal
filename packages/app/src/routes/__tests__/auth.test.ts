/**
 * Authentication Routes Tests
 *
 * Comprehensive integration tests for all authentication endpoints:
 * - Google OAuth login
 * - Password login
 * - Token refresh
 * - Logout
 * - Get current user (me)
 *
 * Security-critical: 100% coverage required
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import type { Database } from '@folkcare/core';
import { AuthenticationError, ValidationError } from '@folkcare/core';
import { createAuthRouter } from '../auth.js';

// Mock AuthService and AuthMiddleware
const mockAuthService = {
  authenticateWithGoogle: vi.fn(),
  authenticateWithPassword: vi.fn(),
  refreshToken: vi.fn(),
  logout: vi.fn(),
};

const mockAuthMiddleware = {
  requireAuth: vi.fn((req, res, next) => {
     
    if (req.headers.authorization) {
      req.user = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        organizationId: '223e4567-e89b-12d3-a456-426614174000',
        roles: ['caregiver'],
        permissions: ['visits:view'],
        tokenVersion: 1,
      };
      next();
    } else {
      res.status(401).json({ error: 'Not authenticated' });
    }
  }),
  requireRole: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
};

// Mock the core module
vi.mock('@folkcare/core', async () => {
  const actual = await vi.importActual('@folkcare/core');
  return {
    ...actual,
    AuthService: vi.fn(function() {
      return mockAuthService;
    }),
    AuthMiddleware: vi.fn(function() {
      return {
        requireAuth: mockAuthMiddleware.requireAuth,
        requireRole: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
      };
    }),
  };
});

describe('Authentication Routes', () => {
  let app: Express;
  let mockDb: Database;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());

    mockDb = {
      query: vi.fn(),
    } as unknown as Database;

    const authRouter = createAuthRouter(mockDb);
    app.use('/api/auth', authRouter);

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('POST /api/auth/login/google', () => {
    it('should successfully authenticate with valid Google ID token', async () => {
      const mockUser = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        organizationId: '223e4567-e89b-12d3-a456-426614174000',
        roles: ['caregiver'],
        permissions: ['visits:view', 'visits:update'],
      };

      const mockTokens = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      };

      mockAuthService.authenticateWithGoogle.mockResolvedValue({
        user: mockUser,
        tokens: mockTokens,
      });

      const response = await request(app)
        .post('/api/auth/login/google')
        .send({ idToken: 'valid-google-id-token' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toEqual(mockUser);
      expect(response.body.data.tokens.accessToken).toBe(mockTokens.accessToken);
      expect(response.body.data.tokens.refreshToken).toBeUndefined();
      expect(mockAuthService.authenticateWithGoogle).toHaveBeenCalledWith(
        'valid-google-id-token',
        undefined
      );
    });

    it('should accept organizationId for new user registration', async () => {
      mockAuthService.authenticateWithGoogle.mockResolvedValue({
        user: {},
        tokens: {},
      });

      const response = await request(app)
        .post('/api/auth/login/google')
        .send({
          idToken: 'valid-google-id-token',
          organizationId: '323e4567-e89b-12d3-a456-426614174000',
        });

      expect(response.status).toBe(200);
      expect(mockAuthService.authenticateWithGoogle).toHaveBeenCalledWith(
        'valid-google-id-token',
        '323e4567-e89b-12d3-a456-426614174000'
      );
    });

    it('should return 400 when idToken is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login/google')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Google ID token is required');
      expect(response.body.code).toBe('MISSING_ID_TOKEN');
    });

    it('should return 400 when idToken is not a string', async () => {
      const response = await request(app)
        .post('/api/auth/login/google')
        .send({ idToken: 12345 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Google ID token is required');
      expect(response.body.code).toBe('MISSING_ID_TOKEN');
    });

    it('should handle ValidationError from auth service', async () => {
      const validationError = new ValidationError('Invalid token format');
      (validationError as any).code = 'INVALID_TOKEN';
      (validationError as any).context = { field: 'idToken' };

      mockAuthService.authenticateWithGoogle.mockRejectedValue(validationError);

      const response = await request(app)
        .post('/api/auth/login/google')
        .send({ idToken: 'invalid-token' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid token format');
      expect(response.body.code).toBe('INVALID_TOKEN');
      expect(response.body.context).toEqual({ field: 'idToken' });
    });

    it('should handle AuthenticationError from auth service', async () => {
      const authError = new AuthenticationError('Token expired');
      (authError as any).code = 'TOKEN_EXPIRED';

      mockAuthService.authenticateWithGoogle.mockRejectedValue(authError);

      const response = await request(app)
        .post('/api/auth/login/google')
        .send({ idToken: 'expired-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Token expired');
      expect(response.body.code).toBe('TOKEN_EXPIRED');
    });

    it('should handle unexpected errors', async () => {
      mockAuthService.authenticateWithGoogle.mockRejectedValue(
        new Error('Network error')
      );

      const response = await request(app)
        .post('/api/auth/login/google')
        .send({ idToken: 'valid-token' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Network error');
      expect(response.body.code).toBe('AUTH_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should successfully authenticate with valid credentials', async () => {
      const mockUser = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'admin@example.com',
        organizationId: '223e4567-e89b-12d3-a456-426614174000',
        roles: ['admin'],
        permissions: ['*:*'],
      };

      const mockTokens = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      };

      mockAuthService.authenticateWithPassword.mockResolvedValue({
        user: mockUser,
        tokens: mockTokens,
      });

      const response = await request(app)
        .post('/api/auth/login')
        .set('User-Agent', 'Mozilla/5.0')
        .send({
          email: 'admin@example.com',
          // eslint-disable-next-line sonarjs/no-hardcoded-passwords
          password: 'SecurePassword123!', // Test password
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toEqual(mockUser);
      expect(response.body.data.tokens.accessToken).toBe(mockTokens.accessToken);
      expect(response.body.data.tokens.refreshToken).toBeUndefined();

      // Verify HttpOnly refresh token cookie is set
      const cookies = response.headers['set-cookie'] as string[] | undefined;
      expect(cookies).toBeDefined();
      const refreshCookie = cookies?.find((c: string) => c.startsWith('mhc_rt='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('Path=/api/auth');
      expect(refreshCookie).toContain('SameSite=Strict');

      // Verify audit logging parameters
      // eslint-disable-next-line sonarjs/no-hardcoded-passwords
      const expectedPassword = 'SecurePassword123!';
      expect(mockAuthService.authenticateWithPassword).toHaveBeenCalledWith(
        'admin@example.com',
        expectedPassword,
        expect.any(String), // IP address
        'Mozilla/5.0' // User agent
      );
    });

    it('should return 400 when email is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        // eslint-disable-next-line sonarjs/no-hardcoded-passwords
        .send({ password: 'password123' }); // Test password

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email is required');
      expect(response.body.code).toBe('MISSING_EMAIL');
    });

    it('should return 400 when password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Password is required');
      expect(response.body.code).toBe('MISSING_PASSWORD');
    });

    it('should return 400 when email is not a string', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        // eslint-disable-next-line sonarjs/no-hardcoded-passwords
        .send({ email: 12345, password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email is required');
    });

    it('should return 400 when password is not a string', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 12345 }); // Invalid password type

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Password is required');
    });

    it('should return 401 for invalid credentials', async () => {
      const authError = new AuthenticationError('Invalid credentials');
      (authError as any).code = 'INVALID_CREDENTIALS';

      mockAuthService.authenticateWithPassword.mockRejectedValue(authError);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          // eslint-disable-next-line sonarjs/no-hardcoded-passwords
          password: 'wrongpassword', // Test password
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid credentials');
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should handle unexpected errors', async () => {
      mockAuthService.authenticateWithPassword.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          // eslint-disable-next-line sonarjs/no-hardcoded-passwords
          password: 'password123', // Test password
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
      expect(response.body.code).toBe('AUTH_ERROR');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should successfully refresh access token', async () => {
      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';

      mockAuthService.refreshToken.mockResolvedValue({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBe(newAccessToken);
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('valid-refresh-token');

      // Verify new HttpOnly refresh token cookie is set (rotation)
      const cookies = response.headers['set-cookie'] as string[] | undefined;
      expect(cookies).toBeDefined();
      const refreshCookie = cookies?.find((c: string) => c.startsWith('mhc_rt='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('Path=/api/auth');
    });

    it('should return 400 when refreshToken is missing', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Refresh token is required');
      expect(response.body.code).toBe('MISSING_REFRESH_TOKEN');
    });

    it('should return 400 when refreshToken is not a string', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 12345 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Refresh token is required');
    });

    it('should return 401 for invalid refresh token', async () => {
      const authError = new AuthenticationError('Invalid refresh token');
      (authError as any).code = 'INVALID_REFRESH_TOKEN';

      mockAuthService.refreshToken.mockRejectedValue(authError);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid refresh token');
      expect(response.body.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('should return 401 for expired refresh token', async () => {
      const authError = new AuthenticationError('Refresh token expired');
      (authError as any).code = 'TOKEN_EXPIRED';

      mockAuthService.refreshToken.mockRejectedValue(authError);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'expired-token' });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('TOKEN_EXPIRED');
    });

    it('should handle unexpected errors', async () => {
      mockAuthService.refreshToken.mockRejectedValue(
        new Error('Service unavailable')
      );

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'valid-token' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Service unavailable');
      expect(response.body.code).toBe('REFRESH_ERROR');
    });

    it('should accept refresh token from cookie (cookie-first)', async () => {
      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';

      mockAuthService.refreshToken.mockResolvedValue({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', ['mhc_rt=cookie-refresh-token']);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('cookie-refresh-token');
    });

    it('should clear cookie on refresh failure', async () => {
      const authError = new AuthenticationError('Refresh token expired');
      (authError as any).code = 'TOKEN_EXPIRED';

      mockAuthService.refreshToken.mockRejectedValue(authError);

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', ['mhc_rt=expired-cookie-token']);

      expect(response.status).toBe(401);

      // Verify cookie is cleared
      const cookies = response.headers['set-cookie'] as string[] | undefined;
      expect(cookies).toBeDefined();
      const clearCookie = cookies?.find((c: string) => c.startsWith('mhc_rt='));
      expect(clearCookie).toBeDefined();
      expect(clearCookie).toContain('Max-Age=0');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should successfully logout authenticated user', async () => {
      mockAuthService.logout.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
      expect(mockAuthService.logout).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000'
      );

      // Verify refresh token cookie is cleared
      const cookies = response.headers['set-cookie'] as string[] | undefined;
      expect(cookies).toBeDefined();
      const clearCookie = cookies?.find((c: string) => c.startsWith('mhc_rt='));
      expect(clearCookie).toBeDefined();
      expect(clearCookie).toContain('Max-Age=0');
    });

    it('should return 401 when user is not authenticated', async () => {
      const response = await request(app).post('/api/auth/logout');

      expect(response.status).toBe(401);
    });

    it('should handle errors during logout', async () => {
      mockAuthService.logout.mockRejectedValue(
        new Error('Token revocation failed')
      );

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Token revocation failed');
      expect(response.body.code).toBe('LOGOUT_ERROR');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current authenticated user', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        organizationId: '223e4567-e89b-12d3-a456-426614174000',
        defaultBranchId: null,
        roles: ['caregiver'],
        permissions: ['visits:view'],
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });
  });
});
