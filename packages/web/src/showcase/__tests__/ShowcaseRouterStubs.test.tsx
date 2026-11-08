import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ShowcaseRouter } from '../ShowcaseRouter.js';

vi.mock('@/core/hooks', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    usePermissions: () => ({
      can: () => true,
      canSection: () => true,
    }),
    useDemoData: () => ({
      hasDemoData: true,
      isSeeding: false,
      seedDemoData: vi.fn(),
    }),
    useAuth: () => ({
      user: { id: 'u-admin', email: 'admin@folkcare.example', roles: ['ADMIN'] },
    }),
    useApiClient: () => ({
      get: vi.fn().mockResolvedValue({ items: [] }),
      post: vi.fn().mockResolvedValue({}),
    }),
    useIdleLogout: vi.fn(),
  };
});

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useQuery: () => ({
      data: { items: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    }),
    useMutation: () => ({
      mutate: vi.fn(),
      isPending: false,
    }),
  };
});

describe('ShowcaseRouter stubs (wdvf3acfj3)', () => {
  it('does not render "Coming soon..." for /caregivers', () => {
    render(
      <MemoryRouter initialEntries={['/caregivers']}>
        <ShowcaseRouter />
      </MemoryRouter>
    );

    expect(screen.queryByText('Coming soon...')).not.toBeInTheDocument();
  });

  it('does not render "Coming soon..." for /settings', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <ShowcaseRouter />
      </MemoryRouter>
    );

    expect(screen.queryByText('Coming soon...')).not.toBeInTheDocument();
  });
});
