import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClientList } from '../ClientList';

const access = vi.hoisted(() => ({ canWrite: true, readOnly: false }));

vi.mock('@/core/hooks', () => ({
  usePermissions: () => ({ can: () => true }),
  useSectionAccess: () => ({ canRead: true, canWrite: access.canWrite, readOnly: access.readOnly }),
  useDemoData: () => ({ hasDemoData: false, isSeeding: false, seedDemoData: vi.fn() }),
}));

vi.mock('../../hooks', () => ({
  useClients: () => ({
    data: { items: [{ id: 'c1' }], total: 1 },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../components', () => ({
  ClientCard: () => <div>card</div>,
  ClientFilters: () => <div>filters</div>,
}));

const renderList = () =>
  render(
    <MemoryRouter>
      <ClientList />
    </MemoryRouter>
  );

describe('ClientList section access', () => {
  beforeEach(() => {
    access.canWrite = true;
    access.readOnly = false;
  });

  it('shows New Client and no badge with WRITE access', () => {
    renderList();
    expect(screen.getByText('New Client')).toBeInTheDocument();
    expect(screen.queryByText('Read-only')).not.toBeInTheDocument();
  });

  it('hides write controls and shows badge with READ access', () => {
    access.canWrite = false;
    access.readOnly = true;
    renderList();
    expect(screen.queryByText('New Client')).not.toBeInTheDocument();
    expect(screen.getByText('Read-only')).toBeInTheDocument();
  });
});
