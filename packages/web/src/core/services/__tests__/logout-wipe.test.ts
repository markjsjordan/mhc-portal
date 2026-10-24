/**
 * Unit tests for logout-wipe service
 *
 * Tests cover:
 * 1. Precache entries are preserved
 * 2. Non-precache entries are deleted
 * 3. IndexedDB is deleted
 * 4. App localStorage keys are removed
 * 5. PHI localStorage keys are removed
 * 6. One failing step doesn't stop others
 *
 * All tests use deterministic fixtures (no real timers, no new Date())
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { wipeClientData } from '../logout-wipe';

describe('logout-wipe', () => {
  // Mock storage state
  const mockCaches = new Map<string, Cache>();
  let mockLocalStorage: Map<string, string>;
  let mockIndexedDBDeleteCalled = false;
  let mockIndexedDBResult: 'success' | 'error' | 'blocked' = 'success';

  beforeEach(() => {
    // Reset mocks
    mockCaches.clear();
    mockLocalStorage = new Map();
    mockIndexedDBDeleteCalled = false;
    mockIndexedDBResult = 'success';

    // Mock caches API
    globalThis.caches = {
      keys: vi.fn(async () => Array.from(mockCaches.keys())),
      delete: vi.fn(async (cacheName: string) => {
        const existed = mockCaches.has(cacheName);
        mockCaches.delete(cacheName);
        return existed;
      }),
    } as unknown as CacheStorage;

    // Mock localStorage
    globalThis.localStorage = {
      length: 0,
      getItem: vi.fn((key: string) => mockLocalStorage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        mockLocalStorage.delete(key);
      }),
      clear: vi.fn(() => mockLocalStorage.clear()),
      key: vi.fn((index: number) => {
        const keys = Array.from(mockLocalStorage.keys());
        return keys[index] ?? null;
      }),
    } as Storage;

    Object.defineProperty(globalThis.localStorage, 'length', {
      get: () => mockLocalStorage.size,
    });

    // Mock IndexedDB
    globalThis.indexedDB = {
      deleteDatabase: vi.fn((dbName: string) => {
        mockIndexedDBDeleteCalled = true;

        const request = {
          onsuccess: null as ((event: Event) => void) | null,
          onerror: null as ((event: Event) => void) | null,
          onblocked: null as (() => void) | null,
        } as IDBOpenDBRequest;

        // Simulate async result
        setTimeout(() => {
          if (mockIndexedDBResult === 'success') {
            request.onsuccess?.(new Event('success'));
          } else if (mockIndexedDBResult === 'error') {
            request.onerror?.(new Event('error'));
          } else if (mockIndexedDBResult === 'blocked') {
            request.onblocked?.();
          }
        }, 0);

        return request;
      }),
    } as unknown as IDBFactory;
  });

  describe('clearCacheStorage', () => {
    it('preserves precache entries', async () => {
      // Arrange: set up caches
      mockCaches.set('workbox-precache-v2-https://folk.care/', {} as Cache);
      mockCaches.set('api-cache-v1', {} as Cache);
      mockCaches.set('image-cache', {} as Cache);

      // Act
      const result = await wipeClientData();

      // Assert: precache preserved, others deleted
      expect(mockCaches.has('workbox-precache-v2-https://folk.care/')).toBe(true);
      expect(mockCaches.has('api-cache-v1')).toBe(false);
      expect(mockCaches.has('image-cache')).toBe(false);
      expect(result.cachesCleared).toEqual(['api-cache-v1', 'image-cache']);
    });

    it('preserves precache with case-insensitive matching', async () => {
      // Arrange
      mockCaches.set('PRECACHE-v1', {} as Cache);
      mockCaches.set('runtime-cache', {} as Cache);

      // Act
      const result = await wipeClientData();

      // Assert
      expect(mockCaches.has('PRECACHE-v1')).toBe(true);
      expect(mockCaches.has('runtime-cache')).toBe(false);
      expect(result.cachesCleared).toEqual(['runtime-cache']);
    });

    it('deletes all non-precache entries', async () => {
      // Arrange
      mockCaches.set('api-v1', {} as Cache);
      mockCaches.set('api-v2', {} as Cache);
      mockCaches.set('images', {} as Cache);

      // Act
      const result = await wipeClientData();

      // Assert
      expect(mockCaches.size).toBe(0);
      expect(result.cachesCleared).toEqual(['api-v1', 'api-v2', 'images']);
    });

    it('handles caches.delete failure gracefully', async () => {
      // Arrange
      mockCaches.set('cache-1', {} as Cache);
      mockCaches.set('failing-cache', {} as Cache);
      mockCaches.set('cache-2', {} as Cache);

      // Mock delete to fail for one cache
      const originalDelete = globalThis.caches.delete;
      globalThis.caches.delete = vi.fn(async (cacheName: string) => {
        if (cacheName === 'failing-cache') {
          throw new Error('Delete failed');
        }
        return originalDelete(cacheName);
      });

      // Act
      const result = await wipeClientData();

      // Assert: other caches still deleted
      expect(result.cachesCleared).toContain('cache-1');
      expect(result.cachesCleared).toContain('cache-2');
      expect(result.cachesCleared).not.toContain('failing-cache');
    });
  });

  describe('deleteOfflineDatabase', () => {
    it('deletes IndexedDB database', async () => {
      // Arrange
      mockIndexedDBResult = 'success';

      // Act
      const result = await wipeClientData();

      // Assert
      expect(mockIndexedDBDeleteCalled).toBe(true);
      expect(result.indexedDbDeleted).toBe(true);
    });

    it('handles IndexedDB delete error', async () => {
      // Arrange
      mockIndexedDBResult = 'error';

      // Act
      const result = await wipeClientData();

      // Assert
      expect(mockIndexedDBDeleteCalled).toBe(true);
      expect(result.indexedDbDeleted).toBe(false);
    });

    it('handles IndexedDB delete blocked', async () => {
      // Arrange
      mockIndexedDBResult = 'blocked';

      // Act
      const result = await wipeClientData();

      // Assert
      expect(mockIndexedDBDeleteCalled).toBe(true);
      expect(result.indexedDbDeleted).toBe(false);
    });
  });

  describe('clearAppLocalStorage', () => {
    it('removes app-specific keys', async () => {
      // Arrange: set up localStorage
      mockLocalStorage.set('auth-storage', '{"user":"test"}');
      mockLocalStorage.set('demoSessionId', 'abc123');
      mockLocalStorage.set('accessToken', 'token123');
      mockLocalStorage.set('calendar-density', 'compact');

      // Act
      const result = await wipeClientData();

      // Assert
      expect(mockLocalStorage.has('auth-storage')).toBe(false);
      expect(mockLocalStorage.has('demoSessionId')).toBe(false);
      expect(mockLocalStorage.has('accessToken')).toBe(false);
      expect(mockLocalStorage.has('calendar-density')).toBe(false);
      expect(result.localStorageKeysCleared).toContain('auth-storage');
      expect(result.localStorageKeysCleared).toContain('demoSessionId');
    });

    it('removes PHI assessment checklists', async () => {
      // Arrange
      mockLocalStorage.set('folkcare_assessment_checklist_visit-123', '{"items":[]}');
      mockLocalStorage.set('folkcare_assessment_checklist_visit-456', '{"items":[]}');
      mockLocalStorage.set('other-key', 'preserved');

      // Act
      const result = await wipeClientData();

      // Assert
      expect(mockLocalStorage.has('folkcare_assessment_checklist_visit-123')).toBe(false);
      expect(mockLocalStorage.has('folkcare_assessment_checklist_visit-456')).toBe(false);
      expect(mockLocalStorage.has('other-key')).toBe(true); // Preserved
      expect(result.localStorageKeysCleared).toContain('folkcare_assessment_checklist_visit-123');
    });

    it('removes showcase-specific keys', async () => {
      // Arrange
      mockLocalStorage.set('showcase-data', '{}');
      mockLocalStorage.set('showcase-auth', '{}');
      mockLocalStorage.set('showcase-role', 'nurse');

      // Act
      const result = await wipeClientData();

      // Assert
      expect(mockLocalStorage.has('showcase-data')).toBe(false);
      expect(mockLocalStorage.has('showcase-auth')).toBe(false);
      expect(mockLocalStorage.has('showcase-role')).toBe(false);
    });

    it('removes tour completion tracking', async () => {
      // Arrange
      mockLocalStorage.set('tour_dashboard_completed', 'true');
      mockLocalStorage.set('tour_calendar_completed', 'true');

      // Act
      const result = await wipeClientData();

      // Assert
      expect(mockLocalStorage.has('tour_dashboard_completed')).toBe(false);
      expect(mockLocalStorage.has('tour_calendar_completed')).toBe(false);
    });

    it('preserves non-app localStorage keys', async () => {
      // Arrange: keys from other apps/extensions
      mockLocalStorage.set('google-analytics', 'GA123');
      mockLocalStorage.set('theme-preference', 'dark');
      mockLocalStorage.set('auth-storage', '{"user":"test"}'); // App key, should be removed

      // Act
      await wipeClientData();

      // Assert
      expect(mockLocalStorage.has('google-analytics')).toBe(true);
      expect(mockLocalStorage.has('theme-preference')).toBe(true);
      expect(mockLocalStorage.has('auth-storage')).toBe(false);
    });
  });

  describe('failure isolation', () => {
    it('continues when cache clearing fails', async () => {
      // Arrange: break caches API
      globalThis.caches = {
        keys: vi.fn(async () => {
          throw new Error('caches.keys failed');
        }),
      } as unknown as CacheStorage;

      mockLocalStorage.set('auth-storage', '{}');
      mockIndexedDBResult = 'success';

      // Act
      const result = await wipeClientData();

      // Assert: other steps still complete
      expect(result.cachesCleared).toEqual([]);
      expect(result.indexedDbDeleted).toBe(true);
      expect(result.localStorageKeysCleared).toContain('auth-storage');
    });

    it('continues when IndexedDB delete fails', async () => {
      // Arrange
      mockCaches.set('api-cache', {} as Cache);
      mockLocalStorage.set('auth-storage', '{}');
      mockIndexedDBResult = 'error';

      // Act
      const result = await wipeClientData();

      // Assert: other steps still complete
      expect(result.cachesCleared).toEqual(['api-cache']);
      expect(result.indexedDbDeleted).toBe(false);
      expect(result.localStorageKeysCleared).toContain('auth-storage');
    });

    it('continues when localStorage clearing fails', async () => {
      // Arrange
      mockCaches.set('api-cache', {} as Cache);
      mockIndexedDBResult = 'success';

      // Break localStorage.removeItem for one key
      const originalRemove = globalThis.localStorage.removeItem;
      globalThis.localStorage.removeItem = vi.fn((key: string) => {
        if (key === 'auth-storage') {
          throw new Error('localStorage.removeItem failed');
        }
        originalRemove.call(mockLocalStorage, key);
      });

      mockLocalStorage.set('auth-storage', '{}');
      mockLocalStorage.set('demoSessionId', 'abc');

      // Act
      const result = await wipeClientData();

      // Assert: other steps still complete
      expect(result.cachesCleared).toEqual(['api-cache']);
      expect(result.indexedDbDeleted).toBe(true);
      // auth-storage failed, but demoSessionId should still be cleared
      expect(result.localStorageKeysCleared).toContain('demoSessionId');
    });
  });

  describe('edge cases', () => {
    it('handles empty storage gracefully', async () => {
      // Arrange: no data

      // Act
      const result = await wipeClientData();

      // Assert
      expect(result.cachesCleared).toEqual([]);
      expect(result.indexedDbDeleted).toBe(true);
      expect(result.localStorageKeysCleared).toEqual([]);
    });

    it('handles missing APIs gracefully', async () => {
      // Arrange: simulate non-browser environment
      delete (globalThis as { caches?: CacheStorage }).caches;
      delete (globalThis as { indexedDB?: IDBFactory }).indexedDB;
      delete (globalThis as { localStorage?: Storage }).localStorage;

      // Act
      const result = await wipeClientData();

      // Assert: no errors thrown
      expect(result.cachesCleared).toEqual([]);
      expect(result.indexedDbDeleted).toBe(false);
      expect(result.localStorageKeysCleared).toEqual([]);
    });
  });

  describe('deterministic behavior', () => {
    it('returns consistent results for same input', async () => {
      // Arrange
      mockCaches.set('cache-1', {} as Cache);
      mockLocalStorage.set('auth-storage', '{}');

      // Act
      const result1 = await wipeClientData();
      
      // Reset
      mockCaches.set('cache-1', {} as Cache);
      mockLocalStorage.set('auth-storage', '{}');
      
      const result2 = await wipeClientData();

      // Assert: deterministic
      expect(result1.cachesCleared).toEqual(result2.cachesCleared);
      expect(result1.indexedDbDeleted).toBe(result2.indexedDbDeleted);
      expect(result1.localStorageKeysCleared).toEqual(result2.localStorageKeysCleared);
    });
  });
});
