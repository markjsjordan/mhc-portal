/**
 * FamilyMemberRepository tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FamilyMemberRepository } from '../repositories/family-engagement-repository';
import type { Database } from '@folkcare/core';

describe('FamilyMemberRepository', () => {
  let repository: FamilyMemberRepository;
  let mockDb: Database;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    } as unknown as Database;

    repository = new FamilyMemberRepository(mockDb);
  });

  describe('findByUserId', () => {
    it('should query family_members by user_id ordered by created_at DESC', async () => {
      const mockRow = {
        id: 'fm-1',
        client_id: 'client-1',
        relationship: 'DAUGHTER',
        relationship_note: 'Primary caregiver daughter',
        is_primary_contact: true,
        first_name: 'Mary',
        last_name: 'Doe',
        email: 'mary.doe@example.com',
        phone_number: '555-0199',
        preferred_contact_method: 'EMAIL',
        portal_access_level: 'FULL_ACCESS',
        access_granted_by: 'admin-1',
        access_granted_at: new Date('2024-01-01'),
        access_expires_at: null,
        status: 'ACTIVE',
        invitation_status: 'ACCEPTED',
        invitation_sent_at: new Date('2024-01-01'),
        invitation_accepted_at: new Date('2024-01-02'),
        receive_notifications: true,
        notification_preferences: {},
        last_login_at: new Date('2024-01-05'),
        password_reset_required: false,
        user_id: 'user-mary',
        portal_access_status: 'ACTIVE',
        portal_invited_at: new Date('2024-01-01'),
        portal_activated_at: new Date('2024-01-02'),
        portal_revoked_at: null,
        portal_revoked_by: null,
        portal_revoked_reason: null,
        organization_id: 'org-1',
        branch_id: 'branch-1',
        created_at: new Date('2024-01-01'),
        created_by: 'admin-1',
        updated_at: new Date('2024-01-02'),
        updated_by: 'admin-1',
        version: 2,
      };

      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [mockRow],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const members = await repository.findByUserId('user-mary');

      expect(members).toHaveLength(1);
      expect(members[0]?.id).toBe('fm-1');
      expect(members[0]?.userId).toBe('user-mary');
      expect(members[0]?.portalAccessStatus).toBe('ACTIVE');
      expect(members[0]?.portalActivatedAt).toEqual(new Date('2024-01-02'));

      const sql = vi.mocked(mockDb.query).mock.calls[0]?.[0] as string;
      const params = vi.mocked(mockDb.query).mock.calls[0]?.[1];
      expect(sql).toContain('user_id = $1');
      expect(sql).toContain('ORDER BY created_at DESC');
      expect(params).toEqual(['user-mary']);
    });

    it('should return empty array when no family member records match user_id', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      const members = await repository.findByUserId('user-nonexistent');
      expect(members).toEqual([]);
    });
  });
});
