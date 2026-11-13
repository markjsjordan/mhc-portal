import { describe, it, expect, vi } from 'vitest';
import { Database } from '../../db/connection.js';
import {
  resolvePortalLinks,
  deriveRoles,
  ResolvedPortalLinks,
} from '../portal-link-resolver.js';

describe('portal-link-resolver', () => {
  describe('deriveRoles', () => {
    it('handles no links with staff roles', () => {
      const links: ResolvedPortalLinks = {
        familyMemberIds: [],
        familyClientIds: [],
      };
      const roles = ['ORG_ADMIN', 'COORDINATOR'];
      expect(deriveRoles(roles, links)).toEqual(['ORG_ADMIN', 'COORDINATOR']);
    });

    it('handles a caregiver only', () => {
      const links: ResolvedPortalLinks = {
        caregiverId: 'cg-123',
        familyMemberIds: [],
        familyClientIds: [],
      };
      expect(deriveRoles([], links)).toEqual(['CAREGIVER']);
    });

    it('handles a staff member who is also a caregiver (COORDINATOR + CAREGIVER)', () => {
      const links: ResolvedPortalLinks = {
        caregiverId: 'cg-123',
        familyMemberIds: [],
        familyClientIds: [],
      };
      const roles = ['COORDINATOR'];
      expect(deriveRoles(roles, links)).toEqual(['COORDINATOR', 'CAREGIVER']);
    });

    it('handles a family member for 2 clients', () => {
      const links: ResolvedPortalLinks = {
        familyMemberIds: ['fm-1', 'fm-2'],
        familyClientIds: ['client-1', 'client-2'],
      };
      expect(deriveRoles([], links)).toEqual(['FAMILY']);
    });

    it('drops stale CAREGIVER and FAMILY from users.roles when no ACTIVE link exists', () => {
      const links: ResolvedPortalLinks = {
        familyMemberIds: [],
        familyClientIds: [],
      };
      const roles = ['COORDINATOR', 'CAREGIVER', 'FAMILY'];
      expect(deriveRoles(roles, links)).toEqual(['COORDINATOR']);
    });
  });

  describe('resolvePortalLinks', () => {
    it('queries database for caregiver and family members correctly', async () => {
      const mockDb = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('FROM caregivers')) {
            return { rows: [{ id: 'cg-456' }] };
          }
          if (sql.includes('FROM family_members')) {
            return {
              rows: [
                { id: 'fm-1', client_id: 'client-1' },
                { id: 'fm-2', client_id: 'client-2' },
              ],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Database;

      const links = await resolvePortalLinks(mockDb, 'user-789');

      expect(links).toEqual({
        caregiverId: 'cg-456',
        familyMemberIds: ['fm-1', 'fm-2'],
        familyClientIds: ['client-1', 'client-2'],
      });
      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });

    it('returns empty lists when no records match', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      } as unknown as Database;

      const links = await resolvePortalLinks(mockDb, 'user-none');

      expect(links).toEqual({
        familyMemberIds: [],
        familyClientIds: [],
      });
      expect(links.caregiverId).toBeUndefined();
    });
  });
});
