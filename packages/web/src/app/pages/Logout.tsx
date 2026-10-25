import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, useAuthService } from '@/core/hooks';
import { wipeClientData } from '@/core/services/logout-wipe';

/**
 * Logout Page
 *
 * Performs complete logout:
 * 1. Server-side session invalidation (POST /api/auth/logout)
 *    - Bumps the user's token_version, invalidating ALL their tokens
 *    - Invalidates other active sessions/devices for this user
 * 2. Wipes client data (Cache Storage, IndexedDB, app localStorage)
 *    - Removes cached PHI and session credentials
 *    - Preserves precache (app shell) for offline PWA boot
 * 3. Clears local auth state
 * 4. Redirects to /login
 *
 * Server call is best-effort: local cleanup always happens even if
 * network call fails (offline, token expired, server error).
 */
export const Logout: React.FC = () => {
  const { logout: clearLocalAuth } = useAuth();
  const authService = useAuthService();

  React.useEffect(() => {
    const performLogout = async () => {
      try {
        // 1. Server-side logout (invalidate tokens)
        await authService.logout();
      } catch (error) {
        // Best-effort: proceed with local cleanup even if network fails
        console.error('Server-side logout failed:', error);
      }

      try {
        // 2. Wipe client data (Cache Storage, IndexedDB, localStorage)
        const wipeResult = await wipeClientData();
        console.log('[logout] Client data wiped:', wipeResult);
      } catch (error) {
        // Best-effort: continue with auth state cleanup
        console.warn('[logout] Client data wipe failed:', error);
      } finally {
        // 3. Clear local auth state (always runs)
        // Safe after unmount: zustand store update, not React state
        clearLocalAuth();
      }
    };

    void performLogout();
  }, [authService, clearLocalAuth]);

  // 4. Redirect to login
  return <Navigate to="/login" replace />;
};
