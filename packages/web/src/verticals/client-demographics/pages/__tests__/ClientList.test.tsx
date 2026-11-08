import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithQueryClient } from '@/test/renderWithQueryClient.js';
import { ClientList } from '../ClientList.js';
import * as clientHooks from '../../hooks/useClients.js';

vi.mock('@/core/hooks', () => ({
  usePermissions: () => ({ can: () => true }),
  useSectionAccess: () => ({
    canRead: true,
    canWrite: true,
    readOnly: false,
  }),
  useDemoData: () => ({
    hasDemoData: true,
    isSeeding: false,
    seedDemoData: vi.fn(),
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

describe('ClientList page search retention', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps the search input mounted with its value and focus while refetching', () => {
    const mockData = {
      items: [
        {
          id: 'client-1',
          clientNumber: 'C-001',
          firstName: 'Alice',
          lastName: 'Smith',
          status: 'ACTIVE',
          dateOfBirth: '1985-05-15',
          primaryAddress: {
            city: 'Austin',
            state: 'TX',
          },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    };

    let currentFilters: { query?: string } | undefined;
    vi.spyOn(clientHooks, 'useClients').mockImplementation((filters) => {
      currentFilters = filters;
      const isRefetching = Boolean(filters?.query);
      return {
        data: mockData,
        // When refetching with query, isLoading is false because placeholderData preserves previous data,
        // and isFetching is true while the request is in flight.
        isLoading: false,
        isFetching: isRefetching,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof clientHooks.useClients>;
    });

    const { rerender } = renderWithQueryClient(<ClientList />);

    const searchInput = screen.getByPlaceholderText('Search by name or client number...');
    searchInput.focus();
    expect(document.activeElement).toBe(searchInput);

    // Type in search query
    fireEvent.change(searchInput, { target: { value: 'Alice' } });
    expect(searchInput).toHaveValue('Alice');

    // Advance timers past 300ms debounce
    act(() => {
      vi.advanceTimersByTime(350);
    });

    // Re-render component to simulate query state change (isFetching: true)
    rerender(<ClientList />);

    // Prove: search input element remains mounted in DOM with value and focus preserved
    const searchInputAfter = screen.getByPlaceholderText('Search by name or client number...');
    expect(searchInputAfter).toBe(searchInput);
    expect(searchInputAfter).toHaveValue('Alice');
    expect(document.activeElement).toBe(searchInputAfter);
    expect(currentFilters?.query).toBe('Alice');
  });
});
