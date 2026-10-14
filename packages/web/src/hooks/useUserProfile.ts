import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/core/hooks';

/**
 * User profile data returned from API
 */
export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  organizationId: string;
  roles: string[];
  version: number;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Profile update request
 */
export interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  version?: number;
}

/**
 * Profile update response
 */
export interface UpdateProfileResponse {
  success: boolean;
  data: Omit<UserProfile, 'roles'>;
  timestamp: string;
}

/**
 * Version conflict error response
 */
export interface VersionConflictError {
  success: false;
  error: string;
  code: 'VERSION_CONFLICT';
  current: Omit<UserProfile, 'roles'> | null;
}

/**
 * Custom hook for fetching and updating user profile
 */
export function useUserProfile() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  /**
   * Fetch current user profile
   */
  const fetchProfile = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const response = await apiClient.get<{
        success: boolean;
        data: UserProfile;
      }>('/api/users/profile');
      return response.data;
    },
    staleTime: 0, // Always refetch on mount
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  /**
   * Mutation for updating profile
   */
  const updateProfile = useMutation({
    mutationFn: async (data: UpdateProfileRequest) => {
      const response = await apiClient.put<UpdateProfileResponse>(
        '/api/users/profile',
        data
      );
      return response;
    },
    onSuccess: (response) => {
      // Update cache with new profile data
      queryClient.setQueryData(['userProfile'], response.data);
      // Update synced timestamp
      queryClient.setQueryData(['profileSyncedAt'], new Date());
    },
    retry: (failureCount, error: any) => {
      // Don't retry version conflicts
      if (error?.response?.data?.code === 'VERSION_CONFLICT') {
        return false;
      }
      return failureCount < 3;
    },
  });

  return {
    // Fetch state
    profile: fetchProfile.data,
    isLoading: fetchProfile.isLoading,
    isError: fetchProfile.isError,
    error: fetchProfile.error,
    refetch: fetchProfile.refetch,

    // Update state
    updateProfile: updateProfile.mutate,
    updateAsync: updateProfile.mutateAsync,
    isUpdating: updateProfile.isPending,
    updateError: updateProfile.error,
    updateSuccess: updateProfile.isSuccess,
  };
}

/**
 * Hook to get the last synced timestamp
 */
export function useProfileSyncedAt() {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<Date>(['profileSyncedAt']) || null;
}

/**
 * Format time elapsed since sync
 */
export function formatSyncedTime(syncedAt: Date | null): string {
  if (!syncedAt) return 'Not synced';

  const now = new Date();
  const diffMs = now.getTime() - syncedAt.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffSeconds < 60) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return `${Math.floor(diffHours / 24)}d ago`;
  }
}
