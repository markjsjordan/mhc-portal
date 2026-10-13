/**
 * Tests for Duplicate Caregiver Modal
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DuplicateCaregiverModal } from '../DuplicateCaregiverModal';
import { caregiverApi } from '../../api/index';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { Caregiver } from '../../types/index';

// Mocks
vi.mock('../../api/index', () => ({
  caregiverApi: {
    duplicateCaregiver: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

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

describe('DuplicateCaregiverModal', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as any).mockReturnValue(mockNavigate);
  });

  test('renders modal when open', () => {
    render(
      <DuplicateCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/duplicate caregiver/i)).toBeInTheDocument();
    expect(screen.getByText(/Sarah Martinez/i)).toBeInTheDocument();
  });

  test('does not render when isOpen is false', () => {
    const { container } = render(
      <DuplicateCaregiverModal
        isOpen={false}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
      />
    );

    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  test('pre-populates first name', () => {
    render(
      <DuplicateCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
      />
    );

    const firstNameInput = screen.getByDisplayValue('Sarah');
    expect(firstNameInput).toBeInTheDocument();
  });

  test('pre-populates last name with -Copy suffix', () => {
    render(
      <DuplicateCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
      />
    );

    const lastNameInput = screen.getByDisplayValue('Martinez-Copy');
    expect(lastNameInput).toBeInTheDocument();
  });

  test('defaults new status to PENDING_ONBOARDING', async () => {
    const user = userEvent.setup();
    render(
      <DuplicateCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
      />
    );

    // The select should have PENDING_ONBOARDING as default
    const statusSelect = screen.getByDisplayValue('Pending Onboarding');
    expect(statusSelect).toBeInTheDocument();
  });

  test('has default field checkboxes', () => {
    render(
      <DuplicateCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
      />
    );

    // These should be checked by default
    expect(screen.getByRole('checkbox', { name: /skills & competencies/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /certifications & credentials/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /work preferences/i })).toBeChecked();

    // These should NOT be checked by default
    expect(screen.getByRole('checkbox', { name: /availability pattern/i })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /employment history/i })).not.toBeChecked();
  });

  test('validates required fields', async () => {
    const user = userEvent.setup();
    render(
      <DuplicateCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
      />
    );

    // Clear required fields
    const employeeInput = screen.getByPlaceholderText(/e.g., EMP-2024-999/);
    const emailInput = screen.getAllByDisplayValue('');

    await user.clear(employeeInput);
    await user.click(screen.getByRole('button', { name: /create duplicate/i }));

    expect(toast.error).toHaveBeenCalledWith('Employee number is required');
  });

  test('validates email is required', async () => {
    const user = userEvent.setup();
    render(
      <DuplicateCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
      />
    );

    const employeeInput = screen.getByPlaceholderText(/e.g., EMP-2024-999/);
    await user.type(employeeInput, 'EMP-2024-999');

    await user.click(screen.getByRole('button', { name: /create duplicate/i }));

    expect(toast.error).toHaveBeenCalledWith('Email is required');
  });

  test('calls duplicateCaregiver API with correct payload', async () => {
    const user = userEvent.setup();
    const newCaregiver = { ...mockCaregiver, id: 'new-id', employeeNumber: 'EMP-999' };
    (caregiverApi.duplicateCaregiver as any).mockResolvedValue(newCaregiver);

    render(
      <DuplicateCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
      />
    );

    // Fill in required fields
    const employeeInput = screen.getByPlaceholderText(/e.g., EMP-2024-999/);
    const emailInputs = screen.getAllByDisplayValue('');
    const emailInput = emailInputs.find(el => el.getAttribute('type') === 'email');

    await user.type(employeeInput, 'EMP-2024-999');
    if (emailInput) {
      await user.type(emailInput, 'sarah.copy@example.com');
    }

    await user.click(screen.getByRole('button', { name: /create duplicate/i }));

    await waitFor(() => {
      expect(caregiverApi.duplicateCaregiver).toHaveBeenCalledWith('123', expect.objectContaining({
        newEmployeeNumber: 'EMP-2024-999',
        newFirstName: 'Sarah',
        newLastName: 'Martinez-Copy',
        newEmail: 'sarah.copy@example.com',
      }));
    });
  });

  test('navigates to new caregiver on successful duplicate', async () => {
    const user = userEvent.setup();
    const newCaregiver = { ...mockCaregiver, id: 'new-id' };
    (caregiverApi.duplicateCaregiver as any).mockResolvedValue(newCaregiver);

    render(
      <DuplicateCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
      />
    );

    const employeeInput = screen.getByPlaceholderText(/e.g., EMP-2024-999/);
    const emailInputs = screen.getAllByDisplayValue('');
    const emailInput = emailInputs.find(el => el.getAttribute('type') === 'email');

    await user.type(employeeInput, 'EMP-2024-999');
    if (emailInput) {
      await user.type(emailInput, 'sarah.copy@example.com');
    }

    await user.click(screen.getByRole('button', { name: /create duplicate/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/caregivers/new-id');
    });
  });

  test('shows success toast on duplicate', async () => {
    const user = userEvent.setup();
    const newCaregiver = { ...mockCaregiver, id: 'new-id', employeeNumber: 'EMP-999' };
    (caregiverApi.duplicateCaregiver as any).mockResolvedValue(newCaregiver);

    render(
      <DuplicateCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
      />
    );

    const employeeInput = screen.getByPlaceholderText(/e.g., EMP-2024-999/);
    const emailInputs = screen.getAllByDisplayValue('');
    const emailInput = emailInputs.find(el => el.getAttribute('type') === 'email');

    await user.type(employeeInput, 'EMP-999');
    if (emailInput) {
      await user.type(emailInput, 'sarah.copy@example.com');
    }

    await user.click(screen.getByRole('button', { name: /create duplicate/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
  });

  test('shows error on duplicate email', async () => {
    const user = userEvent.setup();
    const error = new Error('Duplicate email');
    (error as any).response = {
      data: { error: 'DUPLICATE_EMAIL', message: 'Email already in use' },
    };
    (caregiverApi.duplicateCaregiver as any).mockRejectedValue(error);

    render(
      <DuplicateCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
      />
    );

    const employeeInput = screen.getByPlaceholderText(/e.g., EMP-2024-999/);
    const emailInputs = screen.getAllByDisplayValue('');
    const emailInput = emailInputs.find(el => el.getAttribute('type') === 'email');

    await user.type(employeeInput, 'EMP-999');
    if (emailInput) {
      await user.type(emailInput, 'existing@example.com');
    }

    await user.click(screen.getByRole('button', { name: /create duplicate/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Email already in use');
    });
  });

  test('toggles field checkboxes', async () => {
    const user = userEvent.setup();
    render(
      <DuplicateCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
      />
    );

    const skillsCheckbox = screen.getByRole('checkbox', { name: /skills & competencies/i });
    expect(skillsCheckbox).toBeChecked();

    await user.click(skillsCheckbox);
    expect(skillsCheckbox).not.toBeChecked();

    await user.click(skillsCheckbox);
    expect(skillsCheckbox).toBeChecked();
  });

  test('closes modal on cancel', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <DuplicateCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={onClose}
      />
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  test('allows changing status dropdown', async () => {
    const user = userEvent.setup();
    render(
      <DuplicateCaregiverModal
        isOpen={true}
        caregiver={mockCaregiver}
        onClose={vi.fn()}
      />
    );

    const statusSelect = screen.getByDisplayValue('Pending Onboarding');
    await user.click(statusSelect);

    // Select a different status
    const activeOption = screen.getByRole('option', { name: /^Active$/ });
    await user.click(activeOption);

    expect(screen.getByDisplayValue('Active')).toBeInTheDocument();
  });
});
