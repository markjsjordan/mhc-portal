import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, useAuthService } from '@/core/hooks';

/**
 * Logout Page
 *
 * Invalidates the current session server-side (POST /api/auth/logout —
 * bumps the user's token_version, which also invalidates that user's
 * OTHER active sessions/devices, since all their tokens share one
 * version), then clears local auth state and redirects to /login.
 *
 * Previously this only cleared local state via useAuth().logout()
 * (zustand clearAuth) and never called the server, so a stolen/leaked
 * token stayed valid after the user "logged out" until its natural
 * expiry (access token 15m, refresh token 7d). The server call is
 * best-effort: local state is always cleared so the UI never gets
 * stuck on a failed network call.
 */
export const Logout: React.FC = () => {
  const { logout: clearLocalAuth } = useAuth();
  const authService = useAuthService();

  React.useEffect(() => {
    const performLogout = async () => {
      try {
        await authService.logout();
      } catch (error) {
        // Best-effort: proceed with local cleanup even if the network
        // call fails (offline, token already expired, server error).
        console.error('Server-side logout failed:', error);
      } finally {
        // Safe to call after unmount: this is a zustand store update,
        // not React state, so there is no "set state on unmounted
        // component" warning risk.
        clearLocalAuth();
      }
    };

    void performLogout();
  }, [authService, clearLocalAuth]);

  // Redirect to login
  return <Navigate to="/login" replace />;
};
