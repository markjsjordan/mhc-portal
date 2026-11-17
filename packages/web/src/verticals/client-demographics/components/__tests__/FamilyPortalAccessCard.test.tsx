import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithQueryClient } from '@/test/renderWithQueryClient.js';
import { FamilyPortalAccessCard } from '../FamilyPortalAccessCard';
import { usePermissions } from '@/core/hooks';
import {
  useFamilyPortalAccess,
  useInviteFamilyPortal,
  useRevokeFamilyPortal,
  useCreateFamilyMember,
  useUpdateFamilyMember,
} from '../../hooks';
import type { FamilyPortalAccessRow } from '../../types';

vi.mock('@/core/hooks', () => ({
  usePermissions: vi.fn(),
}));

vi.mock('../../hooks', () => ({
  useFamilyPortalAccess: vi.fn(),
  useInviteFamilyPortal: vi.fn(),
  useRevokeFamilyPortal: vi.fn(),
  useCreateFamilyMember: vi.fn(),
  useUpdateFamilyMember: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('FamilyPortalAccessCard', () => {
  const mockInviteMutate = vi.fn();
  const mockRevokeMutateAsync = vi.fn();
  const mockCreateMutateAsync = vi.fn();
  const mockUpdateMutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePermissions).mockReturnValue({
      can: vi.fn().mockReturnValue(true),
      canAny: vi.fn().mockReturnValue(true),
      canAll: vi.fn().mockReturnValue(true),
      hasRole: vi.fn().mockReturnValue(true),
      hasAnyRole: vi.fn().mockReturnValue(true),
    });

    vi.mocked(useInviteFamilyPortal).mockReturnValue({
      mutate: mockInviteMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useInviteFamilyPortal>);

    vi.mocked(useRevokeFamilyPortal).mockReturnValue({
      mutateAsync: mockRevokeMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useRevokeFamilyPortal>);

    vi.mocked(useCreateFamilyMember).mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateFamilyMember>);

    vi.mocked(useUpdateFamilyMember).mockReturnValue({
      mutateAsync: mockUpdateMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateFamilyMember>);
  });

  it('renders empty state when there are no family members', () => {
    vi.mocked(useFamilyPortalAccess).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useFamilyPortalAccess>);

    renderWithQueryClient(<FamilyPortalAccessCard clientId="c-1" />);

    expect(screen.getByText('No family members on file.')).toBeInTheDocument();
  });

  it('renders family members table with status badges and actions', () => {
    const rows: FamilyPortalAccessRow[] = [
      {
        familyMemberId: 'fm-none',
        firstName: 'Alice',
        lastName: 'Smith',
        relationship: 'Daughter',
        email: 'alice@example.com',
        portalAccessLevel: 'VIEW_BASIC',
        status: 'NONE',
        invitedAt: null,
        activatedAt: null,
        revokedAt: null,
        revokedReason: null,
        inviteExpiresAt: null,
        lastLoginAt: null,
        linked: false,
      },
      {
        familyMemberId: 'fm-invited',
        firstName: 'Bob',
        lastName: 'Smith',
        relationship: 'Son',
        email: 'bob@example.com',
        portalAccessLevel: 'FULL_ACCESS',
        status: 'INVITED',
        invitedAt: '2026-11-01T10:00:00.000Z',
        activatedAt: null,
        revokedAt: null,
        revokedReason: null,
        inviteExpiresAt: '2026-11-08T10:00:00.000Z',
        lastLoginAt: null,
        linked: false,
      },
      {
        familyMemberId: 'fm-active',
        firstName: 'Carol',
        lastName: 'Smith',
        relationship: 'Spouse',
        email: 'carol@example.com',
        portalAccessLevel: 'FULL_ACCESS',
        status: 'ACTIVE',
        invitedAt: '2026-10-01T10:00:00.000Z',
        activatedAt: '2026-10-02T10:00:00.000Z',
        revokedAt: null,
        revokedReason: null,
        inviteExpiresAt: null,
        lastLoginAt: '2026-11-06T15:00:00.000Z',
        linked: true,
      },
    ];

    vi.mocked(useFamilyPortalAccess).mockReturnValue({
      data: rows,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useFamilyPortalAccess>);

    renderWithQueryClient(<FamilyPortalAccessCard clientId="c-1" />);

    expect(screen.getByTestId('family-status-fm-none')).toHaveTextContent('No portal access');
    expect(screen.getByTestId('family-status-fm-invited')).toHaveTextContent('Invitation pending');
    expect(screen.getByTestId('family-status-fm-active')).toHaveTextContent('Portal active');

    expect(screen.getByRole('button', { name: /invite to portal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend invite/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /revoke access/i })).toHaveLength(2);
  });

  it('requires a reason when revoking family portal access', async () => {
    const rows: FamilyPortalAccessRow[] = [
      {
        familyMemberId: 'fm-active',
        firstName: 'Carol',
        lastName: 'Smith',
        relationship: 'Spouse',
        email: 'carol@example.com',
        portalAccessLevel: 'FULL_ACCESS',
        status: 'ACTIVE',
        invitedAt: '2026-10-01T10:00:00.000Z',
        activatedAt: '2026-10-02T10:00:00.000Z',
        revokedAt: null,
        revokedReason: null,
        inviteExpiresAt: null,
        lastLoginAt: '2026-11-06T15:00:00.000Z',
        linked: true,
      },
    ];

    vi.mocked(useFamilyPortalAccess).mockReturnValue({
      data: rows,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useFamilyPortalAccess>);

    renderWithQueryClient(<FamilyPortalAccessCard clientId="c-1" />);

    fireEvent.click(screen.getByRole('button', { name: /revoke access/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Revoke Family Portal Access')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /confirm revoke/i });
    expect(confirmBtn).toBeDisabled();

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '   ' } });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(textarea, { target: { value: 'Family requested access removal' } });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockRevokeMutateAsync).toHaveBeenCalledWith({
        familyMemberId: 'fm-active',
        reason: 'Family requested access removal',
      });
    });
  });

  it('hides action buttons when user lacks clients:update permission', () => {
    vi.mocked(usePermissions).mockReturnValue({
      can: vi.fn().mockImplementation((perm) => perm !== 'clients:update'),
      canAny: vi.fn().mockReturnValue(false),
      canAll: vi.fn().mockReturnValue(false),
      hasRole: vi.fn().mockReturnValue(false),
      hasAnyRole: vi.fn().mockReturnValue(false),
    });

    const rows: FamilyPortalAccessRow[] = [
      {
        familyMemberId: 'fm-active',
        firstName: 'Carol',
        lastName: 'Smith',
        relationship: 'Spouse',
        email: 'carol@example.com',
        portalAccessLevel: 'FULL_ACCESS',
        status: 'ACTIVE',
        invitedAt: '2026-10-01T10:00:00.000Z',
        activatedAt: '2026-10-02T10:00:00.000Z',
        revokedAt: null,
        revokedReason: null,
        inviteExpiresAt: null,
        lastLoginAt: '2026-11-06T15:00:00.000Z',
        linked: true,
      },
    ];

    vi.mocked(useFamilyPortalAccess).mockReturnValue({
      data: rows,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useFamilyPortalAccess>);

    renderWithQueryClient(<FamilyPortalAccessCard clientId="c-1" />);

    expect(screen.queryByRole('button', { name: /revoke access/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /invite to portal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resend invite/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('add-family-member-btn')).not.toBeInTheDocument();
  });

  it('opens Add Family Member dialog, shows access level semantics, and submits with consent and inviteNow', async () => {
    vi.mocked(useFamilyPortalAccess).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useFamilyPortalAccess>);
    mockCreateMutateAsync.mockResolvedValueOnce({
      familyMemberId: 'fm-new',
      firstName: 'Alice',
      lastName: 'Smith',
      relationship: 'SPOUSE',
      email: 'alice@example.com',
      portalAccessLevel: 'VIEW_BASIC',
      status: 'INVITED',
    });

    renderWithQueryClient(<FamilyPortalAccessCard clientId="c-1" />);

    fireEvent.click(screen.getByTestId('add-family-member-btn'));
    expect(screen.getByText(/Basic profile & visit schedule times only/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'Smith' } });
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'alice@example.com' } });
    fireEvent.click(screen.getByLabelText(/Client or legal representative has authorized/i));
    fireEvent.change(screen.getByLabelText(/Authorizer Name/i), { target: { value: 'John Smith' } });

    fireEvent.click(screen.getByTestId('submit-add-family-member-btn'));

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@example.com',
          portalAccessLevel: 'VIEW_BASIC',
          inviteNow: true,
          consent: expect.objectContaining({
            consentGiven: true,
            authorizedBy: 'CLIENT',
            authorizerName: 'John Smith',
          }),
        })
      );
    });
  });

  it('requires elevated PHI confirmation when VIEW_MEDICAL is selected in Edit Access dialog', async () => {
    const rows: FamilyPortalAccessRow[] = [
      {
        familyMemberId: 'fm-1',
        firstName: 'Jane',
        lastName: 'Doe',
        relationship: 'CHILD',
        email: 'jane@example.com',
        portalAccessLevel: 'VIEW_BASIC',
        status: 'ACTIVE',
        invitedAt: null,
        activatedAt: null,
        revokedAt: null,
        revokedReason: null,
        inviteExpiresAt: null,
        lastLoginAt: null,
        linked: true,
      },
    ];

    vi.mocked(useFamilyPortalAccess).mockReturnValue({
      data: rows,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useFamilyPortalAccess>);
    mockUpdateMutateAsync.mockResolvedValueOnce({ ...rows[0], portalAccessLevel: 'VIEW_MEDICAL' });

    renderWithQueryClient(<FamilyPortalAccessCard clientId="c-1" />);

    fireEvent.click(screen.getByTestId('edit-access-btn-fm-1'));
    fireEvent.change(screen.getByLabelText(/^Portal Access Level$/i), { target: { value: 'VIEW_MEDICAL' } });

    const confirmBtn = screen.getByTestId('confirm-edit-access-btn');
    expect(confirmBtn).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/I confirm that granting Medical\/Full PHI access/i));
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        familyMemberId: 'fm-1',
        input: {
          portalAccessLevel: 'VIEW_MEDICAL',
          confirmElevatedAccess: true,
        },
      });
    });
  });
});
