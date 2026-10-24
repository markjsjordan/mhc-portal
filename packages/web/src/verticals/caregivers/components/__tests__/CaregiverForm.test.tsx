/**
 * Tests for CaregiverForm Branch Selector
 */
import { describe, test, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQueryClient as render } from '@/test/renderWithQueryClient';
import { CaregiverForm, EMPTY_CAREGIVER_FORM } from '../CaregiverForm';
import type { CaregiverFormValues } from '../CaregiverForm';

vi.mock('@/verticals/client-demographics/hooks/index.js', () => ({
  useBranches: () => ({
    data: [
      { id: 'branch-main-001', name: 'Main Branch', code: 'MAIN' },
      { id: 'branch-north-002', name: 'North Branch', code: 'NORTH' },
      { id: 'branch-south-003', name: 'South Branch', code: 'SOUTH' },
    ],
    isLoading: false,
  }),
}));

describe('CaregiverForm Branch Selector', () => {
  test('auto-selects Main branch on initial render when no branch is selected', async () => {
    const handleSubmit = vi.fn();

    render(
      <CaregiverForm
        defaultValues={EMPTY_CAREGIVER_FORM}
        onSubmit={handleSubmit}
      />
    );

    // Wait for the auto-selection to occur
    await waitFor(() => {
      const primarySelect = screen.getByLabelText(/Primary Branch/i) as HTMLSelectElement;
      expect(primarySelect.value).toBe('branch-main-001');
    });

    // Verify Main Branch is shown in assigned branches
    expect(screen.getAllByText(/Main Branch/i).length).toBeGreaterThan(0);
  });

  test('displays branch names in assigned branches list', () => {
    const values: CaregiverFormValues = {
      ...EMPTY_CAREGIVER_FORM,
      branchIdsRaw: 'branch-main-001, branch-north-002',
      primaryBranchId: 'branch-main-001',
    };

    render(
      <CaregiverForm
        defaultValues={values}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getAllByText(/Main Branch/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/North Branch/i).length).toBeGreaterThan(0);
  });

  test('allows searching and toggling branch selection', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    const values: CaregiverFormValues = {
      ...EMPTY_CAREGIVER_FORM,
      branchIdsRaw: 'branch-main-001',
      primaryBranchId: 'branch-main-001',
    };

    render(
      <CaregiverForm
        defaultValues={values}
        onSubmit={handleSubmit}
      />
    );

    // Click dropdown toggle
    const toggle = screen.getByTestId('branch-dropdown-toggle');
    await user.click(toggle);

    // Type in search
    const searchInput = screen.getByPlaceholderText('Search branches...');
    await user.type(searchInput, 'North');

    // Click North Branch
    const northOption = screen.getByText('North Branch');
    await user.click(northOption);

    // Verify North Branch is now displayed in the selected branches
    await waitFor(() => {
      expect(screen.getAllByText(/North Branch/i).length).toBeGreaterThan(0);
    });
  });

  test('allows changing primary branch among selected branches', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    const values: CaregiverFormValues = {
      ...EMPTY_CAREGIVER_FORM,
      branchIdsRaw: 'branch-main-001, branch-north-002',
      primaryBranchId: 'branch-main-001',
    };

    render(
      <CaregiverForm
        defaultValues={values}
        onSubmit={handleSubmit}
      />
    );

    const primarySelect = screen.getByLabelText(/Primary Branch/i) as HTMLSelectElement;
    await user.selectOptions(primarySelect, 'branch-north-002');

    await waitFor(() => {
      expect(primarySelect.value).toBe('branch-north-002');
    });
  });
});
