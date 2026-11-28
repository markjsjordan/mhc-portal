import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { renderWithQueryClient } from '@/test/renderWithQueryClient';
import ClientIntakeWorkflow from '../ClientIntakeWorkflow';
import { createClientApiService } from '@/verticals/client-demographics/services/client-api';
import type { ApiClient } from '@/core/services';

const {
  updateMutateAsync,
  updateStatusMutateAsync,
  mockUser,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  updateMutateAsync: vi.fn(),
  updateStatusMutateAsync: vi.fn(),
  mockUser: {
    current: {
      id: 'user-1',
      organizationId: 'org-1',
      branchIds: ['branch-1'],
      roles: ['ORG_ADMIN'] as string[] | undefined,
    },
  },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

vi.mock('@/core/hooks', () => ({
  useAuth: () => ({
    user: mockUser.current,
  }),
  useApiClient: () => ({
    patch: vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'client-1', status: 'ON_HOLD' },
    }),
  }),
}));

vi.mock('@/verticals/client-demographics/hooks', () => ({
  useCreateClient: () => ({ mutateAsync: vi.fn() }),
  useUpdateClient: () => ({ mutateAsync: updateMutateAsync }),
  useUpdateClientStatus: () => ({
    mutateAsync: updateStatusMutateAsync,
    isPending: false,
  }),
  useClients: () => ({ data: { items: [{ id: 'client-1', branchId: 'branch-1' }] } }),
  useBranches: () => ({ data: [{ id: 'branch-1', name: 'Main Branch', code: 'MB' }] }),
}));

// Radix Select uses pointer capture & scrollIntoView in JSDOM
beforeEach(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
  updateMutateAsync.mockReset();
  updateStatusMutateAsync.mockReset();
  updateStatusMutateAsync.mockResolvedValue({ id: 'client-1', status: 'ON_HOLD' });
  toastSuccess.mockReset();
  toastError.mockReset();
  mockUser.current = {
    id: 'user-1',
    organizationId: 'org-1',
    branchIds: ['branch-1'],
    roles: ['ORG_ADMIN'],
  };
});

function renderWorkflow(props: {
  isEditMode?: boolean;
  clientId?: string;
  currentStatus?: string;
}) {
  return renderWithQueryClient(
    <BrowserRouter>
      <ClientIntakeWorkflow {...props} />
    </BrowserRouter>
  );
}

