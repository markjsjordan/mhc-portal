import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { renderWithQueryClient } from '@/test/renderWithQueryClient';
import ClientIntakeWorkflow from '../ClientIntakeWorkflow';
import { findIntakeFormatError } from '../intake-payload';
import { ClientValidator } from '../../../../../../verticals/client-demographics/src/validation/client-validator';

const { createMutateAsync, updateMutateAsync, toastError } = vi.hoisted(() => ({
  createMutateAsync: vi.fn(),
  updateMutateAsync: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: toastError, success: vi.fn() },
}));

vi.mock('@/core/hooks', () => ({
  useAuth: () => ({
    user: { id: 'test-user', organizationId: 'test-org', branchIds: ['branch-1'] },
  }),
  useApiClient: () => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }),
}));

vi.mock('@/verticals/client-demographics/hooks', () => ({
  useCreateClient: () => ({ mutateAsync: createMutateAsync }),
  useUpdateClient: () => ({ mutateAsync: updateMutateAsync }),
  useClients: () => ({ data: { items: [{ id: 'client-1', branchId: 'branch-1' }] } }),
  useBranches: () => ({ data: [{ id: 'branch-1', name: 'Main Branch', code: 'MB' }] }),
}));

vi.mock('@/verticals/caregivers/hooks', () => ({
  useCaregivers: () => ({ data: { items: [] } }),
}));

const base = {
  firstName: 'Jane',
  lastName: 'Doe',
  dateOfBirth: '1980-05-15',
  consents: { careAgreement: true, hipaa: true, financialResponsibility: true },
  signature: 'Jane Doe',
};

function renderAtReview(props: Record<string, unknown>) {
  renderWithQueryClient(
    <BrowserRouter>
      <ClientIntakeWorkflow {...props} />
    </BrowserRouter>
  );
  for (let i = 0; i < 6; i += 1) {
    fireEvent.click(screen.getByRole('button', { name: /Next →/i }));
  }
  expect(screen.getByText('Review & Submit')).toBeInTheDocument();
}

const fullAddress = { line1: '1 Main', line2: 'Apt 2', city: 'Austin', state: 'TX', postalCode: '78701' };
const submit = () => fireEvent.click(screen.getByRole('button', { name: /Submit & Create Client/i }));

describe('ClientIntakeWorkflow partial address safety (wdvf3acxnq)', () => {
  beforeEach(() => {
    createMutateAsync.mockReset();
    createMutateAsync.mockResolvedValue({ id: 'new-client-id' });
    updateMutateAsync.mockReset();
    updateMutateAsync.mockResolvedValue({ id: 'client-1' });
    toastError.mockReset();
  });

  it('create mode: address with only Apt/Suite submits without TypeError and omits primaryAddress', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    renderAtReview({ initialData: { ...base, address: { line2: 'Apt 2' } } });
    submit();
    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    const payload = createMutateAsync.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload['primaryAddress']).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('Apt 2');
    expect(unhandled).not.toHaveBeenCalled();
    process.off('unhandledRejection', unhandled);
  });

  it.each(['line1', 'city', 'state', 'postalCode'] as const)(
    'create mode: address missing %s omits primaryAddress and does not throw',
    async (missing) => {
      const address: Record<string, string> = { ...fullAddress };
      delete address[missing];
      renderAtReview({ initialData: { ...base, address } });
      submit();
      await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
      const payload = createMutateAsync.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(payload['primaryAddress']).toBeUndefined();
    }
  );

  it('edit mode: partial initialData.address updates without TypeError', async () => {
    renderAtReview({
      isEditMode: true,
      clientId: 'client-1',
      initialData: { ...base, address: { line2: 'Apt 2' } },
    });
    submit();
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
    const input = (updateMutateAsync.mock.calls[0]?.[0] as { input: Record<string, unknown> }).input;
    expect(input['primaryAddress']).toBeUndefined();
  });

  it('partial emergency contact (missing fields) does not throw', async () => {
    renderAtReview({
      initialData: { ...base, emergencyContacts: [{ name: 'Bob' }, { phone: '5125550100' }] },
    });
    submit();
    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    const payload = createMutateAsync.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload['emergencyContacts']).toEqual([]);
  });

  it('a server 400 rejection leaves the user on the form without an uncaught error', async () => {
    // The mutation hook's onError surfaces the server message; the component must not throw or navigate.
    createMutateAsync.mockRejectedValue(new Error('Invalid postal code'));
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    renderAtReview({ initialData: { ...base, address: fullAddress } });
    submit();
    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText('Review & Submit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit & Create Client/i })).toBeInTheDocument();
    expect(unhandled).not.toHaveBeenCalled();
    process.off('unhandledRejection', unhandled);
  });

  it('payload for a partial address passes the real server createClient schema', async () => {
    renderAtReview({ initialData: { ...base, address: { line2: 'Apt 2' } } });
    submit();
    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    const payload = createMutateAsync.mock.calls[0]?.[0] as Record<string, unknown>;
    const withIds = { ...payload, organizationId: '11111111-1111-4111-8111-111111111111', branchId: '22222222-2222-4222-8222-222222222222' };
    const result = new ClientValidator().validateCreate(withIds as never);
    expect(result.success).toBe(true);
  });

  it('findIntakeFormatError tolerates partial address and contacts', () => {
    expect(findIntakeFormatError({ address: { line2: 'x' } as never })).toBeNull();
    expect(findIntakeFormatError({ emergencyContacts: [{ phone: '5125550100' } as never] })).toBeNull();
  });
});
