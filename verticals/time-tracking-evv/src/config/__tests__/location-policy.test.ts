import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveLocationPolicy, loadOrgLocationPolicy } from '../location-policy.js';
import { initCacheService, getCacheService } from '@folkcare/core/service/cache.service';
import { CacheKeys } from '@folkcare/core';

describe('location-policy', () => {
  describe('resolveLocationPolicy', () => {
    it('returns false when orgSettings is undefined or null', () => {
      expect(resolveLocationPolicy(undefined)).toEqual({ locationRequired: false });
      expect(resolveLocationPolicy(null)).toEqual({ locationRequired: false });
    });

    it('returns false when evv key is missing or locationRequired is omitted', () => {
      expect(resolveLocationPolicy({})).toEqual({ locationRequired: false });
      expect(resolveLocationPolicy({ evv: {} })).toEqual({ locationRequired: false });
    });

    it('returns false when locationRequired is false', () => {
      expect(resolveLocationPolicy({ evv: { locationRequired: false } })).toEqual({ locationRequired: false });
    });

    it('returns true when locationRequired is true', () => {
      expect(resolveLocationPolicy({ evv: { locationRequired: true } })).toEqual({ locationRequired: true });
    });
  });

  describe('loadOrgLocationPolicy', () => {
    let mockDb: any;
    let cache: any;

    beforeEach(async () => {
      await initCacheService();
      cache = getCacheService();
      await cache.del(CacheKeys.evvLocationPolicy('org-123'));
      await cache.del(CacheKeys.evvLocationPolicy('org-456'));

      mockDb = {
        query: vi.fn(),
      };
    });

    it('loads policy from database and caches result', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ settings: { evv: { locationRequired: true } } }],
      });

      const policy1 = await loadOrgLocationPolicy(mockDb, 'org-123');
      expect(policy1).toEqual({ locationRequired: true });
      expect(mockDb.query).toHaveBeenCalledTimes(1);

      // Second call should hit cache and not call db.query again
      const policy2 = await loadOrgLocationPolicy(mockDb, 'org-123');
      expect(policy2).toEqual({ locationRequired: true });
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('resolves false when organization has no settings or no row', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [],
      });

      const policy = await loadOrgLocationPolicy(mockDb, 'org-456');
      expect(policy).toEqual({ locationRequired: false });
    });

    it('invalidating cache causes reload on next call', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ settings: { evv: { locationRequired: false } } }],
        })
        .mockResolvedValueOnce({
          rows: [{ settings: { evv: { locationRequired: true } } }],
        });

      const p1 = await loadOrgLocationPolicy(mockDb, 'org-123');
      expect(p1.locationRequired).toBe(false);

      await cache.del(CacheKeys.evvLocationPolicy('org-123'));

      const p2 = await loadOrgLocationPolicy(mockDb, 'org-123');
      expect(p2.locationRequired).toBe(true);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });
});