describe('ClientIntakeWorkflow manual status section (wdvf3adqpj)', () => {
  it.each(['SUPER_ADMIN', 'ORG_ADMIN', 'ADMIN', 'BRANCH_ADMIN'])(
    'renders status section in edit mode for %s',
    (role) => {
      mockUser.current = { ...mockUser.current, roles: [role] };
      renderWorkflow({ isEditMode: true, clientId: 'client-1', currentStatus: 'ACTIVE' });
      expect(screen.getByTestId('client-status-section')).toBeInTheDocument();
    }
  );

  it('hides status section in create mode', () => {
    renderWorkflow({ isEditMode: false });
    expect(screen.queryByTestId('client-status-section')).not.toBeInTheDocument();
  });

  it.each([
    ['COORDINATOR', ['COORDINATOR']],
    ['CAREGIVER', ['CAREGIVER']],
    ['undefined roles', undefined],
  ])('hides status section for %s', (_label, roles) => {
    mockUser.current = { ...mockUser.current, roles };
    renderWorkflow({ isEditMode: true, clientId: 'client-1', currentStatus: 'ACTIVE' });
    expect(screen.queryByTestId('client-status-section')).not.toBeInTheDocument();
  });

  it('shows read-only Pending Intake badge and exposes exactly the 5 manually-settable options', async () => {
    renderWorkflow({ isEditMode: true, clientId: 'client-1', currentStatus: 'PENDING_INTAKE' });

    expect(screen.getByTestId('pending-intake-status-badge')).toHaveTextContent('Pending Intake');

    const trigger = screen.getByRole('combobox', { name: 'Client Status' });
    fireEvent.click(trigger);

    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'Active',
      'Inactive',
      'On Hold',
      'Discharged',
      'Deceased',
    ]);
  });

  it('updates non-destructive status directly without confirmation dialog and without submitting intake form', async () => {
    renderWorkflow({ isEditMode: true, clientId: 'client-1', currentStatus: 'ACTIVE' });

    fireEvent.click(screen.getByRole('combobox', { name: 'Client Status' }));
    fireEvent.click(await screen.findByRole('option', { name: 'On Hold' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update Status' }));

    await waitFor(() => {
      expect(updateStatusMutateAsync).toHaveBeenCalledWith({
        id: 'client-1',
        status: 'ON_HOLD',
      });
    });
    expect(updateMutateAsync).not.toHaveBeenCalled();
  });

  it('shows optional discharge reason and requires confirmation dialog for Discharged and Deceased', async () => {
    renderWorkflow({ isEditMode: true, clientId: 'client-1', currentStatus: 'ACTIVE' });

    // Select Discharged -> reason field appears
    fireEvent.click(screen.getByRole('combobox', { name: 'Client Status' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Discharged' }));

    const reasonInput = screen.getByLabelText('Discharge Reason (optional)');
    fireEvent.change(reasonInput, { target: { value: 'Completed care plan' } });

    // Click Update Status -> opens confirmation dialog
    fireEvent.click(screen.getByRole('button', { name: 'Update Status' }));
    expect(await screen.findByText(/automatically revoke all client and family portal access/i)).toBeInTheDocument();

    // Cancel -> does not call API
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(updateStatusMutateAsync).not.toHaveBeenCalled();

    // Confirm -> calls API with reason
    fireEvent.click(screen.getByRole('button', { name: 'Update Status' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(updateStatusMutateAsync).toHaveBeenCalledWith({
        id: 'client-1',
        status: 'DISCHARGED',
        reason: 'Completed care plan',
      });
    });

    // Switch to Deceased -> reason field hidden, confirmation dialog required
    fireEvent.click(screen.getByRole('combobox', { name: 'Client Status' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Deceased' }));
    expect(screen.queryByLabelText('Discharge Reason (optional)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Update Status' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(updateStatusMutateAsync).toHaveBeenCalledWith({
        id: 'client-1',
        status: 'DECEASED',
      });
    });
  });
});

describe('clientApi.updateClientStatus', () => {
  it('calls PATCH /api/clients/:id/status with trimmed reason when provided', async () => {
    const patch = vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'client-1', status: 'DISCHARGED' },
    });
    const api = createClientApiService({ patch } as unknown as ApiClient);

    const result = await api.updateClientStatus('client-1', 'DISCHARGED', '  Completed  ');
    expect(patch).toHaveBeenCalledWith('/api/clients/client-1/status', {
      status: 'DISCHARGED',
      reason: 'Completed',
    });
    expect(result.status).toBe('DISCHARGED');
  });

  it('omits reason when blank or undefined', async () => {
    const patch = vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'client-1', status: 'INACTIVE' },
    });
    const api = createClientApiService({ patch } as unknown as ApiClient);

    await api.updateClientStatus('client-1', 'INACTIVE', '   ');
    expect(patch).toHaveBeenCalledWith('/api/clients/client-1/status', {
      status: 'INACTIVE',
    });
  });
});

describe('useUpdateClientStatus hook', () => {
  it('invalidates client & portal access queries and shows portal-revoked toast on DISCHARGED/DECEASED', async () => {
    const actualHooks = await vi.importActual<
      typeof import('@/verticals/client-demographics/hooks/useClients')
    >('@/verticals/client-demographics/hooks/useClients');

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => actualHooks.useUpdateClientStatus(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'client-1', status: 'DISCHARGED', reason: 'Done' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['clients'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['clients', 'client-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['family-portal-access', 'client-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['client-portal-access', 'client-1'] });
    expect(toastSuccess).toHaveBeenCalledWith(
      'Client status updated to Discharged. Portal access has been revoked.'
    );
  });
});
