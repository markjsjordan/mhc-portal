import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { renderWithQueryClient } from '@/test/renderWithQueryClient';
import ClientIntakeWorkflow from '../ClientIntakeWorkflow';

const mockCreateMutateAsync = vi.fn();
const mockUpdateMutateAsync = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('@/core/hooks', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user',
      organizationId: 'test-org',
      branchIds: ['branch-1'],
    },
  }),
  useApiClient: () => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }),
}));

vi.mock('@/verticals/client-demographics/hooks', () => ({
  useCreateClient: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
  useUpdateClient: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
  useClients: () => ({
    data: { items: [{ id: 'client-1', branchId: 'branch-1' }] },
  }),
  useBranches: () => ({
    data: [{ id: 'branch-1', name: 'Main Branch', code: 'MB' }],
  }),
}));

vi.mock('@/verticals/caregivers/hooks', () => ({
  useCaregivers: () => ({
    data: { items: [] },
  }),
}));

const VALID_STEP1_DATA = {
  firstName: 'Jane',
  lastName: 'Doe',
  dateOfBirth: '1980-05-15',
  phone: '(555) 123-4567',
  address: {
    line1: '123 Main St',
    city: 'Austin',
    state: 'TX',
    postalCode: '78701',
  },
};

describe('ClientIntakeWorkflow - Per-step Save button (wdvf3adau9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMutateAsync.mockResolvedValue({ id: 'draft-client-123' });
    mockUpdateMutateAsync.mockResolvedValue({ id: 'draft-client-123' });
  });

  const renderWorkflow = (props = {}) =>
    renderWithQueryClient(
      <BrowserRouter>
        <ClientIntakeWorkflow {...props} />
      </BrowserRouter>
    );

  it('renders the Save button on every wizard step (1-7) and does not show stub auto-save', () => {
    renderWorkflow({ initialData: VALID_STEP1_DATA });

    expect(screen.queryByText(/Auto-saved at/i)).not.toBeInTheDocument();

    for (let step = 1; step <= 7; step++) {
      expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
      if (step < 7) {
        fireEvent.click(screen.getByRole('button', { name: /Next →/i }));
      }
    }
  });

  it('blocks Save on Step 1 when required fields are missing and does not call API', async () => {
    renderWorkflow();

    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('First name is required to save.');
    });
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
  });

  it('creates PENDING_INTAKE client on first Save in create mode, then updates on subsequent Save', async () => {
    renderWorkflow({ initialData: VALID_STEP1_DATA });

    // First save on Step 1 -> POST (createClient) with status PENDING_INTAKE
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(mockCreateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'test-org',
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1980-05-15',
        status: 'PENDING_INTAKE',
      })
    );
    expect(mockToastSuccess).toHaveBeenCalledWith('Progress saved');
    // Stays on Step 1
    expect(screen.getByText('Demographics & Contact Information')).toBeInTheDocument();

    // Advance to Step 2 and press Save again -> PATCH (updateClient) with stored draft ID
    fireEvent.click(screen.getByRole('button', { name: /Next →/i }));
    expect(screen.getByText('Care Assessment')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'draft-client-123',
        input: expect.objectContaining({
          firstName: 'Jane',
          lastName: 'Doe',
        }),
      })
    );
    expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledTimes(2);
    // Stays on Step 2
    expect(screen.getByText('Care Assessment')).toBeInTheDocument();
  });

  it('activates the saved draft via updateClient on final Step 7 Submit instead of creating a duplicate', async () => {
    renderWorkflow({
      initialData: {
        ...VALID_STEP1_DATA,
        consents: {
          careAgreement: true,
          hipaa: true,
          financialResponsibility: true,
        },
        signature: 'Jane Doe',
      },
    });

    // Save draft on Step 1
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));
    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1);
    });

    // Navigate to Step 7
    for (let step = 1; step < 7; step++) {
      fireEvent.click(screen.getByRole('button', { name: /Next →/i }));
    }

    // Final Submit should call updateClient with status: 'ACTIVE', not createClient again
    fireEvent.click(screen.getByRole('button', { name: /Submit & Create Client/i }));

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'draft-client-123',
        input: expect.objectContaining({
          status: 'ACTIVE',
        }),
      })
    );
    expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1);
  });

  it('calls updateClient in edit mode on Save and stays on current step', async () => {
    renderWorkflow({
      isEditMode: true,
      clientId: 'existing-client-456',
      initialData: VALID_STEP1_DATA,
    });

    // Advance to Step 2
    fireEvent.click(screen.getByRole('button', { name: /Next →/i }));
    expect(screen.getByText('Care Assessment')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'existing-client-456',
        input: expect.objectContaining({
          firstName: 'Jane',
          lastName: 'Doe',
        }),
      })
    );
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalledWith('Progress saved');
    // Stays on Step 2
    expect(screen.getByText('Care Assessment')).toBeInTheDocument();
  });
});
