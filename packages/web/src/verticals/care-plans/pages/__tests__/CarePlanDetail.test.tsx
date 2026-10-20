import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CarePlanDetail } from '../CarePlanDetail';
import type { CarePlan } from '../../types';

const mockNavigate = vi.fn();
const mockRefetch = vi.fn();
const mockMutateDeleteAsync = vi.fn();
const mockMutateUpdateAsync = vi.fn();

let mockCarePlanData: CarePlan | null = null;
let mockClientData: { firstName: string; lastName: string; preferredName?: string } | null = null;

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'plan-123' }),
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('@/core/hooks', () => ({
  usePermissions: () => ({
    can: vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('@/verticals/client-demographics/hooks', () => ({
  useClient: () => ({
    data: mockClientData,
    isLoading: false,
  }),
}));

vi.mock('../../hooks', () => ({
  useCarePlan: () => ({
    data: mockCarePlanData,
    isLoading: false,
    error: null,
    refetch: mockRefetch,
  }),
  useActivateCarePlan: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpdateCarePlan: () => ({
    mutateAsync: mockMutateUpdateAsync,
    isPending: false,
  }),
  useDeleteCarePlan: () => ({
    mutateAsync: mockMutateDeleteAsync,
    isPending: false,
  }),
}));

describe('CarePlanDetail - Delete Functionality (wdvf3abqrt)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClientData = {
      firstName: 'Linda',
      lastName: 'Young',
      preferredName: 'Linda',
    };
    mockCarePlanData = {
      id: 'plan-123',
      planNumber: 'CP-TX-0002',
      name: 'COMPANION Plan for Linda Young',
      clientId: 'client-1',
      organizationId: 'org-1',
      planType: 'COMPANION',
      status: 'ACTIVE',
      priority: 'HIGH',
      effectiveDate: '2026-01-01T00:00:00.000Z',
      goals: [],
      interventions: [],
      taskTemplates: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
  });

  it('disables Delete button with explanatory tooltip when care plan is ACTIVE', () => {
    render(<CarePlanDetail />);

    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    expect(deleteBtn).toBeDisabled();

    // The wrapper span contains the explanatory tooltip
    const tooltipContainer = deleteBtn.closest('span');
    expect(tooltipContainer).toHaveAttribute(
      'title',
      'Cannot delete an active care plan. Please discontinue it first.'
    );
  });

  it('shows Discontinue button when plan is ACTIVE and allows discontinuing', async () => {
    mockMutateUpdateAsync.mockResolvedValue({});
    render(<CarePlanDetail />);

    const discontinueBtn = screen.getByRole('button', { name: /discontinue/i });
    expect(discontinueBtn).toBeInTheDocument();

    fireEvent.click(discontinueBtn);
    expect(mockMutateUpdateAsync).toHaveBeenCalledWith({
      id: 'plan-123',
      input: { status: 'DISCONTINUED' },
    });
  });

  it('enables Delete button when care plan is DISCONTINUED', () => {
    if (mockCarePlanData) {
      mockCarePlanData.status = 'DISCONTINUED';
    }
    render(<CarePlanDetail />);

    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    expect(deleteBtn).not.toBeDisabled();
  });

  it('enables Delete button when care plan is DRAFT', () => {
    if (mockCarePlanData) {
      mockCarePlanData.status = 'DRAFT';
    }
    render(<CarePlanDetail />);

    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    expect(deleteBtn).not.toBeDisabled();
  });

  it('opens confirmation dialog naming plan type and client on click, and navigates after delete', async () => {
    if (mockCarePlanData) {
      mockCarePlanData.status = 'DISCONTINUED';
    }
    mockMutateDeleteAsync.mockResolvedValue(undefined);

    render(<CarePlanDetail />);

    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteBtn);

    // Dialog opens naming plan type and client
    expect(screen.getByText(/Are you sure you want to delete the/i)).toBeInTheDocument();
    expect(screen.getAllByText('COMPANION').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Linda').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/CP-TX-0002/i).length).toBeGreaterThanOrEqual(1);

    // Confirm delete
    const confirmDeleteBtn = screen.getByRole('button', { name: /delete plan/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(mockMutateDeleteAsync).toHaveBeenCalledWith('plan-123');
      expect(mockNavigate).toHaveBeenCalledWith('/care-plans');
    });
  });
});
