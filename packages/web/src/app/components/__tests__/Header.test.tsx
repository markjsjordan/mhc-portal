import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '../Header';

// Mock useAuth
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
  }),
}));

describe('Header component', () => {
  it('renders hamburger menu button with accessible label and minimum 44px tap target', () => {
    const handleMenuClick = vi.fn();
    render(<Header onMenuClick={handleMenuClick} />);

    const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
    expect(menuButton).toBeInTheDocument();
    expect(menuButton.className).toMatch(/min-w-\[44px\]/);
    expect(menuButton.className).toMatch(/min-h-\[44px\]/);

    fireEvent.click(menuButton);
    expect(handleMenuClick).toHaveBeenCalledTimes(1);
  });

  it('renders notification bell button with accessible label and minimum 44px tap target', () => {
    render(<Header onMenuClick={vi.fn()} />);

    const bellButton = screen.getByRole('button', { name: /notifications/i });
    expect(bellButton).toBeInTheDocument();
    expect(bellButton.className).toMatch(/min-w-\[44px\]/);
    expect(bellButton.className).toMatch(/min-h-\[44px\]/);
  });

  it('renders user profile avatar button with accessible label and minimum 44px tap target', () => {
    render(<Header onMenuClick={vi.fn()} />);

    const profileButton = screen.getByRole('button', { name: /user profile/i });
    expect(profileButton).toBeInTheDocument();
    expect(profileButton.className).toMatch(/min-w-\[44px\]/);
    expect(profileButton.className).toMatch(/min-h-\[44px\]/);
  });

  it('renders icon-only logo mark for small mobile (< 360px) and full logo for >= 360px', () => {
    render(<Header onMenuClick={vi.fn()} />);

    const iconMark = screen.getByTestId('header-logo-icon');
    expect(iconMark).toBeInTheDocument();
    expect(iconMark.className).toContain('block min-[360px]:hidden');

    const fullLogo = screen.getByTestId('header-logo-full');
    expect(fullLogo).toBeInTheDocument();
    expect(fullLogo.className).toContain('hidden min-[360px]:block');
    expect(fullLogo.className).toContain('max-w-full');
    expect(fullLogo.className).toContain('object-contain');
  });

  it('renders user info and role badge for desktop/tablet view', () => {
    render(<Header onMenuClick={vi.fn()} />);

    expect(screen.getByText('Jane Admin')).toBeInTheDocument();
    expect(screen.getByText('Administrator')).toBeInTheDocument();
  });
});
