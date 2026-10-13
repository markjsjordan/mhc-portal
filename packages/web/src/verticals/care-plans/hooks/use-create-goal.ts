import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/core/services';
import { createCarePlanApiService, CreateCarePlanGoalInput, CarePlanGoalDto } from '../services/care-plan-api-service';

interface UseCreateGoalOptions {
  onSuccess?: (goal: CarePlanGoalDto) => void;
  onError?: (error: Error) => void;
}

export function useCreateGoal(carePlanId: string, options?: UseCreateGoalOptions) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const service = createCarePlanApiService(apiClient);

  return useMutation({
    mutationFn: async (input: CreateCarePlanGoalInput) => {
      return service.createGoal(carePlanId, input);
    },
    onSuccess: (goal) => {
      // Invalidate care plan query to refresh goals
      queryClient.invalidateQueries({
        queryKey: ['care-plans', carePlanId],
      });

      options?.onSuccess?.(goal);
    },
    onError: (error) => {
      options?.onError?.(error as Error);
    },
  });
}
