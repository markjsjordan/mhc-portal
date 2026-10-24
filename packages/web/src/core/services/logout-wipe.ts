/**
 * Logout Client Data Wipe Service
 *
 * Wipes sensitive client data on logout to ensure zero residual PHI
 * or session credentials remain in the browser:
 * 1. Cache Storage: deletes all caches EXCEPT precache (app shell)
 * 2. IndexedDB: deletes the offline database containing cached PHI
 * 3. LocalStorage: removes app-specific keys (auth, session, cached PHI)
 *
 * Each step is defensive: failures are logged but don't block other steps.
 * This ensures maximum data cleanup even in degraded browser environments.
 */

/**
 * IndexedDB database name for offline cached PHI.
 * This name is referenced in multiple places; verify with:
 *   grep -r "folkcare_offline" packages/web/src
 */
const OFFLINE_DB_NAME = 'folkcare_offline';

/**
 * App localStorage keys to remove on logout.
 * Enumerated by scanning the codebase:
 *   grep -r "localStorage.setItem" packages/web/src
 */
const APP_LOCALSTORAGE_KEYS = [
  'auth-storage',           // zustand auth store
  'demoSessionId',          // demo session tracking
  'accessToken',            // legacy tokens (from invite acceptance)
  'refreshToken',           // legacy tokens
  'calendar-density',       // user preference (non-PHI, but user-specific)
  'calendar-time-range',    // user preference
] as const;

/**
 * Dynamic localStorage key patterns for PHI.
 * These are prefixes/patterns that contain user/session-specific data.
 */
const PHI_KEY_PATTERNS = [
  'folkcare_assessment_checklist_',  // assessment checklists by visitId
  'tour_',                           // tour completion tracking (user-specific)
] as const;

/**
 * Showcase-specific localStorage keys (only in showcase mode).
 */
const SHOWCASE_KEYS = [
  'showcase-data',          // ShowcaseAPIProvider data
  'showcase-auth',          // ShowcaseAPIProvider auth
  'showcase-role',          // Current role in showcase
  'onboarding-welcome-seen', // Onboarding state
] as const;

/**
 * Check if a cache name is the precache shell.
 * Precache contains the app bundle and static assets needed for offline boot.
 * We preserve it so the PWA can still load after logout.
 */
function isPrecacheShell(cacheName: string): boolean {
  const normalized = cacheName.toLowerCase();
  return normalized.includes('precache') || normalized.includes('workbox-precache');
}

/**
 * Clear Cache Storage, preserving precache entries.
 * Defensive: logs failures but continues processing remaining caches.
 *
 * @returns Array of cache names successfully deleted
 */
async function clearCacheStorage(): Promise<string[]> {
  const deleted: string[] = [];

  if (typeof globalThis.caches === 'undefined') {
    return deleted; // Not in a service worker context or browser doesn't support CacheStorage
  }

  try {
    const cacheNames = await globalThis.caches.keys();

    for (const cacheName of cacheNames) {
      if (isPrecacheShell(cacheName)) {
        continue; // Preserve precache
      }

      try {
        const success = await globalThis.caches.delete(cacheName);
        if (success) {
          deleted.push(cacheName);
        }
      } catch (err) {
        console.warn(`[logout-wipe] Failed to delete cache "${cacheName}":`, err);
      }
    }
  } catch (err) {
    console.warn('[logout-wipe] Failed to enumerate caches:', err);
  }

  return deleted;
}

/**
 * Delete the IndexedDB offline database.
 * Defensive: returns false on error but doesn't throw.
 *
 * @returns Promise<boolean> - true if deleted, false on error/block
 */
async function deleteOfflineDatabase(): Promise<boolean> {
  if (typeof globalThis.indexedDB === 'undefined') {
    return false; // Not in a browser or IndexedDB not supported
  }

  return new Promise<boolean>((resolve) => {
    try {
      const request = globalThis.indexedDB.deleteDatabase(OFFLINE_DB_NAME);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = (event) => {
        console.warn(`[logout-wipe] IndexedDB delete error:`, event);
        resolve(false);
      };

      request.onblocked = () => {
        console.warn(`[logout-wipe] IndexedDB delete blocked (open connections)`);
        resolve(false);
      };
    } catch (err) {
      console.warn(`[logout-wipe] Failed to delete IndexedDB:`, err);
      resolve(false);
    }
  });
}

/**
 * Remove app localStorage keys.
 * Defensive: logs failures but continues processing remaining keys.
 *
 * Removes:
 * 1. Static app keys (auth, tokens, preferences)
 * 2. Dynamic PHI keys (assessment checklists)
 * 3. Showcase keys (if in showcase mode)
 *
 * Preserves: Generic browser state not tied to this app
 *
 * @returns Array of keys successfully removed
 */
function clearAppLocalStorage(): string[] {
  const removed: string[] = [];

  if (typeof globalThis.localStorage === 'undefined') {
    return removed; // Not in a browser
  }

  try {
    // Remove static app keys
    for (const key of APP_LOCALSTORAGE_KEYS) {
      try {
        if (globalThis.localStorage.getItem(key) !== null) {
          globalThis.localStorage.removeItem(key);
          removed.push(key);
        }
      } catch (err) {
        console.warn(`[logout-wipe] Failed to remove localStorage key "${key}":`, err);
      }
    }

    // Remove showcase keys
    for (const key of SHOWCASE_KEYS) {
      try {
        if (globalThis.localStorage.getItem(key) !== null) {
          globalThis.localStorage.removeItem(key);
          removed.push(key);
        }
      } catch (err) {
        console.warn(`[logout-wipe] Failed to remove showcase key "${key}":`, err);
      }
    }

    // Remove dynamic PHI keys
    const allKeys: string[] = [];
    for (let i = 0; i < globalThis.localStorage.length; i++) {
      const key = globalThis.localStorage.key(i);
      if (key) allKeys.push(key);
    }

    for (const key of allKeys) {
      const matchesPattern = PHI_KEY_PATTERNS.some((pattern) => key.startsWith(pattern));
      if (matchesPattern) {
        try {
          globalThis.localStorage.removeItem(key);
          removed.push(key);
        } catch (err) {
          console.warn(`[logout-wipe] Failed to remove PHI key "${key}":`, err);
        }
      }
    }
  } catch (err) {
    console.warn('[logout-wipe] Failed to enumerate localStorage:', err);
  }

  return removed;
}

/**
 * Wipe client data on logout.
 *
 * Clears:
 * - Cache Storage (except precache)
 * - IndexedDB folkcare_offline
 * - App localStorage keys
 *
 * Defensive: each step is wrapped so one failure doesn't block others.
 *
 * @returns Promise with result summary
 */
export async function wipeClientData(): Promise<{
  cachesCleared: string[];
  indexedDbDeleted: boolean;
  localStorageKeysCleared: string[];
}> {
  // Run cache and IndexedDB cleanup in parallel
  const [cachesCleared, indexedDbDeleted] = await Promise.all([
    clearCacheStorage(),
    deleteOfflineDatabase(),
  ]);

  // Clear localStorage (synchronous, fast)
  const localStorageKeysCleared = clearAppLocalStorage();

  return {
    cachesCleared,
    indexedDbDeleted,
    localStorageKeysCleared,
  };
}
