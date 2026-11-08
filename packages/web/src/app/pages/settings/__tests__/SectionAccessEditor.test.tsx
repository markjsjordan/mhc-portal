import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SectionAccessEditor } from '../SectionAccessEditor';
import { useAuthStore } from '@/core/hooks/auth';
import { SECTIONS } from '@/core/types/sections';
import type { Section } from '@/core/types/sections';
import type { Role } from '@/core/types/auth';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}));

vi.mock('@/core/hooks', () => ({
  useApiClient: () => mockApiClient,
}));

const buildMap = (
  overrides: Partial<Record<Section, { read: boolean; write: boolean }>> = {}
): Record<Section, { read: boolean; write: boolean }> => {
  const map = {} as Record<Section, { read: boolean; write: boolean }>;
  for (const s of SECTIONS) {
    map[s] = overrides[s] ?? { read: true, write: true };
  }
  return map;
};

const setActor = (roles: Role[], id = 'admin-1', organizationId = 'org-1') => {
  useAuthStore.getState().setAuth(
    {
      id,
      email: 'admin@example.com',
      name: 'Admin',
      roles,
      permissions: ['*:*'],
      organizationId,
    },
    'token-1'
  );
};

describe('SectionAccessEditor', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    useAuthStore.getState().clearAuth();
    mockApiClient.get.mockReset();
    mockApiClient.put.mockReset();

    mockApiClient.get.mockResolvedValue({
      roleDefaults: buildMap({ billing: { read: true, write: false } }),
      overrides: [{ section: 'clients', access: 'READ' }],
      effective: buildMap({
        clients: { read: true, write: false },
        billing: { read: true, write: false },
      }),
    });
    mockApiClient.put.mockResolvedValue({
      roleDefaults: buildMap({ billing: { read: true, write: false } }),
      overrides: [{ section: 'billing', access: 'NONE' }],
      effective: buildMap({
        billing: { read: false, write: false },
      }),
    });
  });

  afterEach(() => {
    queryClient.clear();
    useAuthStore.getState().clearAuth();
  });

  const renderEditor = (userId = 'target-user-1') =>
    render(
      <QueryClientProvider client={queryClient}>
        <SectionAccessEditor orgId="org-1" userId={userId} />
      </QueryClientProvider>
    );

  it.each<Role>(['COORDINATOR', 'BRANCH_ADMIN'])('does not render for %s', (role) => {
    setActor([role]);
    renderEditor();
    expect(screen.queryByTestId('section-access-editor')).not.toBeInTheDocument();
    expect(mockApiClient.get).not.toHaveBeenCalled();
  });

  it.each<Role>(['ORG_ADMIN', 'SUPER_ADMIN'])(
    'renders all sections and saves overrides for %s',
    async (role) => {
      setActor([role]);
      renderEditor();

      expect(await screen.findByTestId('section-access-editor')).toBeInTheDocument();
      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/api/organizations/org-1/users/target-user-1/section-access'
      );

      for (const section of SECTIONS) {
        expect(screen.getByLabelText(`Override for ${section}`)).toBeInTheDocument();
      }

      const clientsSelect = screen.getByLabelText('Override for clients') as HTMLSelectElement;
      expect(clientsSelect.value).toBe('READ');

      const billingSelect = screen.getByLabelText('Override for billing') as HTMLSelectElement;
      expect(billingSelect.value).toBe('');

      fireEvent.change(billingSelect, { target: { value: 'NONE' } });
      fireEvent.change(clientsSelect, { target: { value: '' } });

      const saveBtn = screen.getByRole('button', { name: 'Save section access' });
      expect(saveBtn).not.toBeDisabled();
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockApiClient.put).toHaveBeenCalledWith(
          '/api/organizations/org-1/users/target-user-1/section-access',
          {
            overrides: [
              { section: 'clients', access: null },
              { section: 'billing', access: 'NONE' },
            ],
          }
        );
      });
    }
  );
});
