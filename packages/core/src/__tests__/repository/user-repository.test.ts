/**
 * UserRepository tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserRepository } from '../../repository/user-repository';
import { Database } from '../../db/connection';

describe('UserRepository', () => {
  let repository: UserRepository;
  let mockDb: Database;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    } as unknown as Database;
    repository = new UserRepository(mockDb);
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        organization_id: 'org-123',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        username: 'johndoe',
        roles: ['CAREGIVER'],
        branch_ids: ['branch-1'],
        status: 'ACTIVE',
      };

      vi.spyOn(mockDb, 'query').mockResolvedValue({
        rows: [mockUser],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await repository.getUserById('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toEqual({
        id: '123e4567-e89b-12d3-a456-426614174000',
        organizationId: 'org-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        username: 'johndoe',
        roles: ['CAREGIVER'],
        branchIds: ['branch-1'],
        status: 'ACTIVE',
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id'),
        ['123e4567-e89b-12d3-a456-426614174000']
      );
    });

    it('should return null when user not found', async () => {
      vi.spyOn(mockDb, 'query').mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await repository.getUserById('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should filter out soft-deleted users', async () => {
      vi.spyOn(mockDb, 'query').mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      await repository.getUserById('deleted-user-id');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at IS NULL'),
        ['deleted-user-id']
      );
    });
  });

  describe('getUsersByIds', () => {
    it('should return empty array when no IDs provided', async () => {
      const result = await repository.getUsersByIds([]);

      expect(result).toEqual([]);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should return multiple users', async () => {
      const mockUsers = [
        {
          id: 'id-1',
          organization_id: 'org-123',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          username: 'johndoe',
          roles: ['CAREGIVER'],
          branch_ids: ['branch-1'],
          status: 'ACTIVE',
        },
        {
          id: 'id-2',
          organization_id: 'org-123',
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@example.com',
          username: 'janesmith',
          roles: ['ADMIN'],
          branch_ids: ['branch-2'],
          status: 'ACTIVE',
        },
      ];

      vi.spyOn(mockDb, 'query').mockResolvedValue({
        rows: mockUsers,
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await repository.getUsersByIds(['id-1', 'id-2']);

      expect(result).toEqual([
        {
          id: 'id-1',
          organizationId: 'org-123',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          username: 'johndoe',
          roles: ['CAREGIVER'],
          branchIds: ['branch-1'],
          status: 'ACTIVE',
        },
        {
          id: 'id-2',
          organizationId: 'org-123',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          username: 'janesmith',
          roles: ['ADMIN'],
          branchIds: ['branch-2'],
          status: 'ACTIVE',
        },
      ]);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('id = ANY($1)'),
        [['id-1', 'id-2']]
      );
    });

    it('should order results by last name and first name', async () => {
      vi.spyOn(mockDb, 'query').mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      await repository.getUsersByIds(['id-1', 'id-2']);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY last_name, first_name'),
        [['id-1', 'id-2']]
      );
    });

    it('should filter out soft-deleted users', async () => {
      vi.spyOn(mockDb, 'query').mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      await repository.getUsersByIds(['id-1']);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at IS NULL'),
        [['id-1']]
      );
    });
  });

  describe('createInviteToken', () => {
    it('should insert invite token with targetType and targetId when provided', async () => {
      const mockInviteRow = {
        id: 'token-id-1',
        token: 'mock-secure-token',
        organization_id: 'org-123',
        email: 'caregiver@example.com',
        first_name: 'Alex',
        last_name: 'Rivera',
        roles: [],
        branch_ids: [],
        expires_at: new Date('2026-11-14T00:00:00Z'),
        status: 'PENDING',
        accepted_user_id: null,
        accepted_at: null,
        target_type: 'CAREGIVER',
        target_id: 'cg-uuid-123',
        created_at: new Date('2026-11-07T00:00:00Z'),
        created_by: 'admin-123',
        updated_at: new Date('2026-11-07T00:00:00Z'),
        updated_by: 'admin-123',
      };

      vi.spyOn(mockDb, 'query').mockResolvedValueOnce({
        rows: [mockInviteRow],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      });

      const invite = await repository.createInviteToken(
        'org-123',
        {
          email: 'caregiver@example.com',
          firstName: 'Alex',
          lastName: 'Rivera',
          roles: [],
          targetType: 'CAREGIVER',
          targetId: 'cg-uuid-123',
        },
        'admin-123'
      );

      expect(invite.targetType).toBe('CAREGIVER');
      expect(invite.targetId).toBe('cg-uuid-123');
      expect(invite.status).toBe('PENDING');

      const sql = vi.mocked(mockDb.query).mock.calls[0]?.[0] as string;
      const params = vi.mocked(mockDb.query).mock.calls[0]?.[1];
      expect(sql).toContain('target_type, target_id');
      expect(params).toContain('CAREGIVER');
      expect(params).toContain('cg-uuid-123');
    });

    it('should default targetType and targetId to null when omitted', async () => {
      const mockInviteRow = {
        id: 'token-id-2',
        token: 'mock-secure-token-2',
        organization_id: 'org-123',
        email: 'staff@example.com',
        first_name: null,
        last_name: null,
        roles: ['ORG_ADMIN'],
        branch_ids: [],
        expires_at: new Date('2026-11-14T00:00:00Z'),
        status: 'PENDING',
        accepted_user_id: null,
        accepted_at: null,
        target_type: null,
        target_id: null,
        created_at: new Date('2026-11-07T00:00:00Z'),
        created_by: 'admin-123',
        updated_at: new Date('2026-11-07T00:00:00Z'),
        updated_by: 'admin-123',
      };

      vi.spyOn(mockDb, 'query').mockResolvedValueOnce({
        rows: [mockInviteRow],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      });

      const invite = await repository.createInviteToken(
        'org-123',
        {
          email: 'staff@example.com',
          roles: ['ORG_ADMIN'],
        },
        'admin-123'
      );

      expect(invite.targetType).toBeUndefined();
      expect(invite.targetId).toBeUndefined();

      const params = vi.mocked(mockDb.query).mock.calls[0]?.[1];
      expect(params?.[9]).toBeNull();
      expect(params?.[10]).toBeNull();
    });
  });
});
