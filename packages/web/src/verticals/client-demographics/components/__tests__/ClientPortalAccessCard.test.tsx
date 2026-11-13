import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithQueryClient } from '@/test/renderWithQueryClient.js';
import { ClientPortalAccessCard } from '../ClientPortalAccessCard';
import { usePermissions } from '@/core/hooks';
import { useClientPortalAccess, useInviteClientPortal, useRevokeClientPortal } from '../../hooks';
import type { ClientPortalAccess } from '../../types';

vi.mock('@/core/hooks', () => ({ usePermissions: vi.fn() }));
vi.mock('../../hooks', () => ({
  useClientPortalAccess: vi.fn(),
  useInviteClientPortal: vi.fn(),
  useRevokeClientPortal: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const base: ClientPortalAccess = {
  clientId: 'c-1',
  email: 'client@example.com',
  clientStatus: 'ACTIVE',
  status: 'NONE',
  invitedAt: null,
  activatedAt: null,
  revokedAt: null,
  revokedReason: null,
  inviteExpiresAt: null,
  linked: false,
};

describe('ClientPortalAccessCard', () => {
  const invite = vi.fn();
  const revokeAsync = vi.fn().mockResolvedValue(undefined);

  const setup = (data: Partial<ClientPortalAccess>, canUpdate = true) => {
    vi.mocked(usePermissions).mockReturnValue({
      can: vi.fn().mockReturnValue(canUpdate),
      canAny: vi.fn(),
      canAll: vi.fn(),
      hasRole: vi.fn(),
      hasAnyRole: vi.fn(),
    } as unknown as ReturnType<typeof usePermissions>);
    vi.mocked(useClientPortalAccess).mockReturnValue({
      data: { ...base, ...data },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useClientPortalAccess>);
    return renderWithQueryClient(<ClientPortalAccessCard clientId="c-1" />);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useInviteClientPortal).mockReturnValue({ mutate: invite, isPending: false } as unknown as ReturnType<typeof useInviteClientPortal>);
    vi.mocked(useRevokeClientPortal).mockReturnValue({ mutateAsync: revokeAsync, isPending: false } as unknown as ReturnType<typeof useRevokeClientPortal>);
  });

  it('renders nothing without clients:update', () => {
    const { container } = setup({}, false);
    expect(container).toBeEmptyDOMElement();
  });

  it('invites when no access', () => {
    setup({});
    fireEvent.click(screen.getByRole('button', { name: 'Invite to portal' }));
    expect(invite).toHaveBeenCalled();
  });

  it('disables invite without a client email', () => {
    setup({ email: '' });
    expect(screen.getByRole('button', { name: 'Invite to portal' })).toBeDisabled();
    expect(screen.getByText('Add a client email to enable an invitation.')).toBeInTheDocument();
  });

  it('hides invite for discharged clients', () => {
    setup({ clientStatus: 'DISCHARGED' });
    expect(screen.queryByRole('button', { name: 'Invite to portal' })).toBeNull();
  });

  it('requires a reason to revoke an active client, then calls revoke', async () => {
    setup({ status: 'ACTIVE', linked: true });
    expect(screen.getByTestId('client-portal-status')).toHaveTextContent('Portal active');
    fireEvent.click(screen.getByRole('button', { name: 'Revoke access' }));
    const confirm = await screen.findByRole('button', { name: 'Revoke access', hidden: false });
    void confirm;
    const textarea = screen.getByLabelText(/Reason/);
    fireEvent.change(textarea, { target: { value: 'No longer a client' } });
    const buttons = screen.getAllByRole('button', { name: 'Revoke access' });
    fireEvent.click(buttons[buttons.length - 1]!);
    await waitFor(() => expect(revokeAsync).toHaveBeenCalledWith({ reason: 'No longer a client', suspend: false }));
  });

  it('suspends an active client with a reason', async () => {
    setup({ status: 'ACTIVE', linked: true });
    fireEvent.click(screen.getByRole('button', { name: 'Suspend access' }));
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Hold' } });
    const buttons = screen.getAllByRole('button', { name: 'Suspend access' });
    fireEvent.click(buttons[buttons.length - 1]!);
    await waitFor(() => expect(revokeAsync).toHaveBeenCalledWith({ reason: 'Hold', suspend: true }));
  });
});
