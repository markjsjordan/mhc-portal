import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../Sidebar';

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
  }),
}));

describe('Sidebar component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
