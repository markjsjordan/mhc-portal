import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthState, User } from '../types/auth';

interface AuthStore extends AuthState {
  isInitializing: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  setInitializing: (isInitializing: boolean) => void;
}

/**
 * Safe storage wrapper for zustand persist.
 *
 * Falls back to an in-memory store when `localStorage` is unavailable or
 * throws — private browsing, storage disabled, a non-browser (SSR)
 * environment, or a transient environment teardown race in tests — so
 * auth state transitions never throw. Persistence is best-effort, not
 * required for the store to work.
 */
const memoryFallback = new Map<string, string>();

function tryLocalStorage<T>(operation: (storage: Storage) => T, fallback: () => T): T {
  try {
    if (typeof globalThis.localStorage === 'undefined') {
      return fallback();
    }
    return operation(globalThis.localStorage);
  } catch {
    return fallback();
  }
}

const safeStorage = createJSONStorage<Pick<AuthStore, 'user'>>(() => ({
  getItem: (key: string) =>
    tryLocalStorage(
      (storage) => storage.getItem(key),
      () => memoryFallback.get(key) ?? null
    ),
  setItem: (key: string, value: string) =>
    tryLocalStorage(
      (storage) => storage.setItem(key, value),
      () => {
        memoryFallback.set(key, value);
      }
    ),
  removeItem: (key: string) =>
    tryLocalStorage(
      (storage) => storage.removeItem(key),
      () => {
        memoryFallback.delete(key);
      }
    ),
}));

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isInitializing: true,
      setAuth: (user, token) =>
        set({ user, token, isAuthenticated: true, isInitializing: false }),
      clearAuth: () => {
        // HIPAA-008: Purge IndexedDB and WebCrypto encryption keys on logout
        import('../../db/index.js').then(({ resetDatabase }) => resetDatabase().catch(() => {})).catch(() => {});
        set({ user: null, token: null, isAuthenticated: false, isInitializing: false });
      },
      setInitializing: (isInitializing: boolean) => set({ isInitializing }),
    }),
    {
      name: 'auth-storage',
      storage: safeStorage,
      partialize: (state) => ({ user: state.user }), // Only persist user, keep token in memory
    }
  )
);

export const useAuth = () => {
  const { user, token, isAuthenticated, isInitializing, setAuth, clearAuth, setInitializing } = useAuthStore();

  return {
    user,
    token,
    isAuthenticated,
    isInitializing,
    login: setAuth,
    logout: clearAuth,
    setInitializing,
  };
};

/**
 * Attempt to restore an active session via the HttpOnly refresh token cookie.
 * If successful, updates useAuthStore with the refreshed user & access token.
 * If it fails (e.g. 401 or network error), marks isInitializing as false.
 */
export async function refreshAuthSession(baseUrl: string = import.meta.env.VITE_API_BASE_URL || ''): Promise<boolean> {
  const store = useAuthStore.getState();

  // If already authenticated with token, no need to refresh
  if (store.isAuthenticated && store.token) {
    store.setInitializing(false);
    return true;
  }

  try {
    const response = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      store.clearAuth();
      return false;
    }

    const data = await response.json();
    const token = data.data?.accessToken ?? data.accessToken;
    const user = data.data?.user ?? data.user ?? store.user;

    if (token && user) {
      store.setAuth(user, token);
      return true;
    }

    store.clearAuth();
    return false;
  } catch {
    store.setInitializing(false);
    return false;
  }
}

