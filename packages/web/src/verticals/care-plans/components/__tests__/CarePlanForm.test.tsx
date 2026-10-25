/**
 * Tests for CarePlanForm Dropdown Selectors
 */
import { describe, test, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQueryClient as render } from '@/test/renderWithQueryClient';
import { CarePlanForm } from '../CarePlanForm.js';

vi.mock('@/core/hooks', () => ({
  useAuth: () => ({
    user: {
      id: 'coord-user-1',
      organizationId: 'org-test-1',
      branchIds: ['branch-test-1'],
      roles: ['COORDINATOR'],
    },
    isAuthenticated: true,
  }),
  useApiClient: () => ({
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/users')) {
        return Promise.resolve([
          {
            id: 'coord-1',
            firstName: 'Sarah',
            lastName: 'Miller',
            email: 'sarah.miller@example.com',
            roles: ['COORDINATOR'],
          },
        ]);
      }
      return Promise.resolve([]);
    }),
  }),
}));

vi.mock('@/verticals/client-demographics/hooks/index.js', () => ({
  useClients: () => ({
    data: {
      items: [
        {
          id: 'client-1',
          firstName: 'Margaret',
          lastName: 'Thompson',
          clientNumber: 'MRN-1001',
        },
      ],
      total: 1,
    },
    isLoading: false,
  }),
  useBranches: () => ({
    data: [
      { id: 'branch-test-1', name: 'Main Branch', code: 'MAIN' },
      { id: 'branch-test-2', name: 'North Branch', code: 'NORTH' },
    ],
    isLoading: false,
  }),
}));

describe('CarePlanForm Dropdown Selectors', () => {
  test('renders dropdown selectors for Client, Organization, Branch, and Coordinator', async () => {
    render(<CarePlanForm onSubmit={vi.fn()} />);

    // Verify labels
    expect(screen.getByLabelText(/Client/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Organization/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Branch/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Coordinator/i)).toBeInTheDocument();

    // Verify combobox triggers
    expect(screen.getByRole('combobox', { name: /Client/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Organization/i })).toHaveTextContent(/Current Organization/i);
    expect(screen.getByRole('combobox', { name: /Branch/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Coordinator/i })).toBeInTheDocument();
  });

  test('allows selecting client and branch from dropdowns', async () => {
    const user = userEvent.setup();
    render(<CarePlanForm onSubmit={vi.fn()} />);

    const clientSelect = screen.getByLabelText(/Client/i);
    await user.click(clientSelect);
    const clientOption = await screen.findByRole('option', { name: /Margaret Thompson/i });
    await user.click(clientOption);
    expect(clientSelect).toHaveTextContent(/Margaret Thompson/i);

    const branchSelect = screen.getByLabelText(/Branch/i);
    await user.click(branchSelect);
    const branchOption = await screen.findByRole('option', { name: /North Branch/i });
    await user.click(branchOption);
    expect(branchSelect).toHaveTextContent(/North Branch/i);
  });
});
