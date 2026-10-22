import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMyCaregiverId } from '../useMyCaregiverId';

let mockAuthUser: { id: string; roles: string[] } | null = {
  id: 'user-1',
  roles: ['CAREGIVER'],
};
vi.mock('@/core/hooks', () => ({
  useAuth: () => ({ user: mockAuthUser }),
}));

const mockGetMyCaregiverProfile = vi.fn();
vi.mock('../useCaregivers.js', () => ({
  useCaregiverApi: () => ({
    getMyCaregiverProfile: mockGetMyCaregiverProfile,
  }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useMyCaregiverId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser = { id: 'user-1', roles: ['CAREGIVER'] };
  });

  it('resolves caregiverId for a caregiver-role user', async () => {
    mockGetMyCaregiverProfile.mockResolvedValue({ id: 'cg-123' });

    const { result } = renderHook(() => useMyCaregiverId(), { wrapper });

    await waitFor(() => expect(result.current.caregiverId).toBe('cg-123'));
    expect(mockGetMyCaregiverProfile).toHaveBeenCalledTimes(1);
  });

  it('does not call the API for a non-caregiver role (admin)', () => {
    mockAuthUser = { id: 'user-2', roles: ['ADMIN'] };

    const { result } = renderHook(() => useMyCaregiverId(), { wrapper });

    expect(result.current.caregiverId).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(mockGetMyCaregiverProfile).not.toHaveBeenCalled();
  });

  it('returns undefined (no error surfaced) when the user has no linked caregiver profile', async () => {
    mockGetMyCaregiverProfile.mockRejectedValue(
      Object.assign(new Error('Not found'), { status: 404 })
    );

    const { result } = renderHook(() => useMyCaregiverId(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.caregiverId).toBeUndefined();
  });

  it('treats NURSE_RN as a caregiver-like role', async () => {
    mockAuthUser = { id: 'user-3', roles: ['NURSE_RN'] };
    mockGetMyCaregiverProfile.mockResolvedValue({ id: 'cg-rn-1' });

    const { result } = renderHook(() => useMyCaregiverId(), { wrapper });

    await waitFor(() => expect(result.current.caregiverId).toBe('cg-rn-1'));
  });
});
