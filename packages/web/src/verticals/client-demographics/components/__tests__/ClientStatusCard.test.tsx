import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClientStatusCard } from '../ClientStatusCard';
import type { Client } from '../../types';

const mockHasAnyRole = vi.fn();
const mockCanWrite = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock('@/core/hooks', () => ({
  usePermissions: () => ({
    hasAnyRole: mockHasAnyRole,
  }),
  useSectionAccess: () => ({
    canWrite: mockCanWrite(),
    readOnly: !mockCanWrite(),
  }),
}));

vi.mock('../../hooks', () => ({
  useUpdateClientStatus: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

// Simplify Radix Select in jsdom tests so we can inspect options and trigger onValueChange cleanly
vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (val: string) => void;
    children: React.ReactNode;
  }) => (
    <div data-testid="mock-select" data-value={value}>
      <select
        aria-label="Client status"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      >
        <option value="">Select status...</option>
        {children}
      </select>
    </div>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

const baseClient: Client = {
  id: 'client-123',
  organizationId: 'org-1',
  branchId: 'branch-1',
  clientNumber: 'CL-001',
  firstName: 'Jane',
  lastName: 'Doe',
  dateOfBirth: '1950-05-15',
  primaryAddress: {
    type: 'HOME',
    line1: '100 Main St',
    city: 'Austin',
    state: 'TX',
    postalCode: '78701',
    country: 'US',
  },
  emergencyContacts: [],
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ClientStatusCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasAnyRole.mockReturnValue(true);
    mockCanWrite.mockReturnValue(true);
    mockMutateAsync.mockResolvedValue({ ...baseClient, status: 'ON_HOLD' });
  });

  it('renders nothing for non-admin roles (e.g. COORDINATOR)', () => {
    mockHasAnyRole.mockReturnValue(false);
    const { container } = render(<ClientStatusCard client={baseClient} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders exact 5 selectable statuses and excludes PENDING_INTAKE and INQUIRY', () => {
    render(<ClientStatusCard client={{ ...baseClient, status: 'PENDING_INTAKE' }} />);

    expect(screen.getByTestId('pending-intake-note')).toBeInTheDocument();
    expect(screen.getByText('Pending Intake')).toBeInTheDocument();

    const select = screen.getByLabelText('Client status') as HTMLSelectElement;
    const optionValues = Array.from(select.options)
      .map((o) => o.value)
      .filter(Boolean);
    expect(optionValues).toEqual(['ACTIVE', 'INACTIVE', 'ON_HOLD', 'DISCHARGED', 'DECEASED']);
    expect(optionValues).not.toContain('PENDING_INTAKE');
    expect(optionValues).not.toContain('INQUIRY');
  });

  it('updates status directly for ACTIVE / INACTIVE / ON_HOLD without confirmation dialog', async () => {
    render(<ClientStatusCard client={baseClient} />);

    const select = screen.getByLabelText('Client status');
    fireEvent.change(select, { target: { value: 'ON_HOLD' } });

    const btn = screen.getByRole('button', { name: 'Update Status' });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: 'client-123',
        status: 'ON_HOLD',
        reason: undefined,
      });
    });
  });

  it('shows optional discharge reason and confirmation dialog for DISCHARGED', async () => {
    render(<ClientStatusCard client={baseClient} />);

    const select = screen.getByLabelText('Client status');
    fireEvent.change(select, { target: { value: 'DISCHARGED' } });

    const reasonInput = screen.getByLabelText('Reason for Discharge (Optional)');
    fireEvent.change(reasonInput, { target: { value: 'Completed care goals' } });

    fireEvent.click(screen.getByRole('button', { name: 'Update Status' }));

    expect(await screen.findByText('Confirm Status Change to Discharged')).toBeInTheDocument();
    expect(mockMutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Discharged' }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: 'client-123',
        status: 'DISCHARGED',
        reason: 'Completed care goals',
      });
    });
  });

  it('shows confirmation dialog for DECEASED and does not mutate on Cancel', async () => {
    render(<ClientStatusCard client={baseClient} />);

    const select = screen.getByLabelText('Client status');
    fireEvent.change(select, { target: { value: 'DECEASED' } });

    fireEvent.click(screen.getByRole('button', { name: 'Update Status' }));
    expect(await screen.findByText('Confirm Status Change to Deceased')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});
