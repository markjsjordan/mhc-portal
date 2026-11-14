import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { renderWithQueryClient } from '@/test/renderWithQueryClient';
import ClientIntakeWorkflow from '../ClientIntakeWorkflow';
import { mapClientToIntakeData } from '@/verticals/client-demographics/utils/mappers';
import type { Client } from '@/verticals/client-demographics/types/client';

const { updateMutateAsync } = vi.hoisted(() => ({ updateMutateAsync: vi.fn() }));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock('@/core/hooks', () => ({
  useAuth: () => ({
    user: { id: 'test-user', organizationId: 'test-org', branchIds: ['branch-1'] },
  }),
}));

vi.mock('@/verticals/caregivers/hooks', () => ({
  useCaregivers: () => ({ data: { items: [] } }),
}));

vi.mock('@/verticals/client-demographics/hooks', () => ({
  useCreateClient: () => ({ mutateAsync: vi.fn() }),
  useUpdateClient: () => ({ mutateAsync: updateMutateAsync }),
  useClients: () => ({ data: { items: [{ id: 'client-1', branchId: 'branch-1' }] } }),
  useBranches: () => ({ data: [{ id: 'branch-1', name: 'Main Branch', code: 'MB' }] }),
}));

const FIXED = '2026-11-01T12:00:00.000Z';

const savedClient = {
  id: 'client-1',
  organizationId: 'org-1',
  branchId: 'branch-1',
  firstName: 'Jane',
  lastName: 'Doe',
  dateOfBirth: '1950-03-04',
  primaryPhone: { number: '(512) 555-1212', type: 'HOME', canReceiveSMS: true },
  primaryAddress: {
    type: 'HOME',
    line1: '1 Main St',
    city: 'Austin',
    state: 'TX',
    postalCode: '78701',
    country: 'US',
  },
  emergencyContacts: [
    {
      id: 'ec-1',
      name: 'Sam Smith',
      relationship: 'Son',
      phone: { number: '5125550000', type: 'WORK', canReceiveSMS: true },
      isPrimary: false,
      canMakeHealthcareDecisions: true,
    },
  ],
  status: 'ACTIVE',
  createdAt: FIXED,
  updatedAt: FIXED,
} as unknown as Client;

function openEditAndSave(client: Client, currentStatus?: string) {
  renderWithQueryClient(
    <BrowserRouter>
      <ClientIntakeWorkflow
        isEditMode
        clientId={client.id}
        currentStatus={currentStatus}
        initialData={mapClientToIntakeData(client)}
      />
    </BrowserRouter>
  );
  for (let i = 0; i < 6; i += 1) {
    fireEvent.click(screen.getByRole('button', { name: /Next →/i }));
  }
  fireEvent.click(screen.getByRole('button', { name: /Submit & Create Client/i }));
}

async function sentInput(): Promise<Record<string, unknown>> {
  await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
  return (updateMutateAsync.mock.calls[0]?.[0] as { input: Record<string, unknown> }).input;
}

describe('ClientIntakeWorkflow edit-mode status advance', () => {
  beforeEach(() => {
    updateMutateAsync.mockReset();
    updateMutateAsync.mockResolvedValue({ id: 'client-1' });
  });

  it('sends status ACTIVE for PENDING_INTAKE with all required fields', async () => {
    openEditAndSave({ ...savedClient, status: 'PENDING_INTAKE' } as Client, 'PENDING_INTAKE');
    expect((await sentInput()).status).toBe('ACTIVE');
  });

  it('sends no status for PENDING_INTAKE missing emergency contacts', async () => {
    openEditAndSave(
      { ...savedClient, emergencyContacts: [], status: 'PENDING_INTAKE' } as unknown as Client,
      'PENDING_INTAKE'
    );
    expect('status' in (await sentInput())).toBe(false);
  });

  it.each(['INQUIRY', 'ACTIVE', 'INACTIVE', 'ON_HOLD', 'DISCHARGED', 'DECEASED'])(
    'never sends status for %s',
    async (status) => {
      openEditAndSave({ ...savedClient, status } as unknown as Client, status);
      expect('status' in (await sentInput())).toBe(false);
    }
  );
});
