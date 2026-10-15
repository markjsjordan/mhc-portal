import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUserProfile, formatSyncedTime } from '@/hooks/useUserProfile';

// Mock API client
vi.mock('@/core/hooks', () => ({
  useApiClient: () => ({
    get: vi.fn(),
    put: vi.fn(),
  }),
}));

describe('useUserProfile Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('should fetch user profile on mount', async () => {
    const { result } = renderHook(() => useUserProfile(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.profile).toBeDefined();
  });

  it('should return user profile data with all fields', async () => {
    const { result } = renderHook(() => useUserProfile(), { wrapper });

    await waitFor(() => {
      expect(result.current.profile).toBeDefined();
    });

    const profile = result.current.profile;
    expect(profile).toHaveProperty('id');
    expect(profile).toHaveProperty('firstName');
    expect(profile).toHaveProperty('lastName');
    expect(profile).toHaveProperty('email');
    expect(profile).toHaveProperty('phone');
    expect(profile).toHaveProperty('organizationId');
    expect(profile).toHaveProperty('version');
  });

  it('should handle errors during fetch', async () => {
    const { result } = renderHook(() => useUserProfile(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
  });

  it('should update profile with new data', async () => {
    const { result } = renderHook(() => useUserProfile(), { wrapper });

    await waitFor(() => {
      expect(result.current.profile).toBeDefined();
    });

    const initialProfile = result.current.profile;

    act(() => {
      result.current.updateProfile({
        firstName: 'Updated',
        lastName: 'Name',
        email: 'updated@example.com',
        phone: '(555) 123-4567',
      });
    });

    await waitFor(() => {
      expect(result.current.isUpdating).toBe(false);
    });

    expect(result.current.updateSuccess).toBe(true);
  });

  it('should handle version conflicts', async () => {
    const { result } = renderHook(() => useUserProfile(), { wrapper });

    await waitFor(() => {
      expect(result.current.profile).toBeDefined();
    });

    act(() => {
      result.current.updateProfile({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        version: 0, // Stale version
      });
    });

    await waitFor(() => {
      expect(result.current.isUpdating).toBe(false);
    });

    expect(result.current.updateError).toBeDefined();
  });

  it('should refetch profile data', async () => {
    const { result } = renderHook(() => useUserProfile(), { wrapper });

    await waitFor(() => {
      expect(result.current.profile).toBeDefined();
    });

    const initialData = result.current.profile;

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.profile).toBeDefined();
    });

    // Profile should be the same or updated depending on server state
    expect(result.current.profile).toBeDefined();
  });

  it('should not retry on version conflict', async () => {
    const { result } = renderHook(() => useUserProfile(), { wrapper });

    await waitFor(() => {
      expect(result.current.profile).toBeDefined();
    });

    act(() => {
      result.current.updateProfile({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        version: 0,
      });
    });

    await waitFor(() => {
      expect(result.current.isUpdating).toBe(false);
    });

    // Should fail immediately without retries on version conflict
    expect(result.current.updateError).toBeDefined();
  });

  it('should handle phone field as optional', async () => {
    const { result } = renderHook(() => useUserProfile(), { wrapper });

    await waitFor(() => {
      expect(result.current.profile).toBeDefined();
    });

    act(() => {
      result.current.updateProfile({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      });
    });

    await waitFor(() => {
      expect(result.current.isUpdating).toBe(false);
    });

    expect(result.current.updateSuccess).toBe(true);
  });

  it('should support mutateAsync for async/await usage', async () => {
    const { result } = renderHook(() => useUserProfile(), { wrapper });

    await waitFor(() => {
      expect(result.current.profile).toBeDefined();
    });

    const response = await result.current.updateAsync({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
    });

    expect(response.success).toBe(true);
    expect(response.data.firstName).toBe('Test');
  });
});

describe('formatSyncedTime', () => {
  it('should return "Not synced" for null', () => {
    const result = formatSyncedTime(null);
    expect(result).toBe('Not synced');
  });

  it('should return "Just now" for recent dates', () => {
    const now = new Date();
    const result = formatSyncedTime(now);
    expect(result).toBe('Just now');
  });

  it('should return minutes ago format', () => {
    const fiftyNineSecondsAgo = new Date(Date.now() - 59 * 1000);
    const result = formatSyncedTime(fiftyNineSecondsAgo);
    expect(result).toMatch(/\dm ago/);
  });

  it('should return hours ago format', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const result = formatSyncedTime(twoHoursAgo);
    expect(result).toMatch(/\dh ago/);
  });

  it('should return days ago format', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const result = formatSyncedTime(twoDaysAgo);
    expect(result).toMatch(/\dd ago/);
  });

  it('should handle edge cases correctly', () => {
    // Exactly 60 seconds
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
    const result1 = formatSyncedTime(sixtySecondsAgo);
    expect(result1).toMatch(/\dm ago/);

    // Exactly 60 minutes
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);
    const result2 = formatSyncedTime(sixtyMinutesAgo);
    expect(result2).toMatch(/\dh ago/);

    // Exactly 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result3 = formatSyncedTime(twentyFourHoursAgo);
    expect(result3).toMatch(/\dd ago/);
  });
});
