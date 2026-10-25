import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isPrecacheShell,
  clearCacheStorage,
  deleteOfflineDatabase,
  clearSensitiveLocalStorage,
  wipeClientData,
  handleLogoutCleanup,
  handleSessionExpiredCleanup,
  OFFLINE_DB_NAME,
  SENSITIVE_STORAGE_KEYS,
} from '../pwa-cleanup';

describe('PWA Data Cleanup Utility', () => {
  const originalCaches = globalThis.caches;
  const originalIndexedDB = globalThis.indexedDB;
  const originalLocalStorage = globalThis.localStorage;

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore globals
    Object.defineProperty(globalThis, 'caches', { value: originalCaches, writable: true });
    Object.defineProperty(globalThis, 'indexedDB', { value: originalIndexedDB, writable: true });
    Object.defineProperty(globalThis, 'localStorage', { value: originalLocalStorage, writable: true });
  });

  describe('isPrecacheShell', () => {
    it('should identify precache cache names', () => {
      expect(isPrecacheShell('workbox-precache-v2-https://folk.care/')).toBe(true);
      expect(isPrecacheShell('precache-v1')).toBe(true);
      expect(isPrecacheShell('APP-PRECACHE-SHELL')).toBe(true);
    });

    it('should return false for dynamic or runtime caches', () => {
      expect(isPrecacheShell('api-cache')).toBe(false);
      expect(isPrecacheShell('image-cache')).toBe(false);
      expect(isPrecacheShell('user-data')).toBe(false);
      expect(isPrecacheShell('workbox-runtime')).toBe(false);
    });
  });

  describe('clearCacheStorage', () => {
    it('should delete runtime caches and preserve precache shell when preservePrecache is true', async () => {
      const mockDelete = vi.fn().mockResolvedValue(true);
      const mockKeys = vi.fn().mockResolvedValue([
        'workbox-precache-v2-https://portal.example.com',
        'api-cache',
        'image-cache',
      ]);

      Object.defineProperty(globalThis, 'caches', {
        value: {
          keys: mockKeys,
          delete: mockDelete,
        },
        writable: true,
      });

      const deleted = await clearCacheStorage(true);

      expect(mockKeys).toHaveBeenCalled();
      expect(mockDelete).toHaveBeenCalledWith('api-cache');
      expect(mockDelete).toHaveBeenCalledWith('image-cache');
      expect(mockDelete).not.toHaveBeenCalledWith('workbox-precache-v2-https://portal.example.com');
      expect(deleted).toEqual(['api-cache', 'image-cache']);
    });

    it('should delete all caches including precache shell when preservePrecache is false', async () => {
      const mockDelete = vi.fn().mockResolvedValue(true);
      const mockKeys = vi.fn().mockResolvedValue([
        'workbox-precache-v2',
        'api-cache',
      ]);

      Object.defineProperty(globalThis, 'caches', {
        value: {
          keys: mockKeys,
          delete: mockDelete,
        },
        writable: true,
      });

      const deleted = await clearCacheStorage(false);

      expect(mockDelete).toHaveBeenCalledWith('workbox-precache-v2');
      expect(mockDelete).toHaveBeenCalledWith('api-cache');
      expect(deleted).toEqual(['workbox-precache-v2', 'api-cache']);
    });

    it('should handle undefined caches gracefully', async () => {
      Object.defineProperty(globalThis, 'caches', {
        value: undefined,
        writable: true,
      });

      const deleted = await clearCacheStorage();
      expect(deleted).toEqual([]);
    });

    it('should catch and handle errors from caches.keys() gracefully', async () => {
      Object.defineProperty(globalThis, 'caches', {
        value: {
          keys: vi.fn().mockRejectedValue(new Error('Cache error')),
          delete: vi.fn(),
        },
        writable: true,
      });

      const deleted = await clearCacheStorage();
      expect(deleted).toEqual([]);
    });
  });

  describe('deleteOfflineDatabase', () => {
    it('should delete IndexedDB using default dbName folkcare_offline', async () => {
      const mockDeleteDatabase = vi.fn().mockImplementation(() => {
        const req: any = {};
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess({} as any);
        }, 0);
        return req;
      });

      Object.defineProperty(globalThis, 'indexedDB', {
        value: {
          deleteDatabase: mockDeleteDatabase,
        },
        writable: true,
      });

      const result = await deleteOfflineDatabase();

      expect(mockDeleteDatabase).toHaveBeenCalledWith(OFFLINE_DB_NAME);
      expect(result).toBe(true);
    });

    it('should resolve false when IndexedDB deletion fails or is blocked', async () => {
      const mockDeleteDatabase = vi.fn().mockImplementation(() => {
        const req: any = { error: new Error('DB locked') };
        setTimeout(() => {
          if (req.onerror) req.onerror({} as any);
        }, 0);
        return req;
      });

      Object.defineProperty(globalThis, 'indexedDB', {
        value: {
          deleteDatabase: mockDeleteDatabase,
        },
        writable: true,
      });

      const result = await deleteOfflineDatabase('test_db');
      expect(result).toBe(false);
    });

    it('should handle undefined indexedDB gracefully', async () => {
      Object.defineProperty(globalThis, 'indexedDB', {
        value: undefined,
        writable: true,
      });

      const result = await deleteOfflineDatabase();
      expect(result).toBe(false);
    });
  });

  describe('clearSensitiveLocalStorage', () => {
    let mockStore: Record<string, string>;

    beforeEach(() => {
      mockStore = {
        'auth-storage': JSON.stringify({ state: { user: { id: '1' }, token: 'xyz' } }),
        'token': 'bearer-abc',
        'authToken': 'tok-123',
        'accessToken': 'access-456',
        'refreshToken': 'refresh-789',
        'demoSessionId': 'demo-999',
        'folkcare_assessment_checklist_client_42': JSON.stringify({ completed: true }),
        'calendar-density': 'compact',
        'calendar-time-range': 'day',
        'tour_dashboard_completed': 'true',
      };

      const mockLocalStorage = {
        getItem: vi.fn((key: string) => mockStore[key] ?? null),
        setItem: vi.fn((key: string, val: string) => {
          mockStore[key] = val;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStore[key];
        }),
        key: vi.fn((index: number) => Object.keys(mockStore)[index] ?? null),
        get length() {
          return Object.keys(mockStore).length;
        },
      };

      Object.defineProperty(globalThis, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });
    });

    it('should clear all known sensitive keys and PHI assessment items', () => {
      const removed = clearSensitiveLocalStorage();

      for (const sensitiveKey of SENSITIVE_STORAGE_KEYS) {
        expect(mockStore[sensitiveKey]).toBeUndefined();
      }
      expect(mockStore['folkcare_assessment_checklist_client_42']).toBeUndefined();
      expect(removed).toContain('auth-storage');
      expect(removed).toContain('token');
      expect(removed).toContain('folkcare_assessment_checklist_client_42');
    });

    it('should preserve non-sensitive preference keys', () => {
      clearSensitiveLocalStorage();

      expect(mockStore['calendar-density']).toBe('compact');
      expect(mockStore['calendar-time-range']).toBe('day');
      expect(mockStore['tour_dashboard_completed']).toBe('true');
    });

    it('should handle undefined localStorage gracefully', () => {
      Object.defineProperty(globalThis, 'localStorage', {
        value: undefined,
        writable: true,
      });

      const removed = clearSensitiveLocalStorage();
      expect(removed).toEqual([]);
    });
  });

  describe('wipeClientData and lifecycle handlers', () => {
    it('should coordinate cache clearing, DB deletion, and storage wipe', async () => {
      Object.defineProperty(globalThis, 'caches', {
        value: {
          keys: vi.fn().mockResolvedValue(['api-cache', 'workbox-precache-shell']),
          delete: vi.fn().mockResolvedValue(true),
        },
        writable: true,
      });

      Object.defineProperty(globalThis, 'indexedDB', {
        value: {
          deleteDatabase: vi.fn().mockImplementation(() => {
            const req: any = {};
            setTimeout(() => {
              if (req.onsuccess) req.onsuccess({} as any);
            }, 0);
            return req;
          }),
        },
        writable: true,
      });

      const mockStore: Record<string, string> = {
        'token': 'secret-token',
        'theme': 'light',
      };
      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: vi.fn((k: string) => mockStore[k] ?? null),
          removeItem: vi.fn((k: string) => { delete mockStore[k]; }),
          key: vi.fn((i: number) => Object.keys(mockStore)[i] ?? null),
          get length() { return Object.keys(mockStore).length; },
        },
        writable: true,
      });

      const result = await wipeClientData();

      expect(result.cachesCleared).toEqual(['api-cache']);
      expect(result.indexedDbDeleted).toBe(true);
      expect(result.localStorageKeysCleared).toContain('token');
      expect(mockStore['token']).toBeUndefined();
      expect(mockStore['theme']).toBe('light');
    });

    it('handleLogoutCleanup and handleSessionExpiredCleanup execute without throwing', async () => {
      await expect(handleLogoutCleanup()).resolves.toBeUndefined();
      await expect(handleSessionExpiredCleanup()).resolves.toBeUndefined();
    });
  });
});
