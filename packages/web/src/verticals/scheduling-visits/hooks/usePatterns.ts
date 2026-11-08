import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useVisitApi } from './useVisits.js';
import type { ListPatternsParams, EndPatternResult } from '../services/visit-api.js';

export const PATTERNS_QUERY_KEY = ['visit-patterns'] as const;

export function usePatterns(filters: ListPatternsParams = {}) {
  const visitApi = useVisitApi();

  return useQuery({
    queryKey: [...PATTERNS_QUERY_KEY, filters],
    queryFn: async () => {
      return visitApi.listPatternsWithPagination(filters);
    },
    staleTime: 30000,
  });
}

export function usePatternMutations() {
  const visitApi = useVisitApi();
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: PATTERNS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ['visits'] });
  };

  const pauseMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      return visitApi.pausePattern(id, reason);
    },
    onSuccess: () => {
      toast.success('Pattern paused successfully');
      invalidate();
    },
    onError: (error: unknown) => {
      const apiErr = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
      const msg = apiErr.response?.data?.error ?? apiErr.response?.data?.message ?? apiErr.message ?? 'Failed to pause pattern';
      toast.error(msg);
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      return visitApi.resumePattern(id);
    },
    onSuccess: () => {
      toast.success('Pattern resumed successfully');
      invalidate();
    },
    onError: (error: unknown) => {
      const apiErr = error as { response?: { data?: { code?: string; error?: string; message?: string; details?: unknown } }; message?: string };
      const resp = apiErr.response?.data;
      if (resp?.code === 'AUTHORIZATION_LIMIT_EXCEEDED') {
        const details = resp.details ? ` (${JSON.stringify(resp.details)})` : '';
        toast.error(`Authorization limit exceeded: ${resp.error ?? 'Limit exceeded'}${details}`);
      } else {
        const msg = resp?.error ?? resp?.message ?? apiErr.message ?? 'Failed to resume pattern';
        toast.error(msg);
      }
    },
  });

  const endMutation = useMutation({
    mutationFn: async ({ id, reason, effectiveDate }: { id: string; reason: string; effectiveDate?: string }) => {
      return visitApi.endPattern(id, { reason, effectiveDate });
    },
    onSuccess: (data: EndPatternResult) => {
      toast.success(`Pattern ended. ${data.retainedFutureVisits} scheduled visit(s) retained.`);
      invalidate();
    },
    onError: (error: unknown) => {
      const apiErr = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
      const msg = apiErr.response?.data?.error ?? apiErr.response?.data?.message ?? apiErr.message ?? 'Failed to end pattern';
      toast.error(msg);
    },
  });

  return {
    pausePattern: pauseMutation.mutateAsync,
    resumePattern: resumeMutation.mutateAsync,
    endPattern: endMutation.mutateAsync,
    isPausing: pauseMutation.isPending,
    isResuming: resumeMutation.isPending,
    isEnding: endMutation.isPending,
  };
}
