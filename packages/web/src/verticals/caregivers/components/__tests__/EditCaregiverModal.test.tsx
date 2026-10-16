/**
 * Tests for Edit Caregiver Modal
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithQueryClient as render } from '@/test/renderWithQueryClient';
import userEvent from '@testing-library/user-event';
import { EditCaregiverModal } from '../EditCaregiverModal';
import { caregiverApi } from '../../api/index';
import { toast } from 'sonner';
import type { Caregiver } from '../../types/index';

// Mocks
vi.mock('../../api/index', () => ({
  caregiverApi: {
    updateCaregiver: vi.fn(),
  },
}));

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
  middleName: 'Ann',
  preferredName: 'Sarah',
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
  primaryPhone: { number: '(555) 123-4567', type: 'MOBILE' },
  primaryAddress: {
    line1: '123 Main St',
    line2: '',
    city: 'San Francisco',
    state: 'CA',
    postalCode: '94102',
  },
  emergencyContacts: [
    { name: 'Jane Doe', relationship: 'Sister', phone: '(555) 987-6543' },
  ],
  credentials: [],
  training: [],
  payRate: { amount: 25, unit: 'HOURLY', effectiveDate: '2024-01-15T00:00:00.000Z' },
  complianceStatus: 'COMPLIANT',
};

describe('EditCaregiverModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders modal when open', () => {
    render(
      <EditCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText(/edit caregiver/i)).toBeInTheDocument();
  });

  test('does not render when isOpen is false', () => {
    const { container } = render(
      <EditCaregiverModal
        isOpen={false}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  test('pre-populates form with caregiver data', () => {
    render(
      <EditCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Martinez')).toBeInTheDocument();
    expect(screen.getByDisplayValue('sarah@example.com')).toBeInTheDocument();
  });

  test('disables save button until changes are made', async () => {
    render(
      <EditCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    expect(saveButton).toBeDisabled();
  });

  test('enables save button after form changes', async () => {
    const user = userEvent.setup();
    render(
      <EditCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const firstNameInput = screen.getByLabelText(/first name/i);
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'Jennifer');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save changes/i })).not.toBeDisabled();
    });
  });

  test('calls updateCaregiver API with form changes', async () => {
    const user = userEvent.setup();
    (caregiverApi.updateCaregiver as any).mockResolvedValue(mockCaregiver);

    render(
      <EditCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const firstNameInput = screen.getByLabelText(/first name/i);
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'Jennifer');

    const saveButton = screen.getByRole('button', { name: /save changes/i });

    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });

    await user.click(saveButton);

    await waitFor(() => {
      expect(caregiverApi.updateCaregiver).toHaveBeenCalledWith(
        '123',
        expect.objectContaining({
          firstName: 'Jennifer',
          version: 1,
        })
      );
    });
  });

  test('shows success toast on successful update', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    (caregiverApi.updateCaregiver as any).mockResolvedValue(mockCaregiver);

    render(
      <EditCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />
    );

    const firstNameInput = screen.getByLabelText(/first name/i);
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'Jennifer');

    const saveButton = screen.getByRole('button', { name: /save changes/i });

    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });

    await user.click(saveButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Caregiver updated successfully');
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  test('handles optimistic locking error', async () => {
    const user = userEvent.setup();
    const error = new Error('Optimistic lock failure');
    (error as any).response = {
      data: {
        error: 'OPTIMISTIC_LOCK_FAILURE',
        message: 'Record was modified by another user',
        current_version: 2,
        your_version: 1,
      },
    };
    (caregiverApi.updateCaregiver as any).mockRejectedValue(error);

    render(
      <EditCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const firstNameInput = screen.getByLabelText(/first name/i);
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'Jennifer');

    const saveButton = screen.getByRole('button', { name: /save changes/i });

    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });

    await user.click(saveButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Record was modified by another user. Please refresh and try again.'
      );
    });
  });

  test('handles general validation error', async () => {
    const user = userEvent.setup();
    const error = new Error('Validation error');
    (error as any).response = {
      data: { message: 'Invalid email format' },
    };
    (caregiverApi.updateCaregiver as any).mockRejectedValue(error);

    render(
      <EditCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const firstNameInput = screen.getByLabelText(/first name/i);
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'Jennifer');

    const saveButton = screen.getByRole('button', { name: /save changes/i });

    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });

    await user.click(saveButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid email format');
    });
  });

  test('shows loading state during save', async () => {
    const user = userEvent.setup();
    // Hold the request open until the test explicitly resolves it, so the
    // in-flight "saving" state is observable deterministically (no timer race).
    let resolveSave!: (value: unknown) => void;
    const pendingSave = new Promise(resolve => { resolveSave = resolve; });
    (caregiverApi.updateCaregiver as any).mockReturnValue(pendingSave);

    render(
      <EditCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const firstNameInput = screen.getByLabelText(/first name/i);
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'Jennifer');

    const saveButton = screen.getByRole('button', { name: /save changes/i });

    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });

    await user.click(saveButton);

    // Button should show loading text while the save is in flight
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();
    });

    // Let the request finish so the component settles before teardown
    resolveSave(mockCaregiver);
  });

  test('cancels without changes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <EditCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={onClose}
        onSuccess={vi.fn()}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  test('prompts to discard changes on cancel', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <EditCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={onClose}
        onSuccess={vi.fn()}
      />
    );

    const firstNameInput = screen.getByLabelText(/first name/i);
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'Jennifer');

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(confirmSpy).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(onClose).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  test('confirms discard changes and closes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <EditCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={onClose}
        onSuccess={vi.fn()}
      />
    );

    const firstNameInput = screen.getByLabelText(/first name/i);
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'Jennifer');

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(confirmSpy).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(onClose).toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  test('resets form when caregiver prop changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <EditCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const firstNameInput = screen.getByLabelText(/first name/i);
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'Jennifer');

    const newCaregiver = { ...mockCaregiver, firstName: 'Jennifer', id: '124' };

    rerender(
      <EditCaregiverModal
        isOpen={true}
        caregiver={newCaregiver}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Jennifer')).toBeInTheDocument();
    });
  });
});
