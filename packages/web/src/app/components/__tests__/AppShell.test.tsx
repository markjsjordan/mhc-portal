import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../AppShell';

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
  useIdleLogout: vi.fn(),
}));

describe('AppShell component', () => {
  let localStorageMock: Record<string, string> = {};

  beforeEach(() => {
    localStorageMock = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
    });

    // Default to desktop matchMedia
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query.includes('min-width: 1024px'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders with sidebar open on desktop by default (content has lg:pl-64)', () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div>Page Content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByText('Page Content')).toBeInTheDocument();
    const contentWrapper = screen.getByTestId('app-shell-content');
    expect(contentWrapper.className).toContain('lg:pl-64');
  });

  it('toggles sidebar on desktop when hamburger is clicked and updates localStorage', () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div>Page Content</div>
        </AppShell>
      </MemoryRouter>
    );

    const hamburger = screen.getByRole('button', { name: /open navigation menu/i });
    const contentWrapper = screen.getByTestId('app-shell-content');
    expect(contentWrapper.className).toContain('lg:pl-64');

    // Click to collapse
    fireEvent.click(hamburger);
    expect(contentWrapper.className).not.toContain('lg:pl-64');
    expect(localStorage.setItem).toHaveBeenCalledWith('sidebar_desktop_open', 'false');

    // Click to expand
    fireEvent.click(hamburger);
    expect(contentWrapper.className).toContain('lg:pl-64');
    expect(localStorage.setItem).toHaveBeenCalledWith('sidebar_desktop_open', 'true');
  });

  it('collapses sidebar when close button (X) is clicked on desktop', () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div>Page Content</div>
        </AppShell>
      </MemoryRouter>
    );

    const contentWrapper = screen.getByTestId('app-shell-content');
    expect(contentWrapper.className).toContain('lg:pl-64');

    const closeButton = screen.getByRole('button', { name: /close sidebar/i });
    fireEvent.click(closeButton);

    expect(contentWrapper.className).not.toContain('lg:pl-64');
    expect(localStorage.setItem).toHaveBeenCalledWith('sidebar_desktop_open', 'false');
  });

  it('initializes in collapsed state if localStorage has sidebar_desktop_open=false', () => {
    localStorageMock['sidebar_desktop_open'] = 'false';

    render(
      <MemoryRouter>
        <AppShell>
          <div>Page Content</div>
        </AppShell>
      </MemoryRouter>
    );

    const contentWrapper = screen.getByTestId('app-shell-content');
    expect(contentWrapper.className).not.toContain('lg:pl-64');
  });

  it('opens mobile sidebar drawer on mobile when hamburger is clicked', () => {
    // Stub mobile matchMedia
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    const { container } = render(
      <MemoryRouter>
        <AppShell>
          <div>Page Content</div>
        </AppShell>
      </MemoryRouter>
    );

    // Initially mobile backdrop is not visible
    expect(container.querySelector('.fixed.inset-0.bg-gray-900')).toBeNull();

    const hamburger = screen.getByRole('button', { name: /open navigation menu/i });
    fireEvent.click(hamburger);

    // Now mobile backdrop is rendered
    expect(container.querySelector('.fixed.inset-0.bg-gray-900')).toBeInTheDocument();
  });
});
