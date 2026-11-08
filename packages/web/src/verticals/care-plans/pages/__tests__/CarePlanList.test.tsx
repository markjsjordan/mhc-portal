import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CarePlanList } from '../CarePlanList.js';
import type { CarePlan, CarePlanSearchFilters } from '../../types';

let mockHookReturn: {
  data: {
    items: CarePlan[];
    total: number;
    hasMore: boolean;
  } | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
};

let capturedFilters: CarePlanSearchFilters | undefined;

vi.mock('../../hooks', () => ({
  useCarePlans: (filters?: CarePlanSearchFilters) => {
    capturedFilters = filters;
    return mockHookReturn;
  },
}));

vi.mock('@/core/hooks', () => ({
  usePermissions: () => ({
    can: () => true,
  }),
  useSectionAccess: () => ({
    canRead: true,
    canWrite: true,
    readOnly: false,
  }),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

describe('CarePlanList - Search and Refetch Behavior (wdvf3acgzm)', () => {
  const initialCarePlans: CarePlan[] = [
    {
      id: 'plan-1',
      planNumber: 'CP-001',
      name: 'Physical Therapy Plan',
      clientId: 'client-1',
      organizationId: 'org-1',
      planType: 'THERAPY',
      status: 'ACTIVE',
      priority: 'HIGH',
      effectiveDate: '2026-01-01',
      goals: [],
      interventions: [],
      taskTemplates: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    capturedFilters = undefined;
    mockHookReturn = {
      data: {
        items: initialCarePlans,
        total: 1,
        hasMore: false,
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn().mockResolvedValue({}),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps search input mounted with focus and value when advancing debounce and refetching', () => {
    const { rerender } = render(<CarePlanList />);

    const searchInput = screen.getByPlaceholderText(
      'Search by plan name or client name...'
    ) as HTMLInputElement;

    expect(searchInput).toBeInTheDocument();
    searchInput.focus();
    expect(document.activeElement).toBe(searchInput);

    // Type into the search input
    fireEvent.change(searchInput, { target: { value: 'Physical' } });
    expect(searchInput.value).toBe('Physical');

    // Advance past the 300ms debounce
    act(() => {
      vi.advanceTimersByTime(350);
    });

    // Check that filters updated with debounced query
    expect(capturedFilters?.query).toBe('Physical');

    // Simulate query transition while keepPreviousData is active:
    // data is retained, isFetching becomes true
    mockHookReturn = {
      ...mockHookReturn,
      isFetching: true,
    };
    rerender(<CarePlanList />);

    // Search input must still be mounted, focused, and retain value
    expect(searchInput).toBeInTheDocument();
    expect(searchInput.value).toBe('Physical');
    expect(document.activeElement).toBe(searchInput);

    // Full-page loading spinner must NOT unmount the content / search bar
    expect(
      screen.getByPlaceholderText('Search by plan name or client name...')
    ).toBe(searchInput);
  });
});
