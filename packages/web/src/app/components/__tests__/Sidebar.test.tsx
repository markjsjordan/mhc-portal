import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar, HIDDEN_NAV_LABELS } from '../Sidebar';

const sectionState = vi.hoisted(() => ({ hidden: new Set<string>() }));

const mockUser = {
  id: 'usr_123',
  name: 'Jane Admin',
  email: 'admin@folkcare.example',
  roles: ['ADMIN'],
};

vi.mock('@/core/hooks', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: true,
    logout: vi.fn(),
  }),
  usePermissions: () => ({
    can: vi.fn(() => true),
    canAny: vi.fn(() => true),
    canAll: vi.fn(() => true),
    hasRole: vi.fn(() => true),
    hasAnyRole: vi.fn(() => true),
    canSection: (section: string) => !sectionState.hidden.has(section),
  }),
}));

describe('Sidebar component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sectionState.hidden.clear();
  });

  it('hides a nav item whose section access is NONE', () => {
    const renderSidebar = () =>
      render(
        <MemoryRouter>
          <Sidebar isOpen={true} onClose={vi.fn()} isDesktopOpen={true} />
        </MemoryRouter>
      );
    const first = renderSidebar();
    expect(screen.getByText('Clients')).toBeInTheDocument();
    first.unmount();

    sectionState.hidden.add('clients');
    renderSidebar();
    expect(screen.queryByText('Clients')).not.toBeInTheDocument();
  });

  it('renders close button accessible on desktop and mobile (no lg:hidden)', () => {
    const handleClose = vi.fn();
    render(
      <MemoryRouter>
        <Sidebar isOpen={true} onClose={handleClose} isDesktopOpen={true} />
      </MemoryRouter>
    );

    const closeButton = screen.getByRole('button', { name: /close sidebar/i });
    expect(closeButton).toBeInTheDocument();
    const headerWrapper = closeButton.closest('div');
    expect(headerWrapper?.className).not.toContain('lg:hidden');

    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('applies lg:translate-x-0 when isDesktopOpen is true', () => {
    render(
      <MemoryRouter>
        <Sidebar isOpen={false} onClose={vi.fn()} isDesktopOpen={true} />
      </MemoryRouter>
    );

    const aside = screen.getByRole('complementary');
    expect(aside.className).toContain('lg:translate-x-0');
    expect(aside.className).not.toContain('lg:-translate-x-full');
  });

  it('applies lg:-translate-x-full when isDesktopOpen is false', () => {
    render(
      <MemoryRouter>
        <Sidebar isOpen={false} onClose={vi.fn()} isDesktopOpen={false} />
      </MemoryRouter>
    );

    const aside = screen.getByRole('complementary');
    expect(aside.className).toContain('lg:-translate-x-full');
    expect(aside.className).not.toContain('lg:translate-x-0');
  });

  it('renders mobile backdrop when isOpen is true and calls onClose when clicked', () => {
    const handleClose = vi.fn();
    const { container } = render(
      <MemoryRouter>
        <Sidebar isOpen={true} onClose={handleClose} isDesktopOpen={true} />
      </MemoryRouter>
    );

    const backdrop = container.querySelector('.fixed.inset-0.bg-gray-900');
    expect(backdrop).toBeInTheDocument();
    expect(backdrop?.className).toContain('lg:hidden');

    fireEvent.click(backdrop!);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('does not render mobile backdrop when isOpen is false', () => {
    const { container } = render(
      <MemoryRouter>
        <Sidebar isOpen={false} onClose={vi.fn()} isDesktopOpen={true} />
      </MemoryRouter>
    );

    const backdrop = container.querySelector('.fixed.inset-0.bg-gray-900');
    expect(backdrop).toBeNull();
  });

  it('renders updated navigation items for an admin-role user', () => {
    render(
      <MemoryRouter>
        <Sidebar isOpen={true} onClose={vi.fn()} isDesktopOpen={true} />
      </MemoryRouter>
    );

    expect(screen.getByText('Visits')).toBeInTheDocument();
    expect(screen.getByText('Calendar')).toBeInTheDocument();

    expect(screen.queryByText('Scheduling')).not.toBeInTheDocument();
    expect(screen.queryByText('Calendar View')).not.toBeInTheDocument();
    expect(screen.queryByText('Create Care Plan')).not.toBeInTheDocument();
    expect(screen.queryByText('Import / Export')).not.toBeInTheDocument();
  });

  it('hides the configured navigation items defined in HIDDEN_NAV_LABELS', () => {
    render(
      <MemoryRouter>
        <Sidebar isOpen={true} onClose={vi.fn()} isDesktopOpen={true} />
      </MemoryRouter>
    );

    expect(HIDDEN_NAV_LABELS).toEqual([
      'Tasks',
      'Time Tracking',
      'Billing',
      'Quality Assurance',
      'Compliance',
    ]);

    for (const label of HIDDEN_NAV_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });
});
