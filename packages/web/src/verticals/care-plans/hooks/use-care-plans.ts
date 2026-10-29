import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useApiClient } from '@/core/hooks';
import { createCarePlanApiService } from '../services/care-plan-api-service';
import type {
  CarePlanSearchFilters,
  TaskInstanceSearchFilters,
  CreateCarePlanInput,
  UpdateCarePlanInput,
  CompleteTaskInput,
} from '../types';
import type { SearchParams } from '@/core/types';
import type { CreateProgressNoteInput } from '../services/care-plan-api-service';

export const useCarePlanApi = () => {
  const apiClient = useApiClient();
  return useMemo(() => createCarePlanApiService(apiClient), [apiClient]);
};

export const useCarePlans = (filters?: CarePlanSearchFilters & SearchParams) => {
  const carePlanApi = useCarePlanApi();
  
  return useQuery({
    queryKey: ['care-plans', filters],
    queryFn: () => carePlanApi.getCarePlans(filters),
  });
};

export const useCarePlan = (id: string | undefined) => {
  const carePlanApi = useCarePlanApi();
  
  return useQuery({
    queryKey: ['care-plans', id],
    queryFn: () => carePlanApi.getCarePlanById(id!),
    enabled: !!id,
  });
};

export const useCreateCarePlan = () => {
  const carePlanApi = useCarePlanApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCarePlanInput) => carePlanApi.createCarePlan(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['care-plans'] });
      toast.success('Care plan created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create care plan');
    },
  });
};

export const useUpdateCarePlan = () => {
  const carePlanApi = useCarePlanApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCarePlanInput }) =>
      carePlanApi.updateCarePlan(id, input),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['care-plans'] });
      void queryClient.invalidateQueries({ queryKey: ['care-plans', data.id] });
      toast.success('Care plan updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update care plan');
    },
  });
};

export const useActivateCarePlan = () => {
  const carePlanApi = useCarePlanApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => carePlanApi.activateCarePlan(id),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['care-plans'] });
      void queryClient.invalidateQueries({ queryKey: ['care-plans', data.id] });
      toast.success('Care plan activated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to activate care plan');
    },
  });
};

export const useDeleteCarePlan = () => {
  const carePlanApi = useCarePlanApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await carePlanApi.deleteCarePlan(id);
      } catch (error: unknown) {
        // If 404, the plan was already deleted on the server — treat as success
        const err = error as { status?: number; response?: { data?: { status?: number } } };
        if (err.status === 404 || err.response?.data?.status === 404) {
          return;
        }
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['care-plans'] });
      toast.success('Care plan deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete care plan');
    },
  });
};

export const useTasks = (filters?: TaskInstanceSearchFilters & SearchParams, enablePolling = false) => {
  const carePlanApi = useCarePlanApi();

  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => carePlanApi.getTasks(filters),
    refetchInterval: enablePolling ? 30000 : false, // Poll every 30 seconds for real-time updates
  });
};

export const useTask = (id: string | undefined) => {
  const carePlanApi = useCarePlanApi();
  
  return useQuery({
    queryKey: ['tasks', id],
    queryFn: () => carePlanApi.getTaskById(id!),
    enabled: !!id,
  });
};

export const useCompleteTask = () => {
  const carePlanApi = useCarePlanApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CompleteTaskInput }) =>
      carePlanApi.completeTask(id, input),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks', data.id] });
      void queryClient.invalidateQueries({ queryKey: ['care-plans', data.carePlanId] });
      toast.success('Task completed successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to complete task');
    },
  });
};

export const useProgressNotes = (carePlanId: string | undefined) => {
  const carePlanApi = useCarePlanApi();

  return useQuery({
    queryKey: ['progress-notes', carePlanId],
    queryFn: () => carePlanApi.getProgressNotes(carePlanId!),
    enabled: !!carePlanId,
  });
};

export const useCreateProgressNote = () => {
  const carePlanApi = useCarePlanApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProgressNoteInput) => carePlanApi.createProgressNote(input),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['progress-notes', data.carePlanId] });
      void queryClient.invalidateQueries({ queryKey: ['care-plans', data.carePlanId] });
      toast.success('Progress note added successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add progress note');
    },
  });
};