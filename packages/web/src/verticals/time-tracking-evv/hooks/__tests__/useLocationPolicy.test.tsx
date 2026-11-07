import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocationPolicy } from '../useLocationPolicy.js';

const mockGetLocationPolicy = vi.fn();

vi.mock('../useEVVRecords.js', () => ({
  useEVVApi: () => ({
    getLocationPolicy: mockGetLocationPolicy,
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useLocationPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns server policy when GET /api/evv/location-policy succeeds with locationRequired: false', async () => {
    mockGetLocationPolicy.mockResolvedValueOnce({ locationRequired: false });

    const { result } = renderHook(() => useLocationPolicy(), {
      wrapper: createWrapper(),
    });

    // While loading, fail safe: locationRequired is true
    expect(result.current.locationRequired).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.locationRequired).toBe(false);
    expect(result.current.data).toEqual({ locationRequired: false });
  });

  it('returns server policy when GET /api/evv/location-policy succeeds with locationRequired: true', async () => {
    mockGetLocationPolicy.mockResolvedValueOnce({ locationRequired: true });

    const { result } = renderHook(() => useLocationPolicy(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.locationRequired).toBe(true);
    expect(result.current.data).toEqual({ locationRequired: true });
  });

  it('falls back to locationRequired: true on server error (fail-safe)', async () => {
    mockGetLocationPolicy.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useLocationPolicy(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.locationRequired).toBe(true);
    expect(result.current.data).toEqual({ locationRequired: true });
  });
});
