import React from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Render a component inside a fresh QueryClientProvider.
 *
 * Components that call `useMutation`/`useQuery` (e.g. caregiver modals) throw
 * "No QueryClient set" when rendered bare. Retries are disabled so failure
 * paths resolve deterministically in tests.
 */
export function renderWithQueryClient(
  ui: React.ReactElement,
  options?: RenderOptions
): RenderResult & { queryClient: QueryClient } {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { ...render(ui, { wrapper, ...options }), queryClient };
}
