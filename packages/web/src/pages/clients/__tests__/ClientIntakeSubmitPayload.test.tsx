import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { renderWithQueryClient } from '@/test/renderWithQueryClient';
import ClientIntakeWorkflow from '../ClientIntakeWorkflow';

const { createMutateAsync, toastError } = vi.hoisted(() => ({
  createMutateAsync: vi.fn(),
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
  useUpdateClient: () => ({ mutateAsync: vi.fn() }),
  useClients: () => ({ data: { items: [{ id: 'client-1', branchId: 'branch-1' }] } }),
  useBranches: () => ({ data: [{ id: 'branch-1', name: 'Main Branch', code: 'MB' }] }),
}));

const baseData = {
  firstName: 'Jane',
  lastName: 'Doe',
  dateOfBirth: '1980-05-15',
  address: {
    line1: '123 Main Street',
    line2: '',
    city: 'Austin',
    state: 'TX',
    postalCode: '78701',
  },
  consents: { careAgreement: true, hipaa: true, financialResponsibility: true },
  signature: 'Jane Doe',
};

function renderAtReview(initialData: Record<string, unknown>) {
  renderWithQueryClient(
    <BrowserRouter>
      <ClientIntakeWorkflow initialData={initialData} />
    </BrowserRouter>
  );
  // Step 1 -> 6
  for (let i = 0; i < 5; i += 1) {
    fireEvent.click(screen.getByRole('button', { name: /Next →/i }));
  }
  expect(screen.getByText('Review & Submit')).toBeInTheDocument();
}

describe('ClientIntakeWorkflow submit payload', () => {
  beforeEach(() => {
    createMutateAsync.mockReset();
    createMutateAsync.mockResolvedValue({ id: 'new-client-id' });
    toastError.mockReset();
  });

  it('omits blank optional email and address line 2 instead of sending empty strings', async () => {
    renderAtReview({ ...baseData, email: '   ', phone: '' });

    fireEvent.click(screen.getByRole('button', { name: /Submit & Create Client/i }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    const payload = createMutateAsync.mock.calls[0]?.[0] as Record<string, unknown>;

    // zod: z.string().email().optional() rejects "" but accepts a missing key
    expect(payload['email']).toBeUndefined();
    expect(payload['primaryPhone']).toBeUndefined();
    expect(payload['caregiverAssignment']).toBeUndefined();
    expect((payload['primaryAddress'] as Record<string, unknown>)['line2']).toBeUndefined();
    expect(payload['firstName']).toBe('Jane');
  });

  it('still sends a filled-in email, trimmed', async () => {
    renderAtReview({ ...baseData, email: '  jane@example.com ' });

    fireEvent.click(screen.getByRole('button', { name: /Submit & Create Client/i }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    const payload = createMutateAsync.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload['email']).toBe('jane@example.com');
  });

  it('create payload still carries status ACTIVE', async () => {
    renderAtReview({ ...baseData });

    fireEvent.click(screen.getByRole('button', { name: /Submit & Create Client/i }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    const payload = createMutateAsync.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload['status']).toBe('ACTIVE');
  });

  it('blocks submit and reports a ZIP the server would reject, without calling the API', async () => {
    renderAtReview({ ...baseData, address: { ...baseData.address, postalCode: '7870' } });

    fireEvent.click(screen.getByRole('button', { name: /Submit & Create Client/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0]?.[0])).toMatch(/ZIP/);
    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it('submits free-text visitFrequency and visitDuration and omits blank strings as undefined', async () => {
    renderAtReview({
      ...baseData,
      visitFrequency: '3x per week',
      visitDuration: '45-60 min',
    });

    fireEvent.click(screen.getByRole('button', { name: /Submit & Create Client/i }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    const payload = createMutateAsync.mock.calls[0]?.[0] as Record<string, unknown>;
    const carePlan = payload['carePlanSummary'] as Record<string, unknown>;
    expect(carePlan['visitFrequency']).toBe('3x per week');
    expect(carePlan['visitDuration']).toBe('45-60 min');
  });

  it('omits blank visitFrequency and visitDuration as undefined', async () => {
    renderAtReview({
      ...baseData,
      visitFrequency: '   ',
      visitDuration: '',
    });

    fireEvent.click(screen.getByRole('button', { name: /Submit & Create Client/i }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    const payload = createMutateAsync.mock.calls[0]?.[0] as Record<string, unknown>;
    const carePlan = payload['carePlanSummary'] as Record<string, unknown>;
    expect(carePlan['visitFrequency']).toBeUndefined();
    expect(carePlan['visitDuration']).toBeUndefined();
  });
});
