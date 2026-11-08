import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithQueryClient } from '@/test/renderWithQueryClient.js';
import { FamilyPortalAccessCard } from '../FamilyPortalAccessCard';
import { usePermissions } from '@/core/hooks';
import {
  useFamilyPortalAccess,
  useInviteFamilyPortal,
  useRevokeFamilyPortal,
} from '../../hooks';
import type { FamilyPortalAccessRow } from '../../types';

vi.mock('@/core/hooks', () => ({
  usePermissions: vi.fn(),
}));

vi.mock('../../hooks', () => ({
  useFamilyPortalAccess: vi.fn(),
  useInviteFamilyPortal: vi.fn(),
  useRevokeFamilyPortal: vi.fn(),
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
  });
});
