/**
 * Hook for managing admin impersonation sessions
 */

import { useAuth } from './auth';
import { useApiClient } from './api';
import { useCallback } from 'react';

export interface ImpersonationSession {
  adminUserId: string;
  adminEmail: string;
  sessionId: string;
  startedAt: string;
}

export const useImpersonation = () => {
  const { user, login } = useAuth();
  const apiClient = useApiClient();

  // For now, we'll track impersonation status by checking if the user's email
  // is different from what we'd expect. In a full implementation, we'd parse the JWT.
  const isImpersonating = false; // Placeholder - would need JWT parsing to implement properly

  // Get impersonation details
  const impersonation: ImpersonationSession | null = null;

  // End impersonation session
  const endImpersonation = useCallback(async () => {
    if (!isImpersonating) {
      return Promise.resolve();
    }

    try {
      await apiClient.post('/api/auth/impersonate/end', {});
      // Clear the auth state to force re-login
      // In a real app, we'd want to restore the admin's session
      localStorage.removeItem('auth-storage');
      window.location.reload();
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to end impersonation:', error);
      throw error;
    }
  }, [isImpersonating, apiClient]);

  // Start impersonation session (called from LoginAsModal)
  const startImpersonation = useCallback(
    async (caregiverId: string) => {
      try {
        const response = await apiClient.post<{
          success: boolean;
          data: {
            accessToken: string;
            expiresIn: number;
            caregiver: { id: string; email: string; name: string };
          };
        }>('/api/auth/impersonate/start', {
          caregiverId,
        });

        if (response?.data?.accessToken && response.data.caregiver) {
          // Update auth with the new token
          login(
            {
              id: response.data.caregiver.id,
              email: response.data.caregiver.email,
              name: response.data.caregiver.name,
              organizationId: user?.organizationId || '',
              roles: ['CAREGIVER'],
              permissions: [],
            },
            response.data.accessToken
          );
          return response.data;
        }
        return undefined;
      } catch (error) {
        console.error('Failed to start impersonation:', error);
        throw error;
      }
    },
    [apiClient, user, login]
  );

  return {
    isImpersonating,
    impersonation,
    startImpersonation,
    endImpersonation,
  };
};
