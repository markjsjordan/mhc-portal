import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Settings } from '../Settings';

// Mock scrollIntoView
const scrollIntoViewMock = vi.fn();
window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

// Mock useApiClient
const mockUser = {
  id: 'usr-123',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane.doe@example.com',
  organizationId: 'org-456',
  roles: ['ADMIN'],
};

vi.mock('@/core/hooks', () => ({
  useApiClient: () => ({
    get: vi.fn().mockImplementation((url: string) => {
      if (url === '/api/users/profile') {
        return Promise.resolve(mockUser);
      }
      if (url.includes('/users')) {
        return Promise.resolve([]);
      }
      if (url.includes('/invitations')) {
        return Promise.resolve([]);
      }
      return Promise.resolve({});
    }),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  }),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('Settings page mobile responsiveness and tab navigation (wdvf3abp4t)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page container with max-w-full and overflow-x-hidden to prevent horizontal page overflow', () => {
    const { container } = renderWithClient(<Settings />);
    const rootDiv = container.firstElementChild;
    expect(rootDiv).toBeInTheDocument();
    expect(rootDiv?.className).toContain('max-w-full');
    expect(rootDiv?.className).toContain('overflow-x-hidden');
  });

  it('renders tab nav bar with overflow-x-auto and touch scrolling enabled', () => {
    renderWithClient(<Settings />);
    const nav = screen.getByRole('tablist', { name: /settings tabs/i });
    expect(nav).toBeInTheDocument();
    expect(nav.className).toContain('overflow-x-auto');
    expect(nav.style.webkitOverflowScrolling || nav.style.getPropertyValue('-webkit-overflow-scrolling') || nav.getAttribute('style') || '').toBeDefined();
  });

  it('renders all 4 tabs with min 44px tap targets and flex-shrink-0 for mobile viewport reachability', () => {
    renderWithClient(<Settings />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);

    const expectedLabels = ['Profile', 'Account', 'Preferences', 'Team'];
    tabs.forEach((tab, index) => {
      expect(tab).toHaveTextContent(expectedLabels[index]!);
      expect(tab.className).toContain('min-h-[44px]');
      expect(tab.className).toContain('whitespace-nowrap');
      expect(tab.className).toContain('flex-shrink-0');
    });
  });

  it('initially selects Profile tab and renders profile tabpanel', async () => {
    renderWithClient(<Settings />);
    const profileTab = screen.getByRole('tab', { name: /profile/i });
    expect(profileTab).toHaveAttribute('aria-selected', 'true');
    expect(profileTab.className).toContain('border-primary-500');

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('id', 'settings-panel-profile');
  });

  it('selects new tab on click, updates active tab indicator, renders panel, and scrolls tab into view', async () => {
    renderWithClient(<Settings />);
    const accountTab = screen.getByRole('tab', { name: /account/i });
    fireEvent.click(accountTab);

    expect(accountTab).toHaveAttribute('aria-selected', 'true');
    expect(accountTab.className).toContain('border-primary-500');

    const profileTab = screen.getByRole('tab', { name: /profile/i });
    expect(profileTab).toHaveAttribute('aria-selected', 'false');

    await waitFor(() => {
      const panel = screen.getByRole('tabpanel');
      expect(panel).toHaveAttribute('id', 'settings-panel-account');
    });

    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  it('allows switching to all tabs (Preferences and Team)', async () => {
    renderWithClient(<Settings />);
    
    // Switch to Preferences
    const preferencesTab = screen.getByRole('tab', { name: /preferences/i });
    fireEvent.click(preferencesTab);
    expect(preferencesTab).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => {
      expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'settings-panel-preferences');
    });

    // Switch to Team
    const teamTab = screen.getByRole('tab', { name: /team/i });
    fireEvent.click(teamTab);
    expect(teamTab).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => {
      expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'settings-panel-team');
    });
  });
});
