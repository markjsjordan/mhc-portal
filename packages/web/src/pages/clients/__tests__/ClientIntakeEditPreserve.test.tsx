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

function openEditAndSave(client: Client) {
  renderWithQueryClient(
    <BrowserRouter>
      <ClientIntakeWorkflow
        isEditMode
        clientId={client.id}
        initialData={mapClientToIntakeData(client)}
      />
    </BrowserRouter>
  );
  for (let i = 0; i < 6; i += 1) {
    fireEvent.click(screen.getByRole('button', { name: /Next →/i }));
  }
  fireEvent.click(screen.getByRole('button', { name: /Submit & Create Client/i }));
}

describe('ClientIntakeWorkflow edit mode (saved data is not lost)', () => {
  beforeEach(() => {
    updateMutateAsync.mockReset();
    updateMutateAsync.mockResolvedValue({ id: 'client-1' });
  });

  it('writes saved emergency contacts back unchanged instead of wiping or regenerating them', async () => {
    openEditAndSave(savedClient);

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
    const { input } = updateMutateAsync.mock.calls[0]?.[0] as {
      input: { emergencyContacts: Array<Record<string, unknown>> };
    };

    expect(input.emergencyContacts).toHaveLength(1);
    expect(input.emergencyContacts[0]).toMatchObject({
      id: 'ec-1',
      name: 'Sam Smith',
      relationship: 'Son',
      isPrimary: false,
      canMakeHealthcareDecisions: true,
      phone: { number: '5125550000', type: 'WORK', canReceiveSMS: true },
    });
  });

  it('preserves the primary phone type and SMS flag on save', async () => {
    openEditAndSave(savedClient);

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
    const { input } = updateMutateAsync.mock.calls[0]?.[0] as {
      input: { primaryPhone: Record<string, unknown> };
    };

    expect(input.primaryPhone).toEqual({
      number: '(512) 555-1212',
      type: 'HOME',
      canReceiveSMS: true,
    });
  });
});
