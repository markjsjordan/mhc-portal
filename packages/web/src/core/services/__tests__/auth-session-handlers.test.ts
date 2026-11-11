import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createSessionHandlers } from '../auth-session-handlers';
import { useAuthStore } from '../../hooks/auth';
import { useApiClient } from '../../hooks/api';
import { requestDeduplicator, requestThrottler } from '../../utils/request-utils';
import type { User } from '../../types/auth';

const BASE = 'https://api.test';

const user: User = {
  id: 'user-1',
  email: 'admin@example.test',
  name: 'Admin',
  roles: ['ORG_ADMIN'],
  permissions: ['clients:read'],
  organizationId: 'org-1',
};

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 401 ? 'Unauthorized' : 'Error',
    json: () => Promise.resolve(body),
  };
}

describe('auth session handlers', () => {
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    requestDeduplicator.clear();
    requestThrottler.clear();
    useAuthStore.getState().clearAuth();
    localStorage.removeItem('auth-storage');
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    requestDeduplicator.clear();
    requestThrottler.clear();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('onRefresh', () => {
    it('posts the refresh cookie and stores the new token and user', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(200, { data: { accessToken: 'new-token', user } })
      );

      const result = await createSessionHandlers(BASE).onRefresh();

      expect(result).toEqual({ token: 'new-token' });
      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE}/api/auth/refresh`,
        expect.objectContaining({ method: 'POST', credentials: 'include' })
      );
      expect(useAuthStore.getState().token).toBe('new-token');
      expect(useAuthStore.getState().user?.id).toBe('user-1');
    });

    it('keeps the existing user when the response carries only a token', async () => {
      useAuthStore.getState().setAuth(user, 'old-token');
      mockFetch.mockResolvedValueOnce(jsonResponse(200, { accessToken: 'new-token' }));

      await createSessionHandlers(BASE).onRefresh();

      expect(useAuthStore.getState().token).toBe('new-token');
      expect(useAuthStore.getState().user?.id).toBe('user-1');
    });

    it('rejects when the server refuses the refresh', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(401, { error: 'expired' }));

      await expect(createSessionHandlers(BASE).onRefresh()).rejects.toThrow('Refresh failed');
    });

    it('rejects when the response has no access token instead of returning undefined', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(200, { data: {} }));

      await expect(createSessionHandlers(BASE).onRefresh()).rejects.toThrow(
        'no access token'
      );
    });

    it('issues ONE refresh for concurrent callers across separate handler instances', async () => {
      let resolveFetch: (value: unknown) => void = () => undefined;
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
      );

      // Two components each build their own client, hence their own handlers.
      const first = createSessionHandlers(BASE).onRefresh();
      const second = createSessionHandlers(BASE).onRefresh();
      resolveFetch(jsonResponse(200, { data: { accessToken: 'shared-token', user } }));

      await expect(Promise.all([first, second])).resolves.toEqual([
        { token: 'shared-token' },
        { token: 'shared-token' },
      ]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('allows a new refresh after the previous one settled', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse(200, { data: { accessToken: 't1', user } }))
        .mockResolvedValueOnce(jsonResponse(200, { data: { accessToken: 't2', user } }));

      await createSessionHandlers(BASE).onRefresh();
      await createSessionHandlers(BASE).onRefresh();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(useAuthStore.getState().token).toBe('t2');
    });
  });

  describe('redirects', () => {
    const originalLocation = window.location;

    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { href: '/clients' },
      });
    });

    afterEach(() => {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    });

    it('onAuthFailure clears auth and sends the user to login as expired', () => {
      useAuthStore.getState().setAuth(user, 'tok');

      createSessionHandlers(BASE).onAuthFailure();

      expect(useAuthStore.getState().token).toBeNull();
      expect(window.location.href).toBe('/login?reason=expired');
    });

    it('onAccountInactive clears auth and sends the user to login as deactivated', () => {
      useAuthStore.getState().setAuth(user, 'tok');

      createSessionHandlers(BASE).onAccountInactive();

      expect(useAuthStore.getState().token).toBeNull();
      expect(window.location.href).toBe('/login?reason=deactivated');
    });
  });

  describe('useApiClient legacy fallback (the production app has no ApiProviderProvider)', () => {
    it('silently refreshes an expired token and retries with the NEW token', async () => {
      useAuthStore.getState().setAuth(user, 'expired-token');
      const { result } = renderHook(() => useApiClient());

      mockFetch
        .mockResolvedValueOnce(jsonResponse(401, { error: 'Access token has expired' }))
        .mockResolvedValueOnce(
          jsonResponse(200, { data: { accessToken: 'fresh-token', user } })
        )
        .mockResolvedValueOnce(jsonResponse(200, { success: true, data: { id: 'c1' } }));

      const response = await result.current.get('/api/clients/c1');

      expect(response).toEqual({ success: true, data: { id: 'c1' } });
      expect(mockFetch).toHaveBeenCalledTimes(3);

      const authHeader = (call: number): string | undefined => {
        const init = mockFetch.mock.calls[call]?.[1] as { headers?: Record<string, string> };
        return init.headers?.['Authorization'];
      };
      expect(authHeader(0)).toBe('Bearer expired-token');
      // The retry must carry the refreshed token, not the render-time closure value.
      expect(authHeader(2)).toBe('Bearer fresh-token');
    });
  });
});
