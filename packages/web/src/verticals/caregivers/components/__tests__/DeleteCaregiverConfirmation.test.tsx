/**
 * Tests for Delete Caregiver Confirmation Dialog
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithQueryClient as render } from '@/test/renderWithQueryClient';
import userEvent from '@testing-library/user-event';
import { DeleteCaregiverConfirmation } from '../DeleteCaregiverConfirmation';
import { caregiverApi } from '../../api/index';
import { toast } from 'sonner';
import type { Caregiver } from '../../types/index';

// Mock API
vi.mock('../../api/index', () => ({
  caregiverApi: {
    deleteCaregiver: vi.fn(),
  },
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockCaregiver: Caregiver = {
  id: '123',
  firstName: 'Sarah',
  lastName: 'Martinez',
  email: 'sarah@example.com',
  status: 'ACTIVE',
  role: 'CAREGIVER',
  employeeNumber: 'EMP-001',
  version: 1,
  primaryBranchId: 'branch-1',
  branchIds: ['branch-1'],
  hireDate: '2024-01-15T00:00:00.000Z',
  dateOfBirth: '1990-05-20T00:00:00.000Z',
  employmentType: 'FULL_TIME',
  primaryAddress: { line1: '123 Main St', city: 'San Francisco', state: 'CA', postalCode: '94102' },
  emergencyContacts: [],
  credentials: [],
  training: [],
  payRate: { amount: 25, unit: 'HOURLY', effectiveDate: '2024-01-15T00:00:00.000Z' },
  complianceStatus: 'COMPLIANT',
};

describe('DeleteCaregiverConfirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders confirmation dialog when open', () => {
    render(
      <DeleteCaregiverConfirmation
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /delete caregiver/i })).toBeInTheDocument();
    expect(screen.getByText('Sarah Martinez')).toBeInTheDocument();
  });

  test('does not render when isOpen is false', () => {
    const { container } = render(
      <DeleteCaregiverConfirmation
        isOpen={false}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  test('requires name confirmation', async () => {
    const user = userEvent.setup();
    render(
      <DeleteCaregiverConfirmation
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    // Delete button should be disabled initially
    expect(screen.getByRole('button', { name: /delete caregiver/i })).toBeDisabled();

    // Enter wrong name
    const nameInput = screen.getByPlaceholderText('Sarah Martinez');
    await user.type(nameInput, 'John Doe');

    // Delete button still disabled
    expect(screen.getByRole('button', { name: /delete caregiver/i })).toBeDisabled();

    // Clear and enter correct name
    await user.clear(nameInput);
    await user.type(nameInput, 'Sarah Martinez');

    // Delete button still disabled without checkbox
    expect(screen.getByRole('button', { name: /delete caregiver/i })).toBeDisabled();
  });

  test('requires checkbox confirmation', async () => {
    const user = userEvent.setup();
    render(
      <DeleteCaregiverConfirmation
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    // Enter correct name
    const nameInput = screen.getByPlaceholderText('Sarah Martinez');
    await user.type(nameInput, 'Sarah Martinez');

    // Delete button still disabled without checkbox
    expect(screen.getByRole('button', { name: /delete caregiver/i })).toBeDisabled();

    // Check the checkbox
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    // Now delete button should be enabled
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete caregiver/i })).not.toBeDisabled();
    });
  });

  test('enables delete button only when both confirmations are provided', async () => {
    const user = userEvent.setup();
    render(
      <DeleteCaregiverConfirmation
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const nameInput = screen.getByPlaceholderText('Sarah Martinez');
    const checkbox = screen.getByRole('checkbox');

    // Enter name
    await user.type(nameInput, 'Sarah Martinez');
    expect(screen.getByRole('button', { name: /delete caregiver/i })).toBeDisabled();

    // Check checkbox
    await user.click(checkbox);

    // Now should be enabled
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete caregiver/i })).not.toBeDisabled();
    });
  });

  test('shows name confirmation error when wrong name entered', async () => {
    const user = userEvent.setup();
    render(
      <DeleteCaregiverConfirmation
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const nameInput = screen.getByPlaceholderText('Sarah Martinez');
    await user.type(nameInput, 'John Doe');

    await waitFor(() => {
      expect(screen.getByText(/name does not match/i)).toBeInTheDocument();
    });
  });

  test('shows confirmation success when correct name entered', async () => {
    const user = userEvent.setup();
    render(
      <DeleteCaregiverConfirmation
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const nameInput = screen.getByPlaceholderText('Sarah Martinez');
    await user.type(nameInput, 'Sarah Martinez');

    await waitFor(() => {
      expect(screen.getByText(/✓ Name confirmed/i)).toBeInTheDocument();
    });
  });

  test('calls deleteCaregiver API when delete is confirmed', async () => {
    const user = userEvent.setup();
    (caregiverApi.deleteCaregiver as any).mockResolvedValue(undefined);

    render(
      <DeleteCaregiverConfirmation
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    // Provide confirmations
    await user.type(screen.getByPlaceholderText('Sarah Martinez'), 'Sarah Martinez');
    await user.click(screen.getByRole('checkbox'));

    // Click delete
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete caregiver/i })).not.toBeDisabled();
    });
    await user.click(screen.getByRole('button', { name: /delete caregiver/i }));

    await waitFor(() => {
      expect(caregiverApi.deleteCaregiver).toHaveBeenCalledWith('123', { confirmName: 'Sarah Martinez' });
    });
  });

  test('shows success toast on successful delete', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    (caregiverApi.deleteCaregiver as any).mockResolvedValue(undefined);

    render(
      <DeleteCaregiverConfirmation
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />
    );

    await user.type(screen.getByPlaceholderText('Sarah Martinez'), 'Sarah Martinez');
    await user.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete caregiver/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /delete caregiver/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Caregiver deleted successfully');
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  test('shows error toast on delete failure', async () => {
    const user = userEvent.setup();
    const error = new Error('Delete failed');
    (error as any).response = {
      data: { message: 'Failed to delete caregiver' },
    };
    (caregiverApi.deleteCaregiver as any).mockRejectedValue(error);

    render(
      <DeleteCaregiverConfirmation
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText('Sarah Martinez'), 'Sarah Martinez');
    await user.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete caregiver/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /delete caregiver/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to delete caregiver');
    });
  });

  test('handles INVALID_STATUS_TRANSITION error', async () => {
    const user = userEvent.setup();
    const error = new Error('Invalid status transition');
    (error as any).response = {
      data: {
        error: 'INVALID_STATUS_TRANSITION',
        message: 'Cannot delete terminated caregiver',
      },
    };
    (caregiverApi.deleteCaregiver as any).mockRejectedValue(error);

    render(
      <DeleteCaregiverConfirmation
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText('Sarah Martinez'), 'Sarah Martinez');
    await user.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete caregiver/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /delete caregiver/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Cannot delete terminated caregiver');
    });
  });

  test('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <DeleteCaregiverConfirmation
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={onClose}
        onSuccess={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
  });

  test('clears form state on close', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DeleteCaregiverConfirmation
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const nameInput = screen.getByPlaceholderText('Sarah Martinez') as HTMLInputElement;
    await user.type(nameInput, 'Sarah');
    expect(nameInput.value).toBe('Sarah');

    // Re-render with isOpen=false then true
    rerender(
      <DeleteCaregiverConfirmation
        isOpen={false}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    rerender(
      <DeleteCaregiverConfirmation
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const newNameInput = screen.getByPlaceholderText('Sarah Martinez') as HTMLInputElement;
    expect(newNameInput.value).toBe('');
  });
});
