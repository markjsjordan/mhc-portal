/**
 * Caregiver Weekly Availability API client and React Query hooks
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/core/hooks/index.js';
import type { ApiClient } from '@/core/services/index.js';
import type { WeeklyAvailability } from '../types/index.js';

export interface BookedVisitConflict {
  visitId: string;
  date: string;
  start: string;
  end: string;
}

export interface ResolvedCaregiverAvailability {
  schedule: WeeklyAvailability;
  editable: boolean;
  cutoffAt: string;
  conflicts: BookedVisitConflict[];
  version: number;
  source: 'OVERRIDE' | 'TEMPLATE';
}

export interface SaveCaregiverAvailabilityInput {
  weekStart: string;
  schedule: WeeklyAvailability;
  expectedVersion: number;
}

export interface SaveCaregiverAvailabilityResult {
  success: boolean;
  version: number;
  schedule: WeeklyAvailability;
}

export interface CaregiverAvailabilityApiService {
  getMyAvailability(weekStart: string): Promise<ResolvedCaregiverAvailability>;
  saveMyAvailability(input: SaveCaregiverAvailabilityInput): Promise<SaveCaregiverAvailabilityResult>;
}

export const createCaregiverAvailabilityApiService = (
  apiClient: ApiClient
): CaregiverAvailabilityApiService => {
  return {
    async getMyAvailability(weekStart: string): Promise<ResolvedCaregiverAvailability> {
      const params = new URLSearchParams();
      params.append('weekStart', weekStart);
      return apiClient.get<ResolvedCaregiverAvailability>(`/api/caregivers/me/availability?${params}`);
    },

    async saveMyAvailability(
      input: SaveCaregiverAvailabilityInput
    ): Promise<SaveCaregiverAvailabilityResult> {
      return apiClient.put<SaveCaregiverAvailabilityResult>(
        '/api/caregivers/me/availability',
        input
      );
    },
  };
};

export const useCaregiverAvailabilityApi = (): CaregiverAvailabilityApiService => {
  const apiClient = useApiClient();
  return useMemo(() => createCaregiverAvailabilityApiService(apiClient), [apiClient]);
};

export function useMyAvailability(weekStart: string) {
  const availabilityApi = useCaregiverAvailabilityApi();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['caregiver-availability-me', weekStart],
    queryFn: () => availabilityApi.getMyAvailability(weekStart),
    enabled: !!weekStart,
    staleTime: 30000,
  });

  const saveMutation = useMutation({
    mutationFn: (input: SaveCaregiverAvailabilityInput) =>
      availabilityApi.saveMyAvailability(input),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ['caregiver-availability-me', weekStart],
        (old: ResolvedCaregiverAvailability | undefined) => {
          if (!old) return old;
          return {
            ...old,
            version: data.version,
            schedule: data.schedule,
            source: 'OVERRIDE' as const,
          };
        }
      );
      void queryClient.invalidateQueries({
        queryKey: ['caregiver-availability-me', weekStart],
      });
    },
  });

  return {
    ...query,
    saveAvailability: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    saveError: saveMutation.error,
  };
}
