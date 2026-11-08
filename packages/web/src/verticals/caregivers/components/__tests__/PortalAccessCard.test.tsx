import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithQueryClient } from '@/test/renderWithQueryClient.js';
import { PortalAccessCard } from '../PortalAccessCard.js';
import { usePermissions } from '@/core/hooks/index.js';
import {
  useCaregiverPortalAccess,
  useInviteCaregiverPortal,
  useRevokeCaregiverPortal,
} from '../../hooks/index.js';
import type { PortalAccessSummary } from '../../types/index.js';

vi.mock('@/core/hooks/index.js', () => ({
  usePermissions: vi.fn(),
}));

vi.mock('../../hooks/index.js', () => ({
  useCaregiverPortalAccess: vi.fn(),
  useInviteCaregiverPortal: vi.fn(),
  useRevokeCaregiverPortal: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('PortalAccessCard', () => {
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

    vi.mocked(useInviteCaregiverPortal).mockReturnValue({
      mutate: mockInviteMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useInviteCaregiverPortal>);

    vi.mocked(useRevokeCaregiverPortal).mockReturnValue({
      mutateAsync: mockRevokeMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useRevokeCaregiverPortal>);
  });

  it('renders NONE status badge and Invite button when status is NONE', () => {
    const summary: PortalAccessSummary = {
      status: 'NONE',
      invitedAt: null,
      activatedAt: null,
      revokedAt: null,
      revokedReason: null,
      inviteExpiresAt: null,
      lastLoginAt: null,
      linked: false,
    };
    vi.mocked(useCaregiverPortalAccess).mockReturnValue({
      data: summary,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCaregiverPortalAccess>);

    renderWithQueryClient(<PortalAccessCard caregiverId="cg-1" />);

    expect(screen.getByTestId('portal-access-status-badge')).toHaveTextContent('No portal access');
    const inviteBtn = screen.getByRole('button', { name: /invite to portal/i });
    expect(inviteBtn).toBeInTheDocument();

    fireEvent.click(inviteBtn);
    expect(mockInviteMutate).toHaveBeenCalled();
  });

  it('renders INVITED status badge, expiry, and Resend + Revoke buttons', () => {
    const summary: PortalAccessSummary = {
      status: 'INVITED',
      invitedAt: '2026-11-01T12:00:00.000Z',
      activatedAt: null,
      revokedAt: null,
      revokedReason: null,
      inviteExpiresAt: '2026-11-08T12:00:00.000Z',
      lastLoginAt: null,
      linked: false,
    };
    vi.mocked(useCaregiverPortalAccess).mockReturnValue({
      data: summary,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCaregiverPortalAccess>);

    renderWithQueryClient(<PortalAccessCard caregiverId="cg-1" />);

    expect(screen.getByTestId('portal-access-status-badge')).toHaveTextContent('Invitation pending');
    expect(screen.getByRole('button', { name: /resend invite/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /revoke access/i })).toBeInTheDocument();
  });

  it('renders ACTIVE status badge, last login, and Revoke button', () => {
    const summary: PortalAccessSummary = {
      status: 'ACTIVE',
      invitedAt: '2026-10-01T12:00:00.000Z',
      activatedAt: '2026-10-02T12:00:00.000Z',
      revokedAt: null,
      revokedReason: null,
      inviteExpiresAt: null,
      lastLoginAt: '2026-11-05T08:30:00.000Z',
      linked: true,
    };
    vi.mocked(useCaregiverPortalAccess).mockReturnValue({
      data: summary,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCaregiverPortalAccess>);

    renderWithQueryClient(<PortalAccessCard caregiverId="cg-1" />);

    expect(screen.getByTestId('portal-access-status-badge')).toHaveTextContent('Portal active');
    expect(screen.getByText(/last login:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /revoke access/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /invite to portal/i })).not.toBeInTheDocument();
  });

  it('renders SUSPENDED status badge and explanation with no action buttons', () => {
    const summary: PortalAccessSummary = {
      status: 'SUSPENDED',
      invitedAt: '2026-10-01T12:00:00.000Z',
      activatedAt: '2026-10-02T12:00:00.000Z',
      revokedAt: null,
      revokedReason: null,
      inviteExpiresAt: null,
      lastLoginAt: '2026-11-01T08:30:00.000Z',
      linked: true,
    };
    vi.mocked(useCaregiverPortalAccess).mockReturnValue({
      data: summary,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCaregiverPortalAccess>);

    renderWithQueryClient(<PortalAccessCard caregiverId="cg-1" />);

    expect(screen.getByTestId('portal-access-status-badge')).toHaveTextContent('Suspended');
    expect(screen.getByText(/access will automatically return when the caregiver is reinstated/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /invite to portal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resend invite/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /revoke access/i })).not.toBeInTheDocument();
  });

  it('renders REVOKED status badge, date, reason, and Invite button', () => {
    const summary: PortalAccessSummary = {
      status: 'REVOKED',
      invitedAt: '2026-10-01T12:00:00.000Z',
      activatedAt: '2026-10-02T12:00:00.000Z',
      revokedAt: '2026-11-06T14:00:00.000Z',
      revokedReason: 'Disciplinary review',
      inviteExpiresAt: null,
      lastLoginAt: '2026-11-05T08:30:00.000Z',
      linked: false,
    };
    vi.mocked(useCaregiverPortalAccess).mockReturnValue({
      data: summary,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCaregiverPortalAccess>);

    renderWithQueryClient(<PortalAccessCard caregiverId="cg-1" />);

    expect(screen.getByTestId('portal-access-status-badge')).toHaveTextContent('Access revoked');
    expect(screen.getByText(/disciplinary review/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /invite to portal/i })).toBeInTheDocument();
  });

  it('requires a reason when confirming revocation', async () => {
    const summary: PortalAccessSummary = {
      status: 'ACTIVE',
      invitedAt: '2026-10-01T12:00:00.000Z',
      activatedAt: '2026-10-02T12:00:00.000Z',
      revokedAt: null,
      revokedReason: null,
      inviteExpiresAt: null,
      lastLoginAt: '2026-11-05T08:30:00.000Z',
      linked: true,
    };
    vi.mocked(useCaregiverPortalAccess).mockReturnValue({
      data: summary,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCaregiverPortalAccess>);

    renderWithQueryClient(<PortalAccessCard caregiverId="cg-1" />);

    fireEvent.click(screen.getByRole('button', { name: /revoke access/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Revoke Portal Access')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /confirm revoke/i });
    expect(confirmBtn).toBeDisabled();

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '   ' } });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(textarea, { target: { value: 'Caregiver left the organization' } });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockRevokeMutateAsync).toHaveBeenCalledWith('Caregiver left the organization');
    });
  });

  it('hides action buttons when user lacks caregivers:update permission', () => {
    vi.mocked(usePermissions).mockReturnValue({
      can: vi.fn().mockImplementation((perm) => perm !== 'caregivers:update'),
      canAny: vi.fn().mockReturnValue(false),
      canAll: vi.fn().mockReturnValue(false),
      hasRole: vi.fn().mockReturnValue(false),
      hasAnyRole: vi.fn().mockReturnValue(false),
    });

    const summary: PortalAccessSummary = {
      status: 'INVITED',
      invitedAt: '2026-11-01T12:00:00.000Z',
      activatedAt: null,
      revokedAt: null,
      revokedReason: null,
      inviteExpiresAt: '2026-11-08T12:00:00.000Z',
      lastLoginAt: null,
      linked: false,
    };
    vi.mocked(useCaregiverPortalAccess).mockReturnValue({
      data: summary,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCaregiverPortalAccess>);

    renderWithQueryClient(<PortalAccessCard caregiverId="cg-1" />);

    expect(screen.queryByRole('button', { name: /resend invite/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /revoke access/i })).not.toBeInTheDocument();
  });
});
