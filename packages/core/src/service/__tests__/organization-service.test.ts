/**
 * Organization Service Tests
 *
 * Verifies invitation workflows including caregiver account linking.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrganizationService } from '../organization-service.js';
import type { Database } from '../../db/connection.js';
import type { AcceptInviteRequest } from '../../types/organization.js';

describe('OrganizationService - Invitation Accept (Caregiver Linking)', () => {
  let service: OrganizationService;
  let mockDb: Database;

  const sampleInviteToken = {
    id: 'invite-123',
    token: 'token-abc',
    email: 'caregiver@example.com',
    roles: ['CAREGIVER'],
    branchIds: ['branch-1'],
    createdBy: 'admin-1',
    status: 'PENDING',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      query: vi.fn(),
      transaction: vi.fn(async (callback) => {
        return await callback(mockDb);
      }),
    } as unknown as Database;

    service = new OrganizationService(mockDb);
  });

  const setupBaseMocks = (roles: string[] = ['CAREGIVER']) => {
    vi.spyOn(service, 'getInvitationDetails').mockResolvedValue({
      token: 'token-abc',
      organizationId: 'org-123',
      organizationName: 'Test Org',
      email: 'caregiver@example.com',
      firstName: 'Jane',
      lastName: 'Caregiver',
      roles: roles as any,
      isValid: true,
      expiresAt: new Date(Date.now() + 86400000),
    });

    (service as any).userRepo.getInviteByToken = vi.fn().mockResolvedValue({
      ...sampleInviteToken,
      roles,
    });

    (service as any).userRepo.createUser = vi.fn().mockResolvedValue({
      id: 'new-user-123',
      organizationId: 'org-123',
      email: 'caregiver@example.com',
      username: 'caregiver_user',
      roles,
      branchIds: ['branch-1'],
      status: 'ACTIVE',
    });

    (service as any).userRepo.acceptInviteToken = vi.fn().mockResolvedValue(undefined);
  };

  const acceptRequest: AcceptInviteRequest = {
    token: 'token-abc',
    firstName: 'Jane',
    lastName: 'Caregiver',
    // eslint-disable-next-line sonarjs/no-hardcoded-passwords
    password: 'Password123!Secure',
    phone: '555-0100',
  };

  it('CAREGIVER accept with exactly one matching caregiver links user_id', async () => {
    setupBaseMocks(['CAREGIVER']);

    vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM caregivers') && sql.includes('organization_id = $1')) {
        return {
          rows: [{ id: 'cg-single-match' }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        };
      }
      if (typeof sql === 'string' && sql.includes('UPDATE caregivers SET user_id = $1')) {
        return {
          rows: [],
          rowCount: 1,
          command: 'UPDATE',
          oid: 0,
          fields: [],
        };
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });

    const userId = await service.acceptInvitation(acceptRequest);

    expect(userId).toBe('new-user-123');

    // Verify caregivers table was queried with organizationId and email
    const calls = vi.mocked(mockDb.query).mock.calls;
    const selectCall = calls.find((c) => typeof c[0] === 'string' && c[0].includes('FROM caregivers'));
    expect(selectCall).toBeDefined();
    expect(selectCall?.[1]).toEqual(['org-123', 'caregiver@example.com']);

    // Verify update query linked user_id
    const updateCall = calls.find((c) => typeof c[0] === 'string' && c[0].includes('UPDATE caregivers SET user_id = $1'));
    expect(updateCall).toBeDefined();
    expect(updateCall?.[1]).toEqual(['new-user-123', 'cg-single-match']);
  });

  it('zero matches creates no row and links nothing', async () => {
    setupBaseMocks(['CAREGIVER']);

    vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM caregivers')) {
        return { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] };
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });

    const userId = await service.acceptInvitation(acceptRequest);

    expect(userId).toBe('new-user-123');

    const calls = vi.mocked(mockDb.query).mock.calls;
    const updateCall = calls.find((c) => typeof c[0] === 'string' && c[0].includes('UPDATE caregivers'));
    const insertCall = calls.find((c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO caregivers'));

    expect(updateCall).toBeUndefined();
    expect(insertCall).toBeUndefined();
  });

  it('two matches links nothing and logs a warning', async () => {
    setupBaseMocks(['CAREGIVER']);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM caregivers')) {
        return {
          rows: [{ id: 'cg-1' }, { id: 'cg-2' }],
          rowCount: 2,
          command: 'SELECT',
          oid: 0,
          fields: [],
        };
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });

    const userId = await service.acceptInvitation(acceptRequest);

    expect(userId).toBe('new-user-123');

    const calls = vi.mocked(mockDb.query).mock.calls;
    const updateCall = calls.find((c) => typeof c[0] === 'string' && c[0].includes('UPDATE caregivers'));
    expect(updateCall).toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
    const warnMessage = warnSpy.mock.calls[0]?.[0] as string;
    expect(warnMessage).toContain('Multiple unlinked caregiver rows (2)');

    warnSpy.mockRestore();
  });

  it('non-caregiver role does not touch caregivers table', async () => {
    setupBaseMocks(['COORDINATOR']);

    vi.mocked(mockDb.query).mockResolvedValue({
      rows: [],
      rowCount: 0,
      command: '',
      oid: 0,
      fields: [],
    });

    const userId = await service.acceptInvitation(acceptRequest);

    expect(userId).toBe('new-user-123');

    const calls = vi.mocked(mockDb.query).mock.calls;
    const caregiverQuery = calls.find((c) => typeof c[0] === 'string' && c[0].includes('caregivers'));
    expect(caregiverQuery).toBeUndefined();
  });
});
