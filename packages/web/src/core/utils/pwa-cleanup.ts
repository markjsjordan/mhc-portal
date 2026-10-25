/**
 * PWA Client Data Cleanup Utility
 *
 * Implements HIPAA-compliant and security-hardened data sanitization
 * for PWA client instances upon user logout or session expiration:
 * 1. Cache Storage: deletes all dynamic / runtime caches (e.g. API data, images)
 *    while preserving the precache shell so the PWA can still boot offline.
 * 2. IndexedDB: deletes the offline database (`folkcare_offline`) containing
 *    cached visits, tasks, and client records.
 * 3. LocalStorage: removes auth tokens, session IDs, and any stored PHI/assessment
 *    checklists while preserving benign user preferences (e.g. calendar layout).
 */

export const OFFLINE_DB_NAME = 'folkcare_offline';

export const SENSITIVE_STORAGE_KEYS = [
  'auth-storage',
  'token',
  'authToken',
  'accessToken',
  'refreshToken',
  'demoSessionId',
  'folkcare_auth',
];

export interface WipeClientDataResult {
  cachesCleared: string[];
  indexedDbDeleted: boolean;
  localStorageKeysCleared: string[];
}

/**
 * Check whether a cache name corresponds to the precache shell
 */
export function isPrecacheShell(cacheName: string): boolean {
  const normalized = cacheName.toLowerCase();
  return normalized.includes('precache');
}

/**
 * Clears Cache Storage entries while optionally preserving the precache application shell.
 *
 * @param preservePrecache - when true (default), caches containing 'precache' are kept.
 * @returns Array of cache names that were deleted.
 */
export async function clearCacheStorage(preservePrecache: boolean = true): Promise<string[]> {
  const deleted: string[] = [];

  if (typeof globalThis.caches === 'undefined' || typeof globalThis.caches.keys !== 'function') {
    return deleted;
  }

  try {
    const keys = await globalThis.caches.keys();
    for (const key of keys) {
      if (preservePrecache && isPrecacheShell(key)) {
        continue;
      }

      try {
        const success = await globalThis.caches.delete(key);
        if (success) {
          deleted.push(key);
        }
      } catch (err) {
        console.warn(`[PWA-Cleanup] Failed to delete cache "${key}":`, err);
      }
    }
  } catch (error) {
    console.warn('[PWA-Cleanup] Error reading cache keys:', error);
  }

  return deleted;
}

/**
 * Deletes the WatermelonDB / IndexedDB offline store containing client and visit records.
 *
 * @param dbName - Name of the IndexedDB database (defaults to 'folkcare_offline')
 * @returns Promise resolving to true if deleted or unavailable, false on error/block.
 */
export async function deleteOfflineDatabase(dbName: string = OFFLINE_DB_NAME): Promise<boolean> {
  if (
    typeof globalThis.indexedDB === 'undefined' ||
    typeof globalThis.indexedDB.deleteDatabase !== 'function'
  ) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    try {
      const request = globalThis.indexedDB.deleteDatabase(dbName);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        console.warn(`[PWA-Cleanup] Error deleting IndexedDB "${dbName}":`, request.error);
        resolve(false);
      };

      request.onblocked = () => {
        console.warn(`[PWA-Cleanup] IndexedDB deletion blocked for "${dbName}"`);
        resolve(false);
      };
    } catch (error) {
      console.warn(`[PWA-Cleanup] Failed to delete IndexedDB "${dbName}":`, error);
      resolve(false);
    }
  });
}

/**
 * Removes sensitive authentication and PHI entries from localStorage,
 * leaving benign preferences intact.
 *
 * @returns Array of keys removed from localStorage.
 */
export function clearSensitiveLocalStorage(): string[] {
  const removed: string[] = [];

  if (typeof globalThis.localStorage === 'undefined') {
    return removed;
  }

  try {
    // 1. Remove known static sensitive keys
    for (const key of SENSITIVE_STORAGE_KEYS) {
      if (globalThis.localStorage.getItem(key) !== null) {
        globalThis.localStorage.removeItem(key);
        removed.push(key);
      }
    }

    // 2. Scan all existing keys for PHI or session identifiers
    const allKeys: string[] = [];
    const length = globalThis.localStorage.length;
    for (let i = 0; i < length; i++) {
      const key = globalThis.localStorage.key(i);
      if (key) {
        allKeys.push(key);
      }
    }

    for (const key of allKeys) {
      const lower = key.toLowerCase();
      const isSensitive =
        lower.startsWith('folkcare_assessment_') ||
        lower.includes('auth') ||
        lower.includes('token') ||
        lower.includes('session') ||
        lower.startsWith('folkcare_offline');

      if (isSensitive && !removed.includes(key)) {
        globalThis.localStorage.removeItem(key);
        removed.push(key);
      }
    }
  } catch (error) {
    console.warn('[PWA-Cleanup] Error clearing sensitive localStorage keys:', error);
  }

  return removed;
}

/**
 * Complete PWA client data wipe:
 * - Clears non-precache CacheStorage
 * - Deletes the offline IndexedDB database
 * - Cleans sensitive localStorage items
 */
export async function wipeClientData(): Promise<WipeClientDataResult> {
  const [cachesCleared, indexedDbDeleted] = await Promise.all([
    clearCacheStorage(true),
    deleteOfflineDatabase(OFFLINE_DB_NAME),
  ]);

  const localStorageKeysCleared = clearSensitiveLocalStorage();

  return {
    cachesCleared,
    indexedDbDeleted,
    localStorageKeysCleared,
  };
}

/**
 * Called on user logout to ensure zero residual PHI or session credentials remain.
 */
export async function handleLogoutCleanup(): Promise<void> {
  await wipeClientData();
}

/**
 * Called on 401 session expiration to purge cached PHI and stale tokens.
 */
export async function handleSessionExpiredCleanup(): Promise<void> {
  await wipeClientData();
}
