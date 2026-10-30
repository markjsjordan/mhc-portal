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
    const teamTab = await screen.findByRole('tab', { name: /Team/i });
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
    const teamTab = await screen.findByRole('tab', { name: /Team/i });
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
    const teamTab = await screen.findByRole('tab', { name: /Team/i });
    fireEvent.click(teamTab);

    // Open Invite Member modal
    const inviteBtn = await screen.findByRole('button', { name: /Invite Member/i });
    fireEvent.click(inviteBtn);

    // Verify Registered Nurse (RN) option exists in the Role select
    const roleSelect = screen.getByLabelText(/Role/i);
    expect(roleSelect).toContainHTML('Registered Nurse (RN)');
    expect(screen.getByRole('option', { name: 'Registered Nurse (RN)' })).toHaveValue('NURSE_RN');
  });

  it('allows an admin to open edit modal, change team member info and role, and submit update', async () => {
    mockApiClient.put.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'user-admin-1',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@folkcare.example',
        roles: ['COORDINATOR'],
        status: 'ACTIVE',
      },
    });

    renderSettings();

    // Switch to Team tab
    const teamTab = await screen.findByRole('tab', { name: /Team/i });
    fireEvent.click(teamTab);

    // Verify member is listed
    await screen.findByText('Admin User');

    // Click Edit button for Admin User
    const editBtn = screen.getByRole('button', { name: /Edit Admin User/i });
    fireEvent.click(editBtn);

    // Verify Edit Team Member modal appears
    expect(screen.getByRole('heading', { name: 'Edit Team Member' })).toBeInTheDocument();

    // Verify pre-filled values
    const firstNameInput = screen.getByLabelText(/First Name/i);
    const lastNameInput = screen.getByLabelText(/Last Name/i);
    const emailInput = screen.getByLabelText(/Email Address/i);
    const roleSelect = screen.getByLabelText(/Role/i);

    expect(firstNameInput).toHaveValue('Admin');
    expect(lastNameInput).toHaveValue('User');
    expect(emailInput).toHaveValue('admin@folkcare.example');

    // Change fields
    fireEvent.change(firstNameInput, { target: { value: 'Jane' } });
    fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
    fireEvent.change(emailInput, { target: { value: 'jane.doe@folkcare.example' } });
    fireEvent.change(roleSelect, { target: { value: 'COORDINATOR' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(mockApiClient.put).toHaveBeenCalledWith(
        '/api/organizations/org-123/users/user-admin-1',
        {
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane.doe@folkcare.example',
          roles: ['COORDINATOR'],
        }
      );
    });
  });

  it('renders team member row with responsive mobile layout (wdvf3abxbv)', async () => {
    renderSettings();

    // Switch to Team tab
    const teamTab = await screen.findByRole('tab', { name: /Team/i });
    fireEvent.click(teamTab);

    // Verify member is listed
    await screen.findByText('Admin User');

    // Find the row containing the member name
    const memberName = screen.getByText('Admin User');
    const memberRow = memberName.closest('.divide-y > div');
    expect(memberRow).not.toBeNull();
    // Verify vertical stacking on mobile and row on desktop
    expect(memberRow?.className).toContain('flex-col');
    expect(memberRow?.className).toContain('md:flex-row');

    // Verify role badges wrap naturally
    const roleBadge = screen.getByText('Organization Administrator');
    const badgeContainer = roleBadge.parentElement;
    expect(badgeContainer?.className).toContain('flex-wrap');

    // Verify edit button is accessible and has shrink-0 to prevent being crushed on small screens
    const editBtn = screen.getByRole('button', { name: /Edit Admin User/i });
    expect(editBtn).toBeInTheDocument();
    expect(editBtn.className).toContain('shrink-0');
  });

  it('renders edit modal centered with relative positioning above backdrop (wdvf3abzpb)', async () => {
    renderSettings();

    // Switch to Team tab
    const teamTab = await screen.findByRole('tab', { name: /Team/i });
    fireEvent.click(teamTab);

    // Verify member is listed
    await screen.findByText('Admin User');

    // Click Edit button
    const editBtn = screen.getByRole('button', { name: /Edit Admin User/i });
    fireEvent.click(editBtn);

    // Verify modal heading is rendered
    const modalHeading = await screen.findByRole('heading', { name: 'Edit Team Member' });
    expect(modalHeading).toBeInTheDocument();

    // Verify the modal card has relative positioning to sit above the fixed backdrop
    const modalContent = modalHeading.closest('.relative.bg-white');
    expect(modalContent).not.toBeNull();
    expect(modalContent?.className).toContain('relative');
    expect(modalContent?.className).toContain('bg-white');
    expect(modalContent?.className).toContain('shadow-xl');

    // Verify the centering container uses flex centering and not broken sm:block table/span hacks
    const centeringContainer = modalContent?.parentElement;
    expect(centeringContainer?.className).toContain('flex');
    expect(centeringContainer?.className).toContain('items-center');
    expect(centeringContainer?.className).toContain('justify-center');
    expect(centeringContainer?.className).not.toContain('sm:block');

    // Verify backdrop exists as a sibling
    const backdrop = centeringContainer?.querySelector('.fixed.inset-0.bg-gray-500');
    expect(backdrop).not.toBeNull();

    // Verify close button works
    const closeBtn = screen.getByRole('button', { name: /Close modal/i });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Edit Team Member' })).not.toBeInTheDocument();
    });
  });
});
