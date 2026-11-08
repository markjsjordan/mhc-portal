import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from '../auth-service.js';
import { PasswordUtils } from '../../utils/password-utils.js';
import { JWTUtils } from '../../utils/jwt-utils.js';
import { initCacheService, getCacheService } from '../cache.service.js';
import type { Database } from '../../db/connection.js';

const TEST_SECRET = 'test-jwt-secret-at-least-32-characters-long-for-security';
const TEST_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long-security';

describe('AuthService - Derived Portal Roles & Tokens (Lane 3C)', () => {
  let mockDb: Database;
  let authService: AuthService;
  let originalSecret: string | undefined;
  let originalRefreshSecret: string | undefined;

  beforeEach(async () => {
    originalSecret = process.env['JWT_SECRET'];
    originalRefreshSecret = process.env['JWT_REFRESH_SECRET'];
    process.env['JWT_SECRET'] = TEST_SECRET;
    process.env['JWT_REFRESH_SECRET'] = TEST_REFRESH_SECRET;

    await initCacheService();
    mockDb = {
      query: vi.fn(),
    } as unknown as Database;

    authService = new AuthService(mockDb);
  });

  afterEach(async () => {
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
    const cache = getCacheService();
    await cache.clearAll();
    await cache.close();
  });

  it('populates derived roles and caregiverId in login token payload', async () => {
    const rawPass = ['Str0ng', 'P@ssw0rd', '1234!'].join('');
    const passwordHash = PasswordUtils.hashPassword(rawPass);
    const userRow = {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'nurse.caregiver@example.com',
      password_hash: passwordHash,
      first_name: 'Jane',
      last_name: 'Doe',
      organization_id: '22222222-2222-2222-2222-222222222222',
      branch_ids: ['33333333-3333-3333-3333-333333333333'],
      roles: ['COORDINATOR'], // staff role
      permissions: ['visits:read'],
      status: 'ACTIVE',
      locked_until: null,
      token_version: 1,
    };

    const queryFn = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users\n           WHERE email = $1')) {
        return { rows: [userRow] };
      }
      if (sql.includes('FROM caregivers')) {
        return { rows: [{ id: 'cg-active-99' }] };
      }
      if (sql.includes('FROM family_members fm')) {
        return { rows: [] };
      }
      if (sql.includes('UPDATE users SET last_login_at')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO audit_events')) {
        return { rows: [] };
      }
      return { rows: [] };
    });
    mockDb.query = queryFn;

    const result = await authService.authenticateWithPassword(
      'nurse.caregiver@example.com',
      rawPass
    );

    expect(result.user.roles).toContain('COORDINATOR');
    expect(result.user.roles).toContain('CAREGIVER');

    const decoded = JWTUtils.verifyAccessToken(result.tokens.accessToken);
    expect(decoded.roles).toEqual(['COORDINATOR', 'CAREGIVER']);
    expect(decoded.caregiverId).toBe('cg-active-99');
    expect(decoded.familyMemberIds).toEqual([]);
    expect(decoded.familyClientIds).toEqual([]);
  });

  it('refresh after a link revoke drops CAREGIVER and caregiverId from token', async () => {
    const userRow = {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'revoked.caregiver@example.com',
      first_name: 'Revoked',
      last_name: 'User',
      organization_id: '22222222-2222-2222-2222-222222222222',
      branch_ids: [],
      roles: ['COORDINATOR'],
      permissions: [],
      status: 'ACTIVE',
      token_version: 2,
    };

    const initialTokenPair = JWTUtils.generateTokenPair({
      userId: userRow.id,
      email: userRow.email,
      organizationId: userRow.organization_id,
      branchIds: [],
      roles: ['COORDINATOR', 'CAREGIVER'],
      permissions: [],
      tokenVersion: 2,
      caregiverId: 'cg-active-99',
    });

    // When refreshing, link is now REVOKED, so query for caregivers returns empty
    const queryFn = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users\n           WHERE id = $1')) {
        return { rows: [userRow] };
      }
      if (sql.includes('FROM caregivers')) {
        return { rows: [] }; // No active link
      }
      if (sql.includes('FROM family_members fm')) {
        return { rows: [] };
      }
      return { rows: [] };
    });
    mockDb.query = queryFn;

    const refreshed = await authService.refreshToken(initialTokenPair.refreshToken);
    const decodedNew = JWTUtils.verifyAccessToken(refreshed.accessToken);

    expect(decodedNew.roles).toEqual(['COORDINATOR']);
    expect(decodedNew.caregiverId).toBeUndefined();
  });
});
