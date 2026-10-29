/**
 * Tests for CaregiverForm Branch Selector
 */
import { describe, test, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQueryClient as render } from '@/test/renderWithQueryClient';
import { CaregiverForm } from '../CaregiverForm';
import { EMPTY_CAREGIVER_FORM, type CaregiverFormValues } from '../../types/form.js';

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
    const handleChange = vi.fn();

    render(
      <CaregiverForm
        values={EMPTY_CAREGIVER_FORM}
        onChange={handleChange}
      />
    );

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        branchIdsRaw: 'branch-main-001',
        primaryBranchId: 'branch-main-001',
      })
    );
  });

  test('displays branch names in assigned branches list', () => {
    const values: CaregiverFormValues = {
      ...EMPTY_CAREGIVER_FORM,
      branchIdsRaw: 'branch-main-001, branch-north-002',
      primaryBranchId: 'branch-main-001',
    };

    render(
      <CaregiverForm
        values={values}
        onChange={vi.fn()}
      />
    );

    expect(screen.getAllByText(/Main Branch/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/North Branch/i).length).toBeGreaterThan(0);
  });

  test('allows searching and toggling branch selection', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const values: CaregiverFormValues = {
      ...EMPTY_CAREGIVER_FORM,
      branchIdsRaw: 'branch-main-001',
      primaryBranchId: 'branch-main-001',
    };

    render(
      <CaregiverForm
        values={values}
        onChange={handleChange}
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

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        branchIdsRaw: 'branch-main-001, branch-north-002',
        primaryBranchId: 'branch-main-001',
      })
    );
  });

  test('allows changing primary branch among selected branches', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const values: CaregiverFormValues = {
      ...EMPTY_CAREGIVER_FORM,
      branchIdsRaw: 'branch-main-001, branch-north-002',
      primaryBranchId: 'branch-main-001',
    };

    render(
      <CaregiverForm
        values={values}
        onChange={handleChange}
      />
    );

    const primarySelect = screen.getByLabelText(/Primary Branch/i);
    fireEvent.keyDown(primarySelect, { key: 'ArrowDown' });
    const option = await screen.findByRole('option', { name: /North Branch/i });
    fireEvent.click(option);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        primaryBranchId: 'branch-north-002',
      })
    );
  });
});
