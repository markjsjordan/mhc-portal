import { useMemo } from 'react';
import { createApiClient } from '../services/api-client';
import { createAuthService } from '../services/auth-service';
import { createSessionHandlers } from '../services/auth-session-handlers';
import { useAuth, useAuthStore } from './auth';
import { useApiProvider } from '../providers';

/* eslint-disable react-hooks/rules-of-hooks */
export const useApiClient = () => {
  // Try to use the provider-based API client first
  try {
    const provider = useApiProvider();
    return provider.getApiClient();
  } catch (error) {
    // Fallback to legacy implementation for backward compatibility
    console.debug('ApiProvider not available, falling back to legacy client', error);
    const { user } = useAuth();
    return useMemo(() => {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      return createApiClient(
        baseUrl,
        // Read at call time, not the render-time closure: after a silent refresh the
        // retry must send the NEW token, but this client instance outlives the render
        // that created it.
        () => useAuthStore.getState().token,
        () => user ? {
          userId: user.id,
          organizationId: user.organizationId,
          roles: user.roles,
          permissions: user.permissions,
        } : null,
        // Without these the 401 branch has nothing to call: an expired 15 minute
        // access token surfaces as a raw error instead of a refresh or a redirect.
        createSessionHandlers(baseUrl)
      );
    }, [user]);
  }
};
/* eslint-enable react-hooks/rules-of-hooks */

export const useAuthService = () => {
  const apiClient = useApiClient();

  return useMemo(() => {
    return createAuthService(apiClient);
  }, [apiClient]);
};
