import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useVisitApi } from './useVisits';
import type { CreateVisitPayload, CheckConflictsRequest, CreateVisitResponse, CheckConflictsResponse } from '../services/visit-api';
import toast from 'react-hot-toast';

export interface UseCreateVisitOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for creating a visit through the API
 *
 * Usage:
 * const { mutateAsync: createVisit, isPending, error } = useCreateVisit();
 *
 * const handleCreate = async (payload) => {
 *   try {
 *     const response = await createVisit(payload);
 *     console.log('Visit created:', response.data.id);
 *   } catch (err) {
 *     // Error handled by mutation
 *   }
 * };
 */
export const useCreateVisit = (options?: UseCreateVisitOptions) => {
  const queryClient = useQueryClient();
  const visitApi = useVisitApi();

  return useMutation({
    mutationFn: async (payload: CreateVisitPayload): Promise<CreateVisitResponse> => {
      return await visitApi.createVisit(payload);
    },
    onSuccess: (data: CreateVisitResponse) => {
      // Invalidate calendar visits cache to refetch
      void queryClient.invalidateQueries({ queryKey: ['visits', 'calendar'] });
      void queryClient.invalidateQueries({ queryKey: ['visits', 'caregiver-availability'] });

      toast.success(
        `Visit #${data.data.visitNumber} created successfully`,
        { duration: 4000 }
      );

      options?.onSuccess?.();
    },
    onError: (error: unknown) => {
      const apiError = error as Record<string, any> | null;
      const message =
        (apiError?.response as Record<string, any> | undefined)?.data?.message ??
        (apiError?.message as string | undefined) ??
        'Failed to create visit';

      toast.error(message, { duration: 5000 });
      options?.onError?.(error instanceof Error ? error : new Error(String(error)));
    },
  });
};

/**
 * Hook for checking caregiver conflicts for a new visit
 *
 * Usage:
 * const { mutateAsync: checkConflicts, isPending } = useCheckConflicts();
 *
 * const result = await checkConflicts({
 *   caregiverId: '...',
 *   scheduledDate: '2024-10-15',
 *   scheduledStartTime: '09:00',
 *   scheduledEndTime: '10:30',
 * });
 *
 * if (result.hasConflicts) {
 *   // Show warning to user
 * }
 */
export const useCheckConflicts = () => {
  const visitApi = useVisitApi();

  return useMutation({
    mutationFn: async (request: CheckConflictsRequest): Promise<CheckConflictsResponse> => {
      return await visitApi.checkConflictsForNewVisit(request);
    },
    onError: (error: unknown) => {
      console.error('Conflict check failed:', error);
      toast.error('Failed to check caregiver availability');
    },
  });
};
