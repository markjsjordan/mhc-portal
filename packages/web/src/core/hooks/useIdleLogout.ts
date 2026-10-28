import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import { useAuthService } from './api';

/**
 * Idle-logout hook for authenticated (non-demo) sessions.
 *
 * Logs the user out after `timeoutMs` (default 30 minutes) of no
 * mouse/keyboard/touch/scroll/focus activity: invalidates the
 * session server-side (same best-effort pattern as the Logout page —
 * local state always clears even if the network call fails), then
 * redirects to /login.
 *
 * This is independent of `useDemoSession`'s 15-minute inactivity
 * reset, which only resets *demo* session data via `demoAPI.resetSession`
 * and never touches real auth. Mount this once in the authenticated
 * app shell (not on login/signup/demo/showcase routes) so it is only
 * active for real sessions.
 */
export const IDLE_LOGOUT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'focus'] as const;

export function useIdleLogout(timeoutMs: number = IDLE_LOGOUT_TIMEOUT_MS): void {
  const { isAuthenticated, logout: clearLocalAuth } = useAuth();
  const authService = useAuthService();
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const performIdleLogout = async () => {
      try {
        await authService.logout();
      } catch (error) {
        // Best-effort: still log the user out locally even if the
        // server call fails (offline, token already expired, etc.)
        console.error('Idle logout: server-side logout failed:', error);
      } finally {
        clearLocalAuth();
        navigate('/login', { replace: true });
      }
    };

    const resetTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        void performIdleLogout();
      }, timeoutMs);
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer);
    }

    resetTimer();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer);
      }
    };
    // authService/navigate/clearLocalAuth are stable across renders in
    // practice (memoized hook / router-provided), but included for
    // correctness; isAuthenticated/timeoutMs are the real deps that
    // should restart the timer lifecycle.
  }, [isAuthenticated, timeoutMs, authService, clearLocalAuth, navigate]);
}
