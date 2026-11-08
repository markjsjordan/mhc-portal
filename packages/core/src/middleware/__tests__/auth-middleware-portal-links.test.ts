import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import { AuthMiddleware } from '../auth-middleware.js';
import { JWTUtils, type TokenPayload } from '../../utils/jwt-utils.js';
import type { Database } from '../../db/connection.js';

const TEST_SECRET = 'test-jwt-secret-at-least-32-characters-long-for-security';
const TEST_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long-security';

describe('AuthMiddleware - Portal Link Context Population (Lane 3C)', () => {
  let mockDb: Database;
  let authMiddleware: AuthMiddleware;
  let originalSecret: string | undefined;
  let originalRefreshSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env['JWT_SECRET'];
    originalRefreshSecret = process.env['JWT_REFRESH_SECRET'];
    process.env['JWT_SECRET'] = TEST_SECRET;
    process.env['JWT_REFRESH_SECRET'] = TEST_REFRESH_SECRET;

    mockDb = {
      query: vi.fn(),
    } as unknown as Database;

    authMiddleware = new AuthMiddleware(mockDb);
  });

  afterEach(() => {
    if (originalSecret !== undefined) {
      process.env['JWT_SECRET'] = originalSecret;
    } else {
      delete process.env['JWT_SECRET'];
    }
    if (originalRefreshSecret !== undefined) {
      process.env['JWT_REFRESH_SECRET'] = originalRefreshSecret;
    } else {
      delete process.env['JWT_REFRESH_SECRET'];
    }
  });

  it('populates caregiverId and family fields from verified payload into req.userContext and ignores headers', async () => {
    const payload: TokenPayload = {
      userId: '11111111-1111-1111-1111-111111111111',
      email: 'caregiver@example.com',
      organizationId: '22222222-2222-2222-2222-222222222222',
      branchIds: ['33333333-3333-3333-3333-333333333333'],
      roles: ['CAREGIVER'],
      permissions: ['visits:read'],
      tokenVersion: 1,
      caregiverId: 'cg-legit-777',
      familyMemberIds: ['fm-1'],
      familyClientIds: ['client-1'],
    };

    const token = JWTUtils.generateTokenPair(payload).accessToken;

    (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [
        {
          id: payload.userId,
          status: 'ACTIVE',
          token_version: 1,
        },
      ],
    });

    const mockReq = {
      headers: {
        authorization: `Bearer ${token}`,
        'x-caregiver-id': 'hacker-injected-cg-id',
      },
      ip: '127.0.0.1',
    } as unknown as Request;

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    const nextFn = vi.fn();

    await authMiddleware.requireAuth(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalled();
    expect(mockReq.userContext).toBeDefined();
    expect(mockReq.userContext?.caregiverId).toBe('cg-legit-777');
    expect(mockReq.userContext?.caregiverId).not.toBe('hacker-injected-cg-id');
    expect(mockReq.userContext?.familyMemberIds).toEqual(['fm-1']);
    expect(mockReq.userContext?.familyClientIds).toEqual(['client-1']);
  });
});
