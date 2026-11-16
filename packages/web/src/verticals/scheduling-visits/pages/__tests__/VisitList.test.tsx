import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VisitList } from '../VisitList';

vi.mock('@/core/api/visits', () => ({
  visitsApi: {
    list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    getStats: vi.fn().mockResolvedValue({ total: 0, scheduled: 0, inProgress: 0, completed: 0, cancelled: 0 }),
  },
}));

vi.mock('@/core/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', roles: ['ADMIN'], permissions: ['visits:create', 'visits:read'] },
  }),
}));

vi.mock('@/core/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../../components/CreateVisitModal', () => ({
  CreateVisitModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="create-visit-modal">CreateVisitModal</div> : null,
}));

describe('VisitList (wdvf3ad4h8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Schedule Visit split-button popover with mobile viewport clamping and opens CreateVisitModal on selection', async () => {
    render(
      <MemoryRouter>
        <VisitList />
      </MemoryRouter>
    );

    const trigger = await screen.findByRole('button', { name: /select visit type to schedule/i });
    fireEvent.click(trigger);

    const heading = await screen.findByText('Schedule by Visit Type');
    expect(heading).toBeInTheDocument();

    const dialog = heading.closest('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.className).toContain('max-w-[calc(100vw-1rem)]');

    // Escape dismisses the popover
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Schedule by Visit Type')).not.toBeInTheDocument();
  });
});
