import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Settings } from '../Settings';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/core/hooks', () => ({
  useApiClient: () => mockApiClient,
}));

describe('Settings - Team Invitation URL Flow (wdvf3abhz0)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });

    mockApiClient.get.mockReset();
    mockApiClient.post.mockReset();
    mockApiClient.put.mockReset();
    mockApiClient.delete.mockReset();

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });

    mockApiClient.get.mockImplementation(async (url: string) => {
      if (url === '/api/users/profile') {
        return {
          success: true,
          data: {
            id: 'user-admin-1',
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@folkcare.example',
            organizationId: 'org-123',
            roles: ['ORG_ADMIN'],
          },
        };
      }
      if (url === '/api/organizations/org-123/users') {
        return {
          success: true,
          data: [
            {
              id: 'user-admin-1',
              firstName: 'Admin',
              lastName: 'User',
              email: 'admin@folkcare.example',
              roles: ['ORG_ADMIN'],
              status: 'ACTIVE',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        };
      }
      if (url === '/api/organizations/org-123/invitations') {
        return {
          success: true,
          data: [
            {
              id: 'inv-1',
              token: 'existing-token-abc123',
              email: 'pending@example.com',
              roles: ['CAREGIVER'],
              status: 'PENDING',
              expiresAt: '2026-12-31T00:00:00.000Z',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        };
      }
      return { success: true, data: [] };
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderSettings = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <Settings />
      </QueryClientProvider>
    );

  it('unwrap profile envelope, opens Team tab, generates invite URL without email prompt, and copies link', async () => {
    mockApiClient.post.mockResolvedValue({
      success: true,
      data: {
        id: 'inv-new',
        token: 'generated-secret-token-xyz789',
        email: 'newemployee@example.com',
        roles: ['CAREGIVER'],
        status: 'PENDING',
        expiresAt: '2026-12-31T00:00:00.000Z',
      },
    });

    renderSettings();

    // Switch to Team tab
    const teamTab = await screen.findByRole('button', { name: /Team/i });
    fireEvent.click(teamTab);

    // Wait for Team Members section and Pending Invitations
    expect(await screen.findByText('Team Members')).toBeDefined();
    expect(await screen.findByText('pending@example.com')).toBeDefined();

    // Click Copy Link on pending invitation and verify URL uses /accept-invite/:token
    const copyPendingBtn = screen.getByRole('button', { name: /Copy Link/i });
    fireEvent.click(copyPendingBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `${window.location.origin}/accept-invite/existing-token-abc123`
    );

    // Open Invite Member modal
    const inviteBtn = screen.getByRole('button', { name: /Invite Member/i });
    fireEvent.click(inviteBtn);

    // Verify button says "Generate Invite URL" and NOT "Send Invitation"
    expect(screen.getByRole('button', { name: /Generate Invite URL/i })).toBeDefined();
    expect(screen.queryByText(/Send Invitation/i)).toBeNull();
    expect(screen.queryByText(/An invitation email will be sent/i)).toBeNull();

    // Fill out form and submit
    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'Smith' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'newemployee@example.com' } });
    fireEvent.change(screen.getByLabelText(/Role/i), { target: { value: 'CAREGIVER' } });

    fireEvent.click(screen.getByRole('button', { name: /Generate Invite URL/i }));

    // Verify generated URL is displayed in modal
    const urlInput = await screen.findByLabelText('Generated invite URL');
    expect((urlInput as HTMLInputElement).value).toBe(
      `${window.location.origin}/accept-invite/generated-secret-token-xyz789`
    );

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/organizations/org-123/invitations', {
        email: 'newemployee@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        roles: ['CAREGIVER'],
      });
    });
  }, 30000);

  it('displays inline error in modal when inviting an existing email (409 Conflict)', async () => {
    mockApiClient.post.mockRejectedValue(
      new Error('User with this email already exists in the organization')
    );

    renderSettings();

    // Switch to Team tab
    const teamTab = await screen.findByRole('button', { name: /Team/i });
    fireEvent.click(teamTab);

    // Open Invite Member modal
    const inviteBtn = await screen.findByRole('button', { name: /Invite Member/i });
    fireEvent.click(inviteBtn);

    // Fill out form with existing user email
    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Mark' } });
    fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'Jordan' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'markjsjordan@gmail.com' } });
    fireEvent.change(screen.getByLabelText(/Role/i), { target: { value: 'CAREGIVER' } });

    fireEvent.click(screen.getByRole('button', { name: /Generate Invite URL/i }));

    // Verify inline modal error message is displayed
    const errorElements = await screen.findAllByText(
      'User with this email already exists in the organization'
    );
    expect(errorElements.length).toBeGreaterThanOrEqual(1);

    // Ensure modal stays open so the user can correct the email
    expect(screen.getByRole('heading', { name: 'Invite Team Member' })).toBeDefined();
  });

  it('includes Registered Nurse (RN) as a selectable role in invite form', async () => {
    renderSettings();

    // Switch to Team tab
    const teamTab = await screen.findByRole('button', { name: /Team/i });
    fireEvent.click(teamTab);

    // Open Invite Member modal
    const inviteBtn = await screen.findByRole('button', { name: /Invite Member/i });
    fireEvent.click(inviteBtn);

    // Verify Registered Nurse (RN) option exists in the Role select
    const roleSelect = screen.getByLabelText(/Role/i);
    expect(roleSelect).toContainHTML('Registered Nurse (RN)');
    expect(screen.getByRole('option', { name: 'Registered Nurse (RN)' })).toHaveValue('NURSE_RN');
  });
});
