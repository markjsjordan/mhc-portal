/**
 * API Provider Factory
 *
 * Creates the appropriate API provider based on configuration.
 */

import type { ApiProvider, ApiProviderConfig } from './api-provider.interface';
import { ProductionApiProvider } from './production-api-provider';
import { ShowcaseApiProvider } from './showcase-api-provider';
import { useAuthStore } from '../hooks/auth';

export function createApiProvider(config: ApiProviderConfig): ApiProvider {
  if (config.type === 'showcase') {
    return new ShowcaseApiProvider({
      autoLogin: config.showcaseOptions?.autoLogin ?? true,
      defaultRole: config.showcaseOptions?.defaultRole ?? 'coordinator',
      persistData: config.showcaseOptions?.persistData ?? true,
    });
  }

  // Production provider
  const baseUrl = (config.baseUrl ?? import.meta.env.VITE_API_BASE_URL) || '';
  const getAuthToken = () => {
    const state = useAuthStore.getState();
    return state.token;
  };

  const getUserContext = () => {
    const state = useAuthStore.getState();
    if (!state.user) return null;
    return {
      userId: state.user.id,
      organizationId: state.user.organizationId,
      roles: state.user.roles,
      permissions: state.user.permissions,
    };
  };

  const onRefresh = async (): Promise<{ token: string }> => {
    // Call refresh endpoint with credentials: include
    const response = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Refresh failed');
    }

    const data = await response.json();
    const token = data.data?.accessToken ?? data.accessToken;
    const user = data.data?.user ?? data.user;

    // Update auth store with new token
    if (user && token) {
      useAuthStore.getState().setAuth(user, token);
    } else if (token) {
      // Token only - keep existing user
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        useAuthStore.getState().setAuth(currentUser, token);
      }
    }

    return { token };
  };

  const onAuthFailure = () => {
    // Clear auth and redirect to login with expired reason
    useAuthStore.getState().clearAuth();
    if (typeof window !== 'undefined') {
      window.location.href = '/login?reason=expired';
    }
  };

  return new ProductionApiProvider(baseUrl, getAuthToken, getUserContext, {
    onRefresh,
    onAuthFailure,
  });
}

/**
 * Get API provider config from environment
 */
export function getApiProviderConfigFromEnv(): ApiProviderConfig {
  const isShowcase = import.meta.env.VITE_SHOWCASE_MODE === 'true';

  if (isShowcase) {
    return {
      type: 'showcase',
      showcaseOptions: {
        autoLogin: true,
        defaultRole: 'coordinator',
        persistData: true,
      },
    };
  }

  return {
    type: 'production',
    baseUrl: import.meta.env.VITE_API_BASE_URL || '',
  };
}
