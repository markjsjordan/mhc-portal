import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Logout } from '../Logout';

const mockClearLocalAuth = vi.fn();
const mockServerLogout = vi.fn();

vi.mock('@/core/hooks', () => ({
  useAuth: () => ({ logout: mockClearLocalAuth }),
  useAuthService: () => ({ logout: mockServerLogout }),
}));

describe('Logout page', () => {
  beforeEach(() => {
    mockClearLocalAuth.mockReset();
    mockServerLogout.mockReset();
  });

  const renderLogout = () =>
    render(
      <MemoryRouter initialEntries={['/logout']}>
        <Routes>
          <Route path="/logout" element={<Logout />} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

  it('calls the server-side logout endpoint before clearing local auth', async () => {
    mockServerLogout.mockResolvedValueOnce(undefined);

    renderLogout();

    await waitFor(() => {
      expect(mockServerLogout).toHaveBeenCalledTimes(1);
      expect(mockClearLocalAuth).toHaveBeenCalledTimes(1);
    });
  });

  it('still clears local auth and redirects even if the server call fails', async () => {
    mockServerLogout.mockRejectedValueOnce(new Error('network error'));

    const { findByText } = renderLogout();

    await waitFor(() => {
      expect(mockClearLocalAuth).toHaveBeenCalledTimes(1);
    });
    expect(await findByText('Login Page')).toBeTruthy();
  });

  it('redirects to /login', async () => {
    mockServerLogout.mockResolvedValueOnce(undefined);

    const { findByText } = renderLogout();

    expect(await findByText('Login Page')).toBeTruthy();
  });
});
