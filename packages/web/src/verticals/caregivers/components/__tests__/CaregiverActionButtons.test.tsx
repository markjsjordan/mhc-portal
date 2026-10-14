/**
 * Tests for Caregiver Action Buttons
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CaregiverActionButtons } from '../CaregiverActionButtons';
import { useAuth } from '@/core/hooks';
import type { Caregiver } from '../../types/index';

// Mock useAuth
vi.mock('@/core/hooks', () => ({
  useAuth: vi.fn(),
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
  primaryAddress: {
    line1: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    postalCode: '94102',
  },
  emergencyContacts: [],
  credentials: [],
  training: [],
  payRate: { amount: 25, unit: 'HOURLY', effectiveDate: '2024-01-15T00:00:00.000Z' },
  complianceStatus: 'COMPLIANT',
};

const mockAuthUser = {
  id: 'user-1',
  email: 'admin@example.com',
  roles: ['SUPER_ADMIN'],
  permissions: ['CAREGIVER_READ', 'CAREGIVER_WRITE', 'CAREGIVER_DELETE', 'CAREGIVER_CREATE', 'AUDIT_READ'],
};

describe('CaregiverActionButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({ user: mockAuthUser });
  });

  test('renders edit button', () => {
    const onEdit = vi.fn();
    render(
      <CaregiverActionButtons
        caregiver={mockCaregiver}
        onEdit={onEdit}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  test('renders delete button', () => {
    render(
      <CaregiverActionButtons
        caregiver={mockCaregiver}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  test('renders more actions button', () => {
    render(
      <CaregiverActionButtons
        caregiver={mockCaregiver}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /more actions/i })).toBeInTheDocument();
  });

  test('calls onEdit when edit button is clicked', () => {
    const onEdit = vi.fn();
    render(
      <CaregiverActionButtons
        caregiver={mockCaregiver}
        onEdit={onEdit}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalled();
  });

  test('calls onDelete when delete button is clicked', () => {
    const onDelete = vi.fn();
    render(
      <CaregiverActionButtons
        caregiver={mockCaregiver}
        onEdit={vi.fn()}
        onDelete={onDelete}
        onDuplicate={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalled();
  });

  test('disables delete button for TERMINATED caregiver', () => {
    const terminatedCaregiver = { ...mockCaregiver, status: 'TERMINATED' };
    render(
      <CaregiverActionButtons
        caregiver={terminatedCaregiver}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
      />
    );

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    expect(deleteButton).toBeDisabled();
  });

  test('disables delete button for RETIRED caregiver', () => {
    const retiredCaregiver = { ...mockCaregiver, status: 'RETIRED' };
    render(
      <CaregiverActionButtons
        caregiver={retiredCaregiver}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
      />
    );

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    expect(deleteButton).toBeDisabled();
  });

  test('disables edit button when lacking CAREGIVER_WRITE permission', () => {
    (useAuth as any).mockReturnValue({
      user: { ...mockAuthUser, permissions: ['CAREGIVER_READ'] },
    });

    render(
      <CaregiverActionButtons
        caregiver={mockCaregiver}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /edit/i })).toBeDisabled();
  });

  test('disables delete button when lacking CAREGIVER_DELETE permission', () => {
    (useAuth as any).mockReturnValue({
      user: { ...mockAuthUser, permissions: ['CAREGIVER_READ', 'CAREGIVER_WRITE'] },
    });

    render(
      <CaregiverActionButtons
        caregiver={mockCaregiver}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled();
  });

  test('disables all buttons when isLoading is true', () => {
    render(
      <CaregiverActionButtons
        caregiver={mockCaregiver}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        isLoading={true}
      />
    );

    expect(screen.getByRole('button', { name: /edit/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled();
  });

  test('opens more menu on button click', async () => {
    render(
      <CaregiverActionButtons
        caregiver={mockCaregiver}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
      />
    );

    const moreButton = screen.getByRole('button', { name: /more actions/i });
    fireEvent.click(moreButton);

    await waitFor(() => {
      expect(screen.getByText(/duplicate caregiver/i)).toBeInTheDocument();
    });
  });

  test('calls onDuplicate when duplicate is clicked from menu', async () => {
    const onDuplicate = vi.fn();
    render(
      <CaregiverActionButtons
        caregiver={mockCaregiver}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={onDuplicate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));

    await waitFor(() => {
      fireEvent.click(screen.getByText(/duplicate caregiver/i));
    });

    expect(onDuplicate).toHaveBeenCalled();
  });

  test('hides duplicate menu item when lacking CAREGIVER_CREATE permission', async () => {
    (useAuth as any).mockReturnValue({
      user: { ...mockAuthUser, permissions: ['CAREGIVER_READ', 'CAREGIVER_WRITE', 'CAREGIVER_DELETE'] },
    });

    render(
      <CaregiverActionButtons
        caregiver={mockCaregiver}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));

    await waitFor(() => {
      expect(screen.queryByText(/duplicate caregiver/i)).not.toBeInTheDocument();
    });
  });

  test('shows audit history option when AUDIT_READ permission exists', async () => {
    render(
      <CaregiverActionButtons
        caregiver={mockCaregiver}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onViewHistory={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));

    await waitFor(() => {
      expect(screen.getByText(/view audit history/i)).toBeInTheDocument();
    });
  });

  test('closes menu when clicking outside', async () => {
    const { container } = render(
      <div>
        <CaregiverActionButtons
          caregiver={mockCaregiver}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onDuplicate={vi.fn()}
        />
        <div data-testid="outside">Outside element</div>
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));

    await waitFor(() => {
      expect(screen.getByText(/duplicate caregiver/i)).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByTestId('outside'));

    await waitFor(() => {
      expect(screen.queryByText(/duplicate caregiver/i)).not.toBeInTheDocument();
    });
  });
});
