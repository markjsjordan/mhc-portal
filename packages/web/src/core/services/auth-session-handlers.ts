/**
 * Session handlers for the API client: silent token refresh and redirect-to-login.
 *
 * The access token is memory-only with a 15 minute TTL, so any session longer than
 * that depends on these callbacks. They are shared by every place that builds an
 * API client (the production provider and the legacy useApiClient fallback) so the
 * refresh and redirect behaviour cannot drift between them. They read the auth
 * store directly (not React state) so they stay valid across client re-creation.
 */

import type { ApiClientOptions } from './api-client';
import { useAuthStore } from '../hooks/auth';

// Single-flight across ALL clients. The legacy useApiClient() builds one client per
// calling component, and ApiClient only de-duplicates refreshes per instance, so
// concurrent 401s from different components would each POST /api/auth/refresh. The
// refresh token is single-use (rotated), so a second parallel refresh can fail and
// sign the user out.
let inFlightRefresh: Promise<{ token: string }> | null = null;

export function createSessionHandlers(baseUrl: string): Required<
  Pick<ApiClientOptions, 'onRefresh' | 'onAuthFailure' | 'onAccountInactive'>
> {
  const refreshOnce = async (): Promise<{ token: string }> => {
    // Refresh token travels as an HttpOnly cookie, hence credentials: include
    const response = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Refresh failed');
    }

    const data = await response.json();
    const token: string | undefined = data.data?.accessToken ?? data.accessToken;
    const user = data.data?.user ?? data.user;

    if (token === undefined || token === '') {
      throw new Error('Refresh failed: no access token in response');
    }

    const store = useAuthStore.getState();
    if (user) {
      store.setAuth(user, token);
    } else if (store.user) {
      // Token only - keep the existing user
      store.setAuth(store.user, token);
    }

    return { token };
  };

  const onRefresh = (): Promise<{ token: string }> => {
    inFlightRefresh ??= refreshOnce().finally(() => {
      inFlightRefresh = null;
    });
    return inFlightRefresh;
  };

  const redirectToLogin = (reason: 'expired' | 'deactivated') => {
    useAuthStore.getState().clearAuth();
    if (typeof window !== 'undefined') {
      window.location.href = `/login?reason=${reason}`;
    }
  };

  return {
    onRefresh,
    onAuthFailure: () => redirectToLogin('expired'),
    onAccountInactive: () => redirectToLogin('deactivated'),
  };
}
