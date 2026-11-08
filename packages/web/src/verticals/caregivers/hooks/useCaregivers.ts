/**
 * React hook for fetching caregivers
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiClient } from '@/core/hooks';
import { createCaregiverApiService } from '../services/index.js';
import type { CaregiverSearchFilters } from '../types/index.js';

export const useCaregiverApi = () => {
  const apiClient = useApiClient();
  return useMemo(() => createCaregiverApiService(apiClient), [apiClient]);
};

export function useCaregivers(
  filters: CaregiverSearchFilters = {},
  page: number = 1,
  limit: number = 20
) {
  const caregiverApi = useCaregiverApi();

  return useQuery({
    queryKey: ['caregivers', filters, page, limit],
    queryFn: () => caregiverApi.searchCaregivers(filters, page, limit),
    staleTime: 30000, // 30 seconds
  });
}

export function useCaregiver(id: string | undefined) {
  const caregiverApi = useCaregiverApi();

  return useQuery({
    queryKey: ['caregiver', id],
    queryFn: () => caregiverApi.getCaregiverById(id!),
    enabled: !!id,
    staleTime: 60000, // 1 minute
  });
}

export function useCaregiverPortalAccess(id: string | undefined) {
  const caregiverApi = useCaregiverApi();

  return useQuery({
    queryKey: ['caregiver-portal-access', id],
    queryFn: () => caregiverApi.getPortalAccess(id!),
    enabled: !!id,
  });
}

export function useInviteCaregiverPortal(caregiverId: string | undefined) {
  const caregiverApi = useCaregiverApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => caregiverApi.invitePortal(caregiverId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['caregiver-portal-access', caregiverId] });
      toast.success('Invitation sent successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send invitation');
    },
  });
}

export function useRevokeCaregiverPortal(caregiverId: string | undefined) {
  const caregiverApi = useCaregiverApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reason: string) => caregiverApi.revokePortal(caregiverId!, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['caregiver-portal-access', caregiverId] });
      toast.success('Portal access revoked');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to revoke portal access');
    },
  });
}
