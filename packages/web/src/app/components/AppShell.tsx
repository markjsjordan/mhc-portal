import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useIdleLogout } from '@/core/hooks';
import { cn } from '@/core/utils';

export interface AppShellProps {
  children: React.ReactNode;
}

const isDesktopViewport = (): boolean => {
  if (typeof window === 'undefined') return true;
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(min-width: 1024px)').matches;
  }
  return window.innerWidth >= 1024;
};

const getInitialDesktopSidebarState = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    const saved = localStorage.getItem('sidebar_desktop_open');
    if (saved !== null) {
      return saved === 'true';
    }
  } catch {
    // Ignore localStorage errors (e.g. security sandbox)
  }
  return true;
};

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState<boolean>(getInitialDesktopSidebarState);

  // Auto-logout authenticated (non-demo) sessions after 30 minutes of
  // inactivity. See useIdleLogout for details.
  useIdleLogout();

  // Reset mobile drawer when transitioning across breakpoints
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return () => {};
    }
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (!e.matches) {
        setIsMobileSidebarOpen(false);
      }
    };
    mediaQuery.addEventListener('change', handleMediaChange);
    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  const handleToggleSidebar = () => {
    if (isDesktopViewport()) {
      setIsDesktopSidebarOpen((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('sidebar_desktop_open', String(next));
        } catch {
          // Ignore storage errors
        }
        return next;
      });
    } else {
      setIsMobileSidebarOpen(true);
    }
  };

  const handleCloseSidebar = () => {
    if (isDesktopViewport()) {
      setIsDesktopSidebarOpen(false);
      try {
        localStorage.setItem('sidebar_desktop_open', 'false');
      } catch {
        // Ignore storage errors
      }
    } else {
      setIsMobileSidebarOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        isOpen={isMobileSidebarOpen}
        isDesktopOpen={isDesktopSidebarOpen}
        onClose={handleCloseSidebar}
      />

      <div
        data-testid="app-shell-content"
        className={cn('transition-all duration-200', isDesktopSidebarOpen && 'lg:pl-64')}
      >
        <Header onMenuClick={handleToggleSidebar} />

        {/* Demo Data Banner removed: not shown in the current build */}

        <main className="p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
