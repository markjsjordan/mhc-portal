import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { DashboardSelector } from '../DashboardSelector';

const mockNavigate = vi.fn();
let mockUser: { email: string; roles: string[] } | null = null;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/core/hooks', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const renderSelector = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<DashboardSelector />} />
      </Routes>
    </MemoryRouter>
  );

describe('DashboardSelector', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('renders NoAccess and does not navigate when the user has no effective roles', () => {
    mockUser = { email: 'care@example.com', roles: [] };
    renderSelector();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your account does not have portal access yet. Contact your administrator.'
    );
    expect(screen.getByText(/care@example.com/)).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates a CAREGIVER to /caregiver/dashboard', async () => {
    mockUser = { email: 'c@example.com', roles: ['CAREGIVER'] };
    renderSelector();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/caregiver/dashboard', { replace: true })
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
